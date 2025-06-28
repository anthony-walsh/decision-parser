/**
 * ColdStorageService - Main thread interface for encrypted cold storage
 * 
 * Provides:
 * - Progressive search across encrypted document batches
 * - Worker communication for cold storage operations
 * - 100MB batch cache with LRU eviction management
 * - Authentication integration with encryption keys
 * - Memory management integration for decrypted data cleanup
 * 
 * AIDEV-NOTE: Main thread service that coordinates with coldStorageWorker.ts
 */

import { memoryManager } from './MemoryManager.js';
import { performanceMonitor } from './PerformanceMonitor.js';
import { browserResourceManager } from '../utils/BrowserResourceManager.js';

export class ColdStorageService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.isAuthenticated = false;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.storageIndex = null;
    this.searchCallbacks = new Map();
    
    // AIDEV-NOTE: Worker lifecycle tracking
    this.workerState = {
      status: 'not_initialized', // not_initialized, initializing, ready, failed
      lastHeartbeat: null,
      initializationStart: null,
      initializationDuration: null,
      errorCount: 0,
      lastError: null
    };
    
    // AIDEV-NOTE: Memory management integration
    this.decryptedBatches = new Map(); // Track decrypted batches locally
    this.memoryCleanupTimeout = null;
    this.performanceMetrics = {
      searchOperations: 0,
      totalSearchTime: 0,
      decryptionOperations: 0,
      totalDecryptionTime: 0
    };
    
    // Setup memory management listeners
    this.setupMemoryManagement();
  }

  /**
   * Setup memory management integration
   * AIDEV-NOTE: Integrates with MemoryManager for automatic cleanup
   */
  setupMemoryManagement() {
    // Listen for memory warnings
    memoryManager.onMemoryWarning((data) => {
      console.warn('Memory warning received in ColdStorageService:', data);
      this.performMemoryCleanup();
    });
    
    // Listen for cleanup events
    memoryManager.onCleanup((data) => {
      console.log('Memory cleanup performed, freed:', data.memoryFreed + 'MB');
    });
    
    // Setup periodic cleanup
    this.scheduleMemoryCleanup();
  }

  /**
   * Perform memory cleanup for cold storage operations
   * AIDEV-NOTE: Cleanup decrypted batches and notify MemoryManager
   */
  async performMemoryCleanup() {
    console.log('Performing cold storage memory cleanup');
    
    const startTime = performance.now();
    let cleanedMemory = 0;
    
    // Get least recently used batches
    const sortedBatches = Array.from(this.decryptedBatches.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Clean up oldest 50% of batches
    const toClean = Math.max(1, Math.floor(sortedBatches.length * 0.5));
    
    for (let i = 0; i < toClean && i < sortedBatches.length; i++) {
      const [batchId, batch] = sortedBatches[i];
      cleanedMemory += batch.size || 0;
      
      // Untrack from memory manager
      memoryManager.untrackDecryptedBatch(batchId);
      
      // Remove from local tracking
      this.decryptedBatches.delete(batchId);
      
      console.log(`Cleaned up decrypted batch: ${batchId} (${batch.size || 0}MB)`);
    }
    
    // Record performance metric
    const duration = performance.now() - startTime;
    performanceMonitor.recordStorageOperation('cleanup', duration, cleanedMemory, {
      batchesCleaned: toClean,
      memoryFreed: cleanedMemory
    });
    
    console.log(`Cold storage cleanup completed: ${cleanedMemory}MB freed in ${duration.toFixed(2)}ms`);
  }

  /**
   * Schedule periodic memory cleanup
   * AIDEV-NOTE: Automatic cleanup every 5 minutes
   */
  scheduleMemoryCleanup() {
    if (this.memoryCleanupTimeout) {
      clearTimeout(this.memoryCleanupTimeout);
    }
    
    this.memoryCleanupTimeout = setTimeout(() => {
      this.performMemoryCleanup();
      this.scheduleMemoryCleanup(); // Reschedule
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Track decrypted batch in memory manager
   * AIDEV-NOTE: Register batch with MemoryManager for tracking
   */
  trackDecryptedBatch(batchId, data, sizeMB) {
    console.log(`[ColdStorageService] Tracking decrypted batch: ${batchId} (${sizeMB}MB)`);
    
    const batchInfo = {
      data,
      size: sizeMB,
      createdAt: new Date(),
      lastAccessed: new Date()
    };
    
    // Track locally
    this.decryptedBatches.set(batchId, batchInfo);
    console.log(`[ColdStorageService] Batch ${batchId} added to local tracking (total tracked: ${this.decryptedBatches.size})`);
    
    // Track in memory manager
    memoryManager.trackDecryptedBatch(batchId, data, sizeMB);
    console.log(`[ColdStorageService] Batch ${batchId} registered with memory manager`);
  }

  /**
   * Access decrypted batch and update access time
   * AIDEV-NOTE: Update last accessed time for LRU cleanup
   */
  accessDecryptedBatch(batchId) {
    console.log(`[ColdStorageService] Accessing decrypted batch: ${batchId}`);
    
    const batch = this.decryptedBatches.get(batchId);
    if (batch) {
      const oldAccessTime = batch.lastAccessed;
      batch.lastAccessed = new Date();
      console.log(`[ColdStorageService] Updated access time for batch ${batchId} (previous: ${oldAccessTime})`);
      return memoryManager.accessDecryptedBatch(batchId);
    } else {
      console.log(`[ColdStorageService] Batch ${batchId} not found in local tracking`);
    }
    return null;
  }

  /**
   * Initialize cold storage worker
   * AIDEV-NOTE: Enhanced with detailed logging for debugging
   */
  async initialize() {
    console.log('[ColdStorageService] Initializing cold storage service...');
    
    if (this.isInitialized) {
      console.log('[ColdStorageService] Already initialized, skipping');
      return;
    }
    
    this.workerState.status = 'initializing';
    this.workerState.initializationStart = performance.now();
    console.log('[ColdStorageService] Worker state:', this.workerState);

    try {
      console.log('[ColdStorageService] Creating cold storage worker...');
      
      // Try multiple worker loading strategies for both dev and production
      const workerPaths = [
        // AIDEV-NOTE: Use Vite's worker import for proper TypeScript handling
        new URL('../workers/coldStorageWorker.ts', import.meta.url), // Vite worker import (best)
        '/src/workers/coldStorageWorker.ts', // Development fallback
        '/decision-parser/src/workers/coldStorageWorker.ts', // Production path with base
      ];
      
      let workerCreated = false;
      let lastError = null;
      
      for (const workerPath of workerPaths) {
        try {
          console.log(`[ColdStorageService] Trying worker path: ${workerPath}`);
          
          // Try ES module first, then fallback to classic
          try {
            this.worker = new Worker(workerPath, { type: 'module' });
            console.log(`[ColdStorageService] Worker created successfully with ES module at: ${workerPath}`);
            workerCreated = true;
            break;
          } catch (moduleError) {
            console.log(`[ColdStorageService] ES module failed for ${workerPath}, trying classic:`, moduleError.message);
            this.worker = new Worker(workerPath);
            console.log(`[ColdStorageService] Worker created successfully with classic mode at: ${workerPath}`);
            workerCreated = true;
            break;
          }
        } catch (error) {
          console.log(`[ColdStorageService] Worker path ${workerPath} failed:`, error.message);
          lastError = error;
        }
      }
      
      if (!workerCreated) {
        throw new Error(`Failed to create worker with any path. Last error: ${lastError?.message || 'Unknown error'}`);
      }

      // Set up message handling
      this.worker.onmessage = (event) => {
        console.log('[ColdStorageService] Received worker message:', event.data.type);
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('[ColdStorageService] Cold storage worker error:', {
          error: error,
          message: error.message || 'Unknown worker error',
          filename: error.filename || 'Unknown file',
          lineno: error.lineno || 'Unknown line',
          colno: error.colno || 'Unknown column'
        });
        
        // Mark worker as failed and clean up
        this.isInitialized = false;
        this.worker = null;
        this.workerState.status = 'failed';
        this.workerState.errorCount++;
        this.workerState.lastError = {
          message: error.message || 'Unknown worker error',
          timestamp: new Date().toISOString()
        };
      };

      this.isInitialized = true;
      console.log('[ColdStorageService] Worker initialization completed');

      // Load storage index
      console.log('[ColdStorageService] Loading storage index...');
      await this.loadStorageIndex();
      console.log('[ColdStorageService] Storage index loaded successfully');

    } catch (error) {
      console.error('[ColdStorageService] Failed to initialize cold storage service:', error);
      throw new Error('Cold storage initialization failed');
    }
  }

  /**
   * Authenticate worker with encryption key
   * AIDEV-NOTE: Enhanced with detailed logging for debugging authentication flow
   */
  async authenticate(keyMaterial) {
    console.log('[ColdStorageService] Starting authentication process...');
    
    if (!this.isInitialized) {
      console.error('[ColdStorageService] Cannot authenticate - service not initialized');
      throw new Error('Service not initialized');
    }

    try {
      console.log('[ColdStorageService] Sending authentication key to worker...');
      
      // Send auth-init and wait for specific response
      const authResult = await this.sendMessage('auth-init', { keyMaterial });
      
      if (authResult.success) {
        this.isAuthenticated = true;
        console.log('[ColdStorageService] Authentication successful, service authenticated');
      } else {
        console.error('[ColdStorageService] Authentication failed - worker rejected credentials');
        this.isAuthenticated = false;
        throw new Error('Authentication failed - invalid credentials');
      }
      
    } catch (error) {
      console.error('[ColdStorageService] Cold storage authentication failed:', error);
      this.isAuthenticated = false;
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Authenticate with password for batch-specific key derivation
   * AIDEV-NOTE: New method for batch salt architecture
   */
  async authenticateWithPassword(password) {
    console.log('[ColdStorageService] Starting password-based authentication process...');
    
    if (!this.isInitialized) {
      console.error('[ColdStorageService] Cannot authenticate - service not initialized');
      throw new Error('Service not initialized');
    }

    try {
      console.log('[ColdStorageService] Sending password to worker for batch-specific key derivation...');
      
      // Send auth-init with password instead of keyMaterial
      const authResult = await this.sendMessage('auth-init', { password });
      
      if (authResult.success) {
        this.isAuthenticated = true;
        console.log('[ColdStorageService] Password authentication successful, service authenticated');
      } else {
        console.error('[ColdStorageService] Password authentication failed - worker rejected credentials');
        this.isAuthenticated = false;
        throw new Error('Password authentication failed - invalid credentials');
      }
      
    } catch (error) {
      console.error('[ColdStorageService] Cold storage password authentication failed:', error);
      this.isAuthenticated = false;
      throw new Error(`Password authentication failed: ${error.message}`);
    }
  }

  /**
   * Load storage index from server
   * AIDEV-NOTE: Enhanced with detailed logging for storage index loading
   */
  async loadStorageIndex() {
    console.log('[ColdStorageService] Loading storage index from worker...');
    
    if (!this.isInitialized) {
      console.error('[ColdStorageService] Cannot load storage index - service not initialized');
      throw new Error('Service not initialized');
    }

    try {
      console.log('[ColdStorageService] Requesting storage index from worker...');
      const result = await this.sendMessage('load-storage-index');
      this.storageIndex = result.storageIndex;
      
      console.log('[ColdStorageService] Storage index loaded:', {
        totalDocuments: this.storageIndex.totalDocuments,
        totalBatches: this.storageIndex.batches?.length || 0,
        batchIds: this.storageIndex.batches?.map(b => b.batchId).slice(0, 5) || []
      });
      
      return this.storageIndex;
    } catch (error) {
      console.warn('[ColdStorageService] Failed to load storage index:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'UnknownError'
      });
      console.log('[ColdStorageService] Using empty storage index for graceful degradation');
      // Don't throw - cold storage should degrade gracefully
      this.storageIndex = { totalDocuments: 0, batches: [] };
      return this.storageIndex;
    }
  }

  /**
   * Search cold storage with progressive results
   * AIDEV-NOTE: Always require authentication for cold storage access (encrypted-only policy)
   */
  async searchDocuments(query, options = {}, progressCallback = null) {
    // AIDEV-NOTE: Always require authentication - cold storage is encrypted-only
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for cold storage access');
    }

    if (!this.storageIndex || this.storageIndex.batches.length === 0) {
      return {
        results: [],
        total: 0,
        query,
        batchesSearched: 0,
        message: 'No archived documents available'
      };
    }

    // AIDEV-NOTE: Performance monitoring integration
    const searchStartTime = performance.now();
    const operationId = `cold-search-${Date.now()}`;
    
    // Track heavy operation for resource management
    const estimatedDuration = this.storageIndex.batches.length * 1000; // Estimate 1s per batch
    browserResourceManager.trackHeavyOperation(
      operationId, 
      `Cold storage search: "${query}"`, 
      estimatedDuration
    );

    try {
      const searchId = `search_${++this.messageId}`;
      
      // Store progress callback
      if (progressCallback) {
        this.searchCallbacks.set(searchId, progressCallback);
      }

      // Start search
      const result = await this.sendMessage('search-cold-storage', {
        query,
        options
      }, searchId);

      // Clean up callback
      this.searchCallbacks.delete(searchId);

      // AIDEV-NOTE: Record performance metrics
      const searchDuration = performance.now() - searchStartTime;
      this.performanceMetrics.searchOperations++;
      this.performanceMetrics.totalSearchTime += searchDuration;
      
      // Record in performance monitor
      performanceMonitor.recordSearchOperation(
        'cold', 
        query, 
        searchDuration, 
        result.results?.length || 0,
        {
          batchesSearched: result.batchesSearched || 0,
          limited: result.limited || false
        }
      );
      
      // Complete heavy operation tracking
      browserResourceManager.completeHeavyOperation(operationId);

      return {
        results: result.results || [],
        total: result.total || 0,
        query: result.query,
        batchesSearched: result.batchesSearched || 0,
        limited: result.limited || false
      };

    } catch (error) {
      console.error('Cold storage search failed:', error);
      
      // AIDEV-NOTE: Record failed operation metrics
      const searchDuration = performance.now() - searchStartTime;
      performanceMonitor.recordSearchOperation(
        'cold', 
        query, 
        searchDuration, 
        0,
        {
          error: error.message,
          failed: true
        }
      );
      
      // Complete heavy operation tracking
      browserResourceManager.completeHeavyOperation(operationId);
      
      // Return partial results if available
      return {
        results: [],
        total: 0,
        query,
        error: error.message,
        batchesSearched: 0
      };
    }
  }

  /**
   * Get specific batch data (for admin/debugging)
   * AIDEV-NOTE: Always require authentication for batch access (encrypted-only policy)
   */
  async getBatch(batchId) {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for batch access');
    }

    try {
      const result = await this.sendMessage('get-batch', { batchId });
      return result.batchData;
    } catch (error) {
      console.error('Failed to get batch:', error);
      throw new Error(`Batch retrieval failed: ${error.message}`);
    }
  }

  /**
   * Clear batch cache
   */
  async clearCache() {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.sendMessage('clear-cache');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   * AIDEV-NOTE: Always require authentication for cache stats (encrypted-only policy)
   */
  async getCacheStats() {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for cache statistics');
    }

    try {
      const result = await this.sendMessage('get-cache-stats');
      return result;
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        cacheSize: 0,
        cachedBatches: 0,
        maxCacheSize: 0
      };
    }
  }

  /**
   * Get storage index information
   */
  getStorageInfo() {
    return {
      totalDocuments: this.storageIndex?.totalDocuments || 0,
      totalBatches: this.storageIndex?.batches?.length || 0,
      isLoaded: !!this.storageIndex,
      batchSizes: this.storageIndex?.batches?.map(b => ({
        id: b.batchId,
        documentCount: b.documentCount,
        size: b.size,
        dateRange: b.dateRange
      })) || []
    };
  }

  /**
   * Check if cold storage is available
   * AIDEV-NOTE: Always require authentication - cold storage is encrypted-only
   */
  isAvailable() {
    return this.isInitialized && 
           this.isAuthenticated && 
           this.storageIndex && 
           this.storageIndex.batches.length > 0;
  }
  
  /**
   * Check if cold storage requires authentication (always true for encrypted-only policy)
   * AIDEV-NOTE: Helper method to indicate authentication is always required
   */
  requiresAuthentication() {
    return true; // Always true for encrypted-only cold storage
  }

  /**
   * Send message to worker and wait for response
   * AIDEV-NOTE: Enhanced with detailed logging for worker communication
   */
  async sendMessage(type, payload = {}, customId = null) {
    if (!this.worker) {
      console.error('[ColdStorageService] Cannot send message - worker not initialized');
      throw new Error('Worker not initialized');
    }

    const id = customId || `msg_${++this.messageId}`;
    console.log(`[ColdStorageService] Sending message to worker:`, { type, id, payloadSize: JSON.stringify(payload).length });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[ColdStorageService] Message timeout for ${type} (id: ${id})`);
        this.pendingMessages.delete(id);
        this.searchCallbacks.delete(id);
        reject(new Error('Message timeout'));
      }, 60000); // 60 second timeout for cold storage operations

      this.pendingMessages.set(id, { resolve, reject, timeout });
      console.log(`[ColdStorageService] Message ${id} added to pending (total pending: ${this.pendingMessages.size})`);

      this.worker.postMessage({
        type,
        id,
        payload
      });
      console.log(`[ColdStorageService] Message ${id} sent to worker`);
    });
  }

  /**
   * Handle messages from worker
   * AIDEV-NOTE: Enhanced with detailed logging for worker message handling
   */
  handleWorkerMessage(message) {
    const { type, id, payload } = message;
    console.log(`[ColdStorageService] Handling worker message:`, { type, id, payloadKeys: Object.keys(payload || {}) });

    // Handle progress messages
    if (type === 'cold-search-progress' && id && this.searchCallbacks.has(id)) {
      console.log(`[ColdStorageService] Processing search progress for ${id}:`, {
        message: payload.message,
        progress: `${payload.completedBatches}/${payload.totalBatches}`,
        partialResults: payload.partialResults?.length || 0
      });
      
      const callback = this.searchCallbacks.get(id);
      callback({
        type: 'progress',
        message: payload.message,
        totalBatches: payload.totalBatches,
        completedBatches: payload.completedBatches,
        partialResults: payload.partialResults || []
      });
      return;
    }

    // Handle final responses
    if (id && this.pendingMessages.has(id)) {
      console.log(`[ColdStorageService] Processing final response for ${id}:`, { type, success: !type.endsWith('-error') });
      
      const { resolve, reject, timeout } = this.pendingMessages.get(id);
      clearTimeout(timeout);
      this.pendingMessages.delete(id);
      console.log(`[ColdStorageService] Removed ${id} from pending (remaining: ${this.pendingMessages.size})`);

      if (type.endsWith('-error')) {
        console.error(`[ColdStorageService] Worker error for ${id}:`, payload.message || 'Unknown worker error');
        reject(new Error(payload.message || 'Unknown worker error'));
      } else {
        console.log(`[ColdStorageService] Successful response for ${id}`);
        resolve(payload);
      }
      return;
    }

    // Handle non-response messages
    console.log(`[ColdStorageService] Processing non-response message: ${type}`);
    switch (type) {
      case 'storage-index-loaded':
        console.log('[ColdStorageService] Storage index loaded from worker:', {
          totalDocuments: payload.storageIndex?.totalDocuments,
          totalBatches: payload.storageIndex?.batches?.length
        });
        this.storageIndex = payload.storageIndex;
        break;

      case 'storage-index-error':
        console.warn('[ColdStorageService] Storage index loading failed:', payload.message);
        this.storageIndex = { totalDocuments: 0, batches: [] };
        break;

      case 'auth-complete':
        console.log('[ColdStorageService] Authentication completed successfully');
        this.isAuthenticated = true;
        break;

      case 'auth-error':
        console.error('[ColdStorageService] Cold storage authentication error:', payload);
        this.isAuthenticated = false;
        break;

      case 'worker-error':
        console.error('[ColdStorageService] Worker internal error:', {
          message: payload.message,
          error: payload.error,
          stack: payload.stack
        });
        // Mark worker as failed
        this.isInitialized = false;
        this.isAuthenticated = false;
        break;

      case 'worker-fatal-error':
        console.error('[ColdStorageService] Worker fatal error:', {
          message: payload.message,
          error: payload.error,
          stack: payload.stack,
          filename: payload.filename,
          lineno: payload.lineno,
          colno: payload.colno
        });
        // Mark worker as completely failed
        this.isInitialized = false;
        this.isAuthenticated = false;
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        break;

      case 'worker-ready':
        console.log('[ColdStorageService] Worker ready signal received:', {
          message: payload.message,
          timestamp: payload.timestamp
        });
        
        // Update worker state
        this.workerState.status = 'ready';
        this.workerState.lastHeartbeat = performance.now();
        this.workerState.initializationDuration = performance.now() - this.workerState.initializationStart;
        
        console.log('[ColdStorageService] Worker state updated:', {
          status: this.workerState.status,
          initializationDuration: `${this.workerState.initializationDuration.toFixed(2)}ms`
        });
        
        // Worker is ready, proceed with loading storage index
        if (!this.storageIndex) {
          console.log('[ColdStorageService] Worker ready, loading storage index...');
        }
        break;

      default:
        console.log('[ColdStorageService] Unhandled cold storage worker message:', message);
    }
  }

  /**
   * Add a document to cold storage
   * AIDEV-NOTE: Cold storage is designed for pre-encrypted batches, not individual document addition
   * This is a stub implementation for compatibility with AppealImportService
   */
  async addDocument(document) {
    console.log('[ColdStorageService] addDocument called (not implemented for encrypted cold storage):', {
      documentId: document.id || 'unknown',
      filename: document.filename || 'unknown',
      contentLength: document.content?.length || 0
    });
    
    // AIDEV-NOTE: The cold storage architecture is designed for pre-encrypted batch files
    // Individual document addition would require implementing:
    // 1. Document encryption and batch creation
    // 2. Storage index updates
    // 3. Worker message handling for batch creation
    // For now, we log the attempt and throw an informative error
    
    throw new Error('Cold storage is designed for pre-encrypted batches. Use the batch import process instead.');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    this.isAuthenticated = false;
    this.pendingMessages.clear();
    this.searchCallbacks.clear();
    this.storageIndex = null;
  }

  /**
   * Get current service state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isAuthenticated: this.isAuthenticated,
      hasWorker: !!this.worker,
      hasStorageIndex: !!this.storageIndex,
      totalBatches: this.storageIndex?.batches?.length || 0,
      pendingMessages: this.pendingMessages.size,
      activeSearches: this.searchCallbacks.size,
      workerState: { ...this.workerState }
    };
  }
  
  /**
   * Get detailed worker status for debugging
   */
  getWorkerStatus() {
    return {
      state: { ...this.workerState },
      hasWorker: !!this.worker,
      pendingMessages: this.pendingMessages.size,
      activeSearches: this.searchCallbacks.size,
      memoryStats: {
        decryptedBatches: this.decryptedBatches.size,
        lastCleanup: this.memoryCleanupTimeout ? 'scheduled' : 'none'
      }
    };
  }
}

// AIDEV-NOTE: Export singleton instance for consistent usage across application
export const coldStorageService = new ColdStorageService();