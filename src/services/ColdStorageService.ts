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
import type { Document, ColdStorageSearchResult } from '../types/index.js';

// AIDEV-NOTE: Enhanced TypeScript interfaces for cold storage operations
export interface ColdStorageWorkerState {
  status: 'not_initialized' | 'initializing' | 'ready' | 'failed';
  lastHeartbeat: number | null;
  initializationStart: number | null;
  initializationDuration: number | null;
  errorCount: number;
  lastError: {
    message: string;
    timestamp: string;
  } | null;
}

export interface DecryptedBatchInfo {
  data: any;
  size: number;
  createdAt: Date;
  lastAccessed: Date;
}

export interface StorageIndex {
  totalDocuments: number;
  batches: Array<{
    batchId: string;
    documentCount: number;
    size: number;
    dateRange: {
      start: string;
      end: string;
    };
  }>;
  error?: string;
}

export interface ColdStorageSearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date';
  sortOrder?: 'asc' | 'desc';
}

export interface ColdStorageSearchResponse {
  results: ColdStorageSearchResult[];
  total: number;
  query: string;
  batchesSearched: number;
  limited?: boolean;
  error?: string;
}

export interface ColdStorageProgressCallback {
  (progress: {
    type: 'progress';
    message: string;
    totalBatches: number;
    completedBatches: number;
    partialResults: ColdStorageSearchResult[];
  }): void;
}

export interface BatchMetadata {
  keywords?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  documentCount?: number;
  created?: string;
  [key: string]: any;
}

export interface ColdStorageServiceState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  hasWorker: boolean;
  hasStorageIndex: boolean;
  totalBatches: number;
  pendingMessages: number;
  activeSearches: number;
  workerState: ColdStorageWorkerState;
}

export interface ColdStorageWorkerMessage {
  type: string;
  id: string;
  payload: any;
}

export interface PendingMessage {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface ColdStorageServiceOptions {
  maxCacheSize?: number;
  messagetTimeout?: number;
  cleanupInterval?: number;
}

export class ColdStorageService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private isAuthenticated = false;
  private messageId = 0;
  private pendingMessages = new Map<string, PendingMessage>();
  public storageIndex: StorageIndex | null = null;
  private searchCallbacks = new Map<string, ColdStorageProgressCallback>();
  private error?: string;
  
  // AIDEV-NOTE: Worker lifecycle tracking with proper typing
  private workerState: ColdStorageWorkerState = {
    status: 'not_initialized',
    lastHeartbeat: null,
    initializationStart: null,
    initializationDuration: null,
    errorCount: 0,
    lastError: null
  };
  
  // AIDEV-NOTE: Memory management integration with proper typing
  private decryptedBatches = new Map<string, DecryptedBatchInfo>();
  private memoryCleanupTimeout: NodeJS.Timeout | null = null;
  private performanceMetrics = {
    searchOperations: 0,
    totalSearchTime: 0,
    decryptionOperations: 0,
    totalDecryptionTime: 0
  };
  
  // Configuration options
  private readonly messageTimeout: number;
  private readonly cleanupInterval: number;
  
  constructor(options: ColdStorageServiceOptions = {}) {
    this.messageTimeout = options.messagetTimeout || 60000; // 60 seconds
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes
    
    // Setup memory management listeners
    this.setupMemoryManagement();
  }

  /**
   * Setup memory management integration
   * AIDEV-NOTE: Integrates with MemoryManager for automatic cleanup
   */
  private setupMemoryManagement(): void {
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
  private async performMemoryCleanup(): Promise<void> {
    console.log('Performing cold storage memory cleanup');
    
    const startTime = performance.now();
    let cleanedMemory = 0;
    
    // Get least recently used batches
    const sortedBatches = Array.from(this.decryptedBatches.entries())
      .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
    
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
  private scheduleMemoryCleanup(): void {
    if (this.memoryCleanupTimeout) {
      clearTimeout(this.memoryCleanupTimeout);
    }
    
    this.memoryCleanupTimeout = setTimeout(() => {
      this.performMemoryCleanup();
      this.scheduleMemoryCleanup(); // Reschedule
    }, this.cleanupInterval);
  }

  /**
   * Track decrypted batch in memory manager
   * AIDEV-NOTE: Register batch with MemoryManager for tracking
   */
  public trackDecryptedBatch(batchId: string, data: any, sizeMB: number): void {
    console.log(`[ColdStorageService] Tracking decrypted batch: ${batchId} (${sizeMB}MB)`);
    
    const batchInfo: DecryptedBatchInfo = {
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
  public accessDecryptedBatch(batchId: string): any {
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
  public async initialize(): Promise<void> {
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
      let lastError: Error | null = null;
      
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
            console.log(`[ColdStorageService] ES module failed for ${workerPath}, trying classic:`, (moduleError as Error).message);
            this.worker = new Worker(workerPath as string);
            console.log(`[ColdStorageService] Worker created successfully with classic mode at: ${workerPath}`);
            workerCreated = true;
            break;
          }
        } catch (error) {
          console.log(`[ColdStorageService] Worker path ${workerPath} failed:`, (error as Error).message);
          lastError = error as Error;
        }
      }
      
      if (!workerCreated) {
        throw new Error(`Failed to create worker with any path. Last error: ${lastError?.message || 'Unknown error'}`);
      }

      // Set up message handling
      this.worker!.onmessage = (event: MessageEvent<ColdStorageWorkerMessage>) => {
        console.log('[ColdStorageService] Received worker message:', event.data.type);
        this.handleWorkerMessage(event.data);
      };

      this.worker!.onerror = (error: ErrorEvent) => {
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
  public async authenticate(keyMaterial: CryptoKey): Promise<void> {
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
      throw new Error(`Authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Authenticate with password for batch-specific key derivation
   * AIDEV-NOTE: New method for batch salt architecture
   */
  public async authenticateWithPassword(password: string): Promise<void> {
    console.log('[ColdStorageService] ===== PASSWORD AUTHENTICATION START =====');
    console.log('[ColdStorageService] Starting password-based authentication process...');
    console.log('[ColdStorageService] Authentication request details:', {
      hasPassword: !!password,
      passwordLength: password ? password.length : 0,
      serviceInitialized: this.isInitialized,
      workerExists: !!this.worker,
      currentAuthState: this.isAuthenticated
    });
    
    if (!this.isInitialized) {
      console.error('[ColdStorageService] ❌ AUTHENTICATION PREREQUISITE FAILURE');
      console.error('[ColdStorageService] Cannot authenticate - service not initialized');
      console.error('[ColdStorageService] Call initialize() before authenticateWithPassword()');
      throw new Error('Service not initialized');
    }

    try {
      console.log('[ColdStorageService] Sending password to worker for batch-specific key derivation...');
      console.log('[ColdStorageService] Worker communication state:', {
        hasWorker: !!this.worker,
        pendingMessages: this.pendingMessages.size,
        workerState: this.workerState
      });
      
      // Send auth-init with password instead of keyMaterial
      const authStartTime = performance.now();
      console.log('[ColdStorageService] Calling sendMessage("auth-init", { password })...');
      const authResult = await this.sendMessage('auth-init', { password });
      const authEndTime = performance.now();
      
      console.log(`[ColdStorageService] Worker authentication response received in ${(authEndTime - authStartTime).toFixed(2)}ms:`, {
        success: authResult.success,
        result: authResult
      });
      
      if (authResult.success) {
        const wasAuthenticated = this.isAuthenticated;
        this.isAuthenticated = true;
        console.log(`[ColdStorageService] ✓ Password authentication successful, service state updated: ${wasAuthenticated} → ${this.isAuthenticated}`);
        console.log('[ColdStorageService] Cold storage service now authenticated for encrypted batch access');
        console.log('[ColdStorageService] ===== PASSWORD AUTHENTICATION SUCCESS =====');
      } else {
        console.error('[ColdStorageService] ❌ WORKER AUTHENTICATION REJECTION');
        console.error('[ColdStorageService] Password authentication failed - worker rejected credentials');
        console.error('[ColdStorageService] This could indicate:');
        console.error('[ColdStorageService] 1. Incorrect password provided');
        console.error('[ColdStorageService] 2. Worker encryption service initialization failed');
        console.error('[ColdStorageService] 3. Worker internal error during authentication');
        this.isAuthenticated = false;
        console.log('[ColdStorageService] ===== PASSWORD AUTHENTICATION FAILED =====');
        throw new Error('Password authentication failed - invalid credentials');
      }
      
    } catch (error) {
      console.error('[ColdStorageService] ===== PASSWORD AUTHENTICATION ERROR =====');
      console.error('[ColdStorageService] Cold storage password authentication failed:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      
      // Ensure authentication state is reset on failure
      this.isAuthenticated = false;
      console.error(`[ColdStorageService] Service authentication state reset to: ${this.isAuthenticated}`);
      console.log('[ColdStorageService] ===== PASSWORD AUTHENTICATION END =====');
      throw new Error(`Password authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Load storage index from server
   * AIDEV-NOTE: Enhanced with detailed logging for storage index loading
   */
  public async loadStorageIndex(): Promise<StorageIndex> {
    console.log('[ColdStorageService] Loading storage index from worker...');
    
    if (!this.isInitialized) {
      console.error('[ColdStorageService] Cannot load storage index - service not initialized');
      throw new Error('Service not initialized');
    }

    try {
      console.log('[ColdStorageService] Requesting storage index from worker...');
      const result = await this.sendMessage('load-storage-index');
      this.storageIndex = result.storageIndex;
      
      if (this.storageIndex) {
        console.log('[ColdStorageService] Storage index loaded:', {
          totalDocuments: this.storageIndex.totalDocuments,
          totalBatches: this.storageIndex.batches?.length || 0,
          batchIds: this.storageIndex.batches?.map(b => b.batchId).slice(0, 5) || []
        });
        
        return this.storageIndex;
      } else {
        throw new Error('Storage index is null after loading');
      }
    } catch (error) {
      console.error('[ColdStorageService] ❌ STORAGE INDEX LOADING FAILED');
      console.error('[ColdStorageService] Failed to load storage index:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // AIDEV-NOTE: Replace graceful degradation with explicit error reporting
      // Storage index loading failure is a critical issue that should be surfaced to user
      this.storageIndex = { totalDocuments: 0, batches: [], error: 'Storage index loading failed' };
      
      // Set service error state for UI to display
      if (!this.error) {
        this.error = `Storage index unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      console.error('[ColdStorageService] Cold storage will be unavailable due to storage index failure');
      console.error('[ColdStorageService] User will see error message instead of empty results');
      
      // Still return something to prevent crashes, but with error information
      return this.storageIndex;
    }
  }

  /**
   * Search cold storage with progressive results
   * AIDEV-NOTE: Always require authentication for cold storage access (encrypted-only policy)
   */
  public async searchDocuments(
    query: string, 
    options: ColdStorageSearchOptions = {}, 
    progressCallback: ColdStorageProgressCallback | null = null
  ): Promise<ColdStorageSearchResponse> {
    console.log('[ColdStorageService] ===== SEARCH DOCUMENTS START =====');
    console.log(`[ColdStorageService] Search request: "${query}"`);
    console.log('[ColdStorageService] Search prerequisites verification:', {
      isAuthenticated: this.isAuthenticated,
      isInitialized: this.isInitialized,
      hasStorageIndex: !!this.storageIndex,
      batchCount: this.storageIndex?.batches?.length || 0,
      hasWorker: !!this.worker,
      workerState: this.workerState.status
    });
    
    // AIDEV-NOTE: Always require authentication - cold storage is encrypted-only
    if (!this.isAuthenticated) {
      console.error('[ColdStorageService] ❌ SEARCH AUTHENTICATION FAILURE');
      console.error('[ColdStorageService] Search attempted without authentication');
      console.error('[ColdStorageService] This indicates authentication was not completed before search');
      console.error('[ColdStorageService] Call authenticateWithPassword() before searchDocuments()');
      throw new Error('Authentication required for cold storage access');
    }
    
    console.log('[ColdStorageService] ✓ Authentication verified for search operation');
    console.log('[ColdStorageService] ===== SEARCH PREREQUISITES VERIFIED =====');

    if (!this.storageIndex || this.storageIndex.batches.length === 0) {
      return {
        results: [],
        total: 0,
        query,
        batchesSearched: 0,
        error: 'No archived documents available'
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
          error: (error as Error).message,
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
        error: (error as Error).message,
        batchesSearched: 0
      };
    }
  }

  /**
   * Get specific batch data (for admin/debugging)
   * AIDEV-NOTE: Always require authentication for batch access (encrypted-only policy)
   */
  public async getBatch(batchId: string): Promise<any> {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for batch access');
    }

    try {
      const result = await this.sendMessage('get-batch', { batchId });
      return result.batchData;
    } catch (error) {
      console.error('Failed to get batch:', error);
      throw new Error(`Batch retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * Clear batch cache
   */
  public async clearCache(): Promise<void> {
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
  public async getCacheStats(): Promise<{ cacheSize: number; cachedBatches: number; maxCacheSize: number }> {
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
  public getStorageInfo(): {
    totalDocuments: number;
    totalBatches: number;
    isLoaded: boolean;
    batchSizes: Array<{
      id: string;
      documentCount: number;
      size: number;
      dateRange: any;
    }>;
  } {
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
  public isAvailable(): boolean {
    return this.isInitialized && 
           this.isAuthenticated && 
           !!this.storageIndex && 
           this.storageIndex.batches.length > 0;
  }
  
  /**
   * Check if cold storage requires authentication (always true for encrypted-only policy)
   * AIDEV-NOTE: Helper method to indicate authentication is always required
   */
  public requiresAuthentication(): boolean {
    return true; // Always true for encrypted-only cold storage
  }

  /**
   * Send message to worker and wait for response
   * AIDEV-NOTE: Enhanced with detailed logging for worker communication
   */
  private async sendMessage(type: string, payload: any = {}, customId?: string): Promise<any> {
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
      }, this.messageTimeout);

      this.pendingMessages.set(id, { resolve, reject, timeout });
      console.log(`[ColdStorageService] Message ${id} added to pending (total pending: ${this.pendingMessages.size})`);

      this.worker!.postMessage({
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
  private handleWorkerMessage(message: ColdStorageWorkerMessage): void {
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
      if (callback) {
        callback({
          type: 'progress',
          message: payload.message,
          totalBatches: payload.totalBatches,
          completedBatches: payload.completedBatches,
          partialResults: payload.partialResults || []
        });
      }
      return;
    }

    // Handle final responses
    if (id && this.pendingMessages.has(id)) {
      console.log(`[ColdStorageService] Processing final response for ${id}:`, { type, success: !type.endsWith('-error') });
      
      const pendingMessage = this.pendingMessages.get(id);
      if (pendingMessage) {
        const { resolve, reject, timeout } = pendingMessage;
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
        this.workerState.initializationDuration = performance.now() - (this.workerState.initializationStart || 0);
        
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
  public async addDocument(document: Document): Promise<void> {
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
   * Add a batch of documents to cold storage
   * AIDEV-NOTE: Proper method for adding multiple documents as an encrypted batch
   */
  public async addBatch(documents: Document[], metadata: BatchMetadata = {}): Promise<{ batchId: string; documentCount: number; success: boolean }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    if (!this.isAuthenticated) {
      throw new Error('Service not authenticated');
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('Documents array is required and must not be empty');
    }

    console.log('[ColdStorageService] Adding batch to cold storage:', {
      documentCount: documents.length,
      totalContentSize: documents.reduce((sum, doc) => sum + ((doc as any).content?.length || 0), 0),
      hasMetadata: !!metadata
    });

    try {
      // Generate unique batch ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const batchId = `import-batch-${timestamp}-${Math.random().toString(36).substr(2, 8)}`;
      
      // Extract keywords from document content for batch metadata
      const allContent = documents.map(doc => (doc as any).content || '').join(' ').toLowerCase();
      const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'throughout', 'alongside', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those'];
      
      const words = allContent.split(/\s+/)
        .filter(word => word.length >= 3)
        .filter(word => !commonWords.includes(word))
        .filter(word => /^[a-zA-Z]+$/.test(word));
      
      const wordCounts: Record<string, number> = {};
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
      
      const keywords = Object.entries(wordCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .map(([word]) => word);

      // Calculate date range from documents
      const dates = documents
        .map(doc => (doc as any).date || (doc as any).created_at || doc.uploadDate)
        .filter(date => date)
        .map(date => new Date(date))
        .filter(date => !isNaN(date.getTime()));
      
      const dateRange = dates.length > 0 ? {
        start: new Date(Math.min(...dates.map(d => d.getTime()))).toISOString(),
        end: new Date(Math.max(...dates.map(d => d.getTime()))).toISOString()
      } : {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      };

      // Prepare batch for worker
      const batchData = {
        batchId,
        documents,
        metadata: {
          keywords,
          dateRange,
          documentCount: documents.length,
          created: new Date().toISOString(),
          ...metadata
        }
      };

      // Send to worker for encryption and storage
      const result = await this.sendMessage('create-batch', batchData);
      
      if (result.success) {
        console.log('[ColdStorageService] Batch created successfully:', {
          batchId: result.batchId,
          documentCount: documents.length,
          encrypted: true
        });
        
        return {
          batchId: result.batchId,
          documentCount: documents.length,
          success: true
        };
      } else {
        throw new Error(result.error || 'Failed to create batch');
      }
      
    } catch (error) {
      console.error('[ColdStorageService] Failed to add batch:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.memoryCleanupTimeout) {
      clearTimeout(this.memoryCleanupTimeout);
      this.memoryCleanupTimeout = null;
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
  public getState(): ColdStorageServiceState {
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
  public getWorkerStatus(): {
    state: ColdStorageWorkerState;
    hasWorker: boolean;
    pendingMessages: number;
    activeSearches: number;
    memoryStats: {
      decryptedBatches: number;
      lastCleanup: string;
    };
  } {
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