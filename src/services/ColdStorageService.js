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
    const batchInfo = {
      data,
      size: sizeMB,
      createdAt: new Date(),
      lastAccessed: new Date()
    };
    
    // Track locally
    this.decryptedBatches.set(batchId, batchInfo);
    
    // Track in memory manager
    memoryManager.trackDecryptedBatch(batchId, data, sizeMB);
    
    console.log(`Tracking decrypted batch: ${batchId} (${sizeMB}MB)`);
  }

  /**
   * Access decrypted batch and update access time
   * AIDEV-NOTE: Update last accessed time for LRU cleanup
   */
  accessDecryptedBatch(batchId) {
    const batch = this.decryptedBatches.get(batchId);
    if (batch) {
      batch.lastAccessed = new Date();
      return memoryManager.accessDecryptedBatch(batchId);
    }
    return null;
  }

  /**
   * Initialize cold storage worker
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create worker
      this.worker = new Worker('/src/workers/coldStorageWorker.ts', { 
        type: 'module' 
      });

      // Set up message handling
      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Cold storage worker error:', error);
      };

      this.isInitialized = true;

      // Load storage index
      await this.loadStorageIndex();

    } catch (error) {
      console.error('Failed to initialize cold storage service:', error);
      throw new Error('Cold storage initialization failed');
    }
  }

  /**
   * Authenticate worker with encryption key
   */
  async authenticate(keyMaterial) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      await this.sendMessage('auth-init', { keyMaterial });
      this.isAuthenticated = true;
    } catch (error) {
      console.error('Cold storage authentication failed:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Load storage index from server
   */
  async loadStorageIndex() {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      const result = await this.sendMessage('load-storage-index');
      this.storageIndex = result.storageIndex;
      return this.storageIndex;
    } catch (error) {
      console.warn('Failed to load storage index:', error);
      // Don't throw - cold storage should degrade gracefully
      this.storageIndex = { totalDocuments: 0, batches: [] };
      return this.storageIndex;
    }
  }

  /**
   * Search cold storage with progressive results
   * AIDEV-NOTE: Integrated with performance monitoring and resource management
   */
  async searchDocuments(query, options = {}, progressCallback = null) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
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
   */
  async getBatch(batchId) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
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
   */
  async getCacheStats() {
    if (!this.isAuthenticated) {
      return {
        cacheSize: 0,
        cachedBatches: 0,
        maxCacheSize: 0
      };
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
   */
  isAvailable() {
    return this.isInitialized && 
           this.isAuthenticated && 
           this.storageIndex && 
           this.storageIndex.batches.length > 0;
  }

  /**
   * Send message to worker and wait for response
   */
  async sendMessage(type, payload = {}, customId = null) {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const id = customId || `msg_${++this.messageId}`;
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        this.searchCallbacks.delete(id);
        reject(new Error('Message timeout'));
      }, 60000); // 60 second timeout for cold storage operations

      this.pendingMessages.set(id, { resolve, reject, timeout });

      this.worker.postMessage({
        type,
        id,
        payload
      });
    });
  }

  /**
   * Handle messages from worker
   */
  handleWorkerMessage(message) {
    const { type, id, payload } = message;

    // Handle progress messages
    if (type === 'cold-search-progress' && id && this.searchCallbacks.has(id)) {
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
      const { resolve, reject, timeout } = this.pendingMessages.get(id);
      clearTimeout(timeout);
      this.pendingMessages.delete(id);

      if (type.endsWith('-error')) {
        reject(new Error(payload.message || 'Unknown worker error'));
      } else {
        resolve(payload);
      }
      return;
    }

    // Handle non-response messages
    switch (type) {
      case 'storage-index-loaded':
        this.storageIndex = payload.storageIndex;
        break;

      case 'storage-index-error':
        console.warn('Storage index loading failed:', payload.message);
        this.storageIndex = { totalDocuments: 0, batches: [] };
        break;

      case 'auth-complete':
        this.isAuthenticated = true;
        break;

      case 'auth-error':
        console.error('Cold storage authentication error:', payload);
        break;

      default:
        console.log('Unhandled cold storage worker message:', message);
    }
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
      activeSearches: this.searchCallbacks.size
    };
  }
}

// AIDEV-NOTE: Export singleton instance for consistent usage across application
export const coldStorageService = new ColdStorageService();