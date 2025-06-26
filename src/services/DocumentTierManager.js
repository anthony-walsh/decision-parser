/**
 * DocumentTierManager - Manages document lifecycle between hot and cold storage
 * 
 * Responsibilities:
 * - Automatic hot-to-cold migration based on age and access patterns
 * - Hot storage limit enforcement (5,000 documents)
 * - Migration status tracking and user notifications
 * - Background migration processing coordination
 * 
 * AIDEV-NOTE: Core service for document lifecycle management across storage tiers
 */

import { hotStorage } from '../stores/index.js';
import { coldStorageService } from './ColdStorageService.js';
import { encryptionService } from './EncryptionService.js';

export class DocumentTierManager {
  constructor() {
    this.isInitialized = false;
    this.migrationWorker = null;
    this.migrationInProgress = false;
    this.migrationQueue = [];
    this.migrationStats = {
      totalMigrated: 0,
      totalFailed: 0,
      lastMigrationDate: null,
      avgMigrationTime: 0
    };
    
    // Migration configuration
    this.config = {
      maxHotStorageDocuments: 5000,
      migrationAgeThresholdDays: 90,
      accessThresholdDays: 30, // Documents not accessed in 30 days are candidates
      batchSize: 100, // Documents to migrate in one batch
      migrationInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      maxConcurrentMigrations: 3
    };
    
    // Event listeners for migration events
    this.eventListeners = new Map();
  }

  /**
   * Initialize the tier manager
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure hot storage is initialized
      if (!hotStorage.isInitialized) {
        await hotStorage.initialize();
      }

      // Ensure cold storage is initialized
      if (!coldStorageService.isInitialized) {
        await coldStorageService.initialize();
      }

      // Create migration worker
      await this.initializeMigrationWorker();
      
      // Start periodic migration check
      this.startPeriodicMigrationCheck();
      
      this.isInitialized = true;
      this.emit('initialized', { success: true });
      
      console.log('DocumentTierManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DocumentTierManager:', error);
      this.emit('error', { 
        type: 'initialization', 
        message: error.message 
      });
      throw error;
    }
  }

  /**
   * Initialize migration worker
   */
  async initializeMigrationWorker() {
    try {
      this.migrationWorker = new Worker('/src/workers/migrationWorker.ts', { 
        type: 'module' 
      });

      this.migrationWorker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };

      this.migrationWorker.onerror = (error) => {
        console.error('Migration worker error:', error);
        this.emit('error', { 
          type: 'worker', 
          message: error.message 
        });
      };

      // Initialize worker with encryption key if available
      if (encryptionService.isInitialized()) {
        const keyMaterial = await encryptionService.exportKey(encryptionService.encryptionKey);
        this.migrationWorker.postMessage({
          type: 'initialize',
          payload: { keyMaterial }
        });
      }

    } catch (error) {
      console.error('Failed to initialize migration worker:', error);
      throw error;
    }
  }

  /**
   * Check if migration is needed and trigger if necessary
   */
  async checkAndTriggerMigration() {
    if (this.migrationInProgress) {
      console.log('Migration already in progress, skipping check');
      return;
    }

    try {
      const hotStorageStats = await hotStorage.getStats();
      const migrationNeeded = await this.assessMigrationNeed(hotStorageStats);

      if (migrationNeeded.required) {
        console.log('Migration needed:', migrationNeeded.reasons);
        await this.triggerMigration(migrationNeeded);
      } else {
        console.log('No migration needed at this time');
      }
    } catch (error) {
      console.error('Failed to check migration need:', error);
      this.emit('error', { 
        type: 'migration-check', 
        message: error.message 
      });
    }
  }

  /**
   * Assess whether migration is needed
   */
  async assessMigrationNeed(hotStorageStats) {
    const reasons = [];
    let required = false;

    // Check document count limit
    if (hotStorageStats.documentCount >= this.config.maxHotStorageDocuments) {
      reasons.push(`Hot storage limit reached: ${hotStorageStats.documentCount}/${this.config.maxHotStorageDocuments}`);
      required = true;
    } else if (hotStorageStats.documentCount >= this.config.maxHotStorageDocuments * 0.9) {
      reasons.push(`Hot storage nearing limit: ${hotStorageStats.documentCount}/${this.config.maxHotStorageDocuments} (90%)`);
      required = true;
    }

    // Check for old documents
    const oldDocuments = await this.getOldDocuments();
    if (oldDocuments.length > 0) {
      reasons.push(`Found ${oldDocuments.length} documents older than ${this.config.migrationAgeThresholdDays} days`);
      required = true;
    }

    // Check for inactive documents
    const inactiveDocuments = await this.getInactiveDocuments();
    if (inactiveDocuments.length > 50) {
      reasons.push(`Found ${inactiveDocuments.length} documents not accessed in ${this.config.accessThresholdDays} days`);
      required = true;
    }

    return {
      required,
      reasons,
      documentCount: hotStorageStats.documentCount,
      oldDocuments: oldDocuments.length,
      inactiveDocuments: inactiveDocuments.length
    };
  }

  /**
   * Get documents older than migration threshold
   */
  async getOldDocuments() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.migrationAgeThresholdDays);

    try {
      // Query hot storage for old documents
      const oldDocuments = await hotStorage.query(`
        SELECT * FROM documents 
        WHERE upload_date < ? 
        ORDER BY upload_date ASC 
        LIMIT ?
      `, [cutoffDate.toISOString(), this.config.batchSize]);

      return oldDocuments;
    } catch (error) {
      console.error('Failed to get old documents:', error);
      return [];
    }
  }

  /**
   * Get documents that haven't been accessed recently
   */
  async getInactiveDocuments() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.accessThresholdDays);

    try {
      // Query hot storage for inactive documents
      const inactiveDocuments = await hotStorage.query(`
        SELECT * FROM documents 
        WHERE last_accessed < ? OR last_accessed IS NULL
        ORDER BY last_accessed ASC, upload_date ASC
        LIMIT ?
      `, [cutoffDate.toISOString(), this.config.batchSize]);

      return inactiveDocuments;
    } catch (error) {
      console.error('Failed to get inactive documents:', error);
      return [];
    }
  }

  /**
   * Trigger migration process
   */
  async triggerMigration(migrationNeed) {
    if (this.migrationInProgress) {
      throw new Error('Migration already in progress');
    }

    this.migrationInProgress = true;
    const migrationId = `migration_${Date.now()}`;
    
    try {
      this.emit('migration-started', {
        migrationId,
        reason: migrationNeed.reasons.join(', '),
        estimatedDocuments: migrationNeed.oldDocuments + migrationNeed.inactiveDocuments
      });

      // Get documents to migrate (prioritize oldest first)
      const documentsToMigrate = await this.selectDocumentsForMigration();
      
      if (documentsToMigrate.length === 0) {
        console.log('No documents selected for migration');
        this.migrationInProgress = false;
        return;
      }

      console.log(`Starting migration of ${documentsToMigrate.length} documents`);

      // Process migration in batches
      const batchCount = Math.ceil(documentsToMigrate.length / this.config.batchSize);
      let migratedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < batchCount; i++) {
        const batchStart = i * this.config.batchSize;
        const batchEnd = Math.min((i + 1) * this.config.batchSize, documentsToMigrate.length);
        const batch = documentsToMigrate.slice(batchStart, batchEnd);

        this.emit('migration-progress', {
          migrationId,
          batchNumber: i + 1,
          totalBatches: batchCount,
          batchSize: batch.length,
          migratedCount,
          failedCount
        });

        try {
          const batchResult = await this.migrateBatch(batch, migrationId);
          migratedCount += batchResult.success;
          failedCount += batchResult.failed;
        } catch (error) {
          console.error(`Batch ${i + 1} migration failed:`, error);
          failedCount += batch.length;
        }

        // Yield control between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update stats
      this.migrationStats.totalMigrated += migratedCount;
      this.migrationStats.totalFailed += failedCount;
      this.migrationStats.lastMigrationDate = new Date();

      this.emit('migration-completed', {
        migrationId,
        migratedCount,
        failedCount,
        totalDocuments: documentsToMigrate.length
      });

      console.log(`Migration completed: ${migratedCount} migrated, ${failedCount} failed`);

    } catch (error) {
      console.error('Migration failed:', error);
      this.emit('migration-failed', {
        migrationId,
        error: error.message
      });
      throw error;
    } finally {
      this.migrationInProgress = false;
    }
  }

  /**
   * Select documents for migration based on age and access patterns
   */
  async selectDocumentsForMigration() {
    const candidates = [];

    // Get old documents (highest priority)
    const oldDocuments = await this.getOldDocuments();
    candidates.push(...oldDocuments);

    // If we need more documents, get inactive ones
    const remainingSlots = this.config.batchSize - candidates.length;
    if (remainingSlots > 0) {
      const inactiveDocuments = await this.getInactiveDocuments();
      // Filter out documents already selected
      const candidateIds = new Set(candidates.map(d => d.id));
      const additionalCandidates = inactiveDocuments
        .filter(d => !candidateIds.has(d.id))
        .slice(0, remainingSlots);
      
      candidates.push(...additionalCandidates);
    }

    return candidates;
  }

  /**
   * Migrate a batch of documents to cold storage
   */
  async migrateBatch(documents, migrationId) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      // Send batch to migration worker
      const workerResult = await this.sendWorkerMessage('migrate-batch', {
        documents,
        migrationId,
        batchId: `batch_${Date.now()}`
      });

      results.success = workerResult.migratedCount || 0;
      results.failed = workerResult.failedCount || 0;
      results.errors = workerResult.errors || [];

      // Remove successfully migrated documents from hot storage
      if (workerResult.migratedDocuments) {
        for (const docId of workerResult.migratedDocuments) {
          try {
            await hotStorage.removeDocument(docId);
          } catch (error) {
            console.error(`Failed to remove document ${docId} from hot storage:`, error);
            results.errors.push(`Hot storage cleanup failed for ${docId}: ${error.message}`);
          }
        }
      }

    } catch (error) {
      console.error('Batch migration failed:', error);
      results.failed = documents.length;
      results.errors.push(error.message);
    }

    return results;
  }

  /**
   * Send message to migration worker
   */
  async sendWorkerMessage(type, payload) {
    return new Promise((resolve, reject) => {
      const messageId = `msg_${Date.now()}_${Math.random()}`;
      const timeout = setTimeout(() => {
        reject(new Error('Worker message timeout'));
      }, 30000); // 30 second timeout

      const handleResponse = (event) => {
        if (event.data.id === messageId) {
          clearTimeout(timeout);
          this.migrationWorker.removeEventListener('message', handleResponse);
          
          if (event.data.type === 'error') {
            reject(new Error(event.data.payload.message));
          } else {
            resolve(event.data.payload);
          }
        }
      };

      this.migrationWorker.addEventListener('message', handleResponse);
      this.migrationWorker.postMessage({
        type,
        id: messageId,
        payload
      });
    });
  }

  /**
   * Handle messages from migration worker
   */
  handleWorkerMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case 'migration-progress':
        this.emit('batch-progress', payload);
        break;
      case 'migration-error':
        this.emit('migration-error', payload);
        break;
      case 'worker-ready':
        console.log('Migration worker ready');
        break;
      default:
        console.log('Unhandled migration worker message:', type, payload);
    }
  }

  /**
   * Start periodic migration check
   */
  startPeriodicMigrationCheck() {
    // Check immediately
    setTimeout(() => this.checkAndTriggerMigration(), 5000);

    // Then check periodically
    setInterval(() => {
      this.checkAndTriggerMigration();
    }, this.config.migrationInterval);
  }

  /**
   * Force immediate migration check
   */
  async forceMigrationCheck() {
    return await this.checkAndTriggerMigration();
  }

  /**
   * Get migration status
   */
  getMigrationStatus() {
    return {
      isInitialized: this.isInitialized,
      migrationInProgress: this.migrationInProgress,
      queueLength: this.migrationQueue.length,
      stats: { ...this.migrationStats },
      config: { ...this.config }
    };
  }

  /**
   * Update migration configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * Event system for migration notifications
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  off(event, listener) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      for (const listener of this.eventListeners.get(event)) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.migrationWorker) {
      this.migrationWorker.terminate();
      this.migrationWorker = null;
    }
    
    this.eventListeners.clear();
    this.isInitialized = false;
    this.migrationInProgress = false;
  }
}

// AIDEV-NOTE: Export singleton instance for consistent usage across application
export const documentTierManager = new DocumentTierManager();