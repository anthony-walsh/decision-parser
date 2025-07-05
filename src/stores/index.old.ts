// @ts-nocheck - TypeScript checking disabled for deprecated file
/**
 * Vue Store for Simplified Cold Storage Architecture
 * 
 * AIDEV-NOTE: DEPRECATED - This file is kept for reference only
 * Replaced by modular store architecture in stores/index.ts
 * Will be removed after migration verification is complete
 */

import { computed, reactive } from 'vue';
import { memoryManager } from '@/services/MemoryManager';
import { performanceMonitor } from '@/services/PerformanceMonitor';
import { browserResourceManager } from '@/utils/BrowserResourceManager';
import type { SearchResult, ColdStorageSearchResult, DateFilter } from '@/types';

// AIDEV-NOTE: Dynamic import helper for cold storage service
// Only instantiates when feature flag is enabled
let _coldStorageServiceInstance: any = null;
async function getColdStorageService() {
  if (!_coldStorageServiceInstance) {
    const { coldStorageService } = await import('@/services/ColdStorageService');
    _coldStorageServiceInstance = coldStorageService;
  }
  return _coldStorageServiceInstance;
}

// AIDEV-NOTE: Reactive state for simplified storage architecture
export const storageState = reactive({
  // Cold storage state (primary storage)
  coldStorage: {
    storageIndex: null as any,
    isLoading: false,
    isInitialized: false,
    isAuthenticated: false,
    error: null as string | null,
    isAvailable: false,
    stats: {
      totalDocuments: 0,
      totalBatches: 0,
      cacheSize: 0,
      cachedBatches: 0
    },
    searchProgress: {
      isSearching: false,
      message: '',
      totalBatches: 0,
      completedBatches: 0,
      partialResults: [] as ColdStorageSearchResult[]
    }
  },
  
  // Authentication state
  authentication: {
    isAuthenticated: false,
    isInitialized: false,
    hasChallenge: false
  },
  
  
  // Search state
  search: {
    query: '',
    results: {
      cold: [] as ColdStorageSearchResult[],
      legacy: [] as SearchResult[],
      isColdComplete: false,
      isLegacyComplete: false,
      isLoading: false
    },
    filters: {
      dateFilter: { type: 'all' } as DateFilter,
      threshold: 0.5
    },
    history: [] as string[],
    performance: {
      legacySearchTime: 0,
      coldSearchTime: 0,
      totalSearchTime: 0
    }
  },
  
  // AIDEV-NOTE: Performance and resource monitoring state
  performance: {
    memory: {
      current: 0,
      peak: 0,
      warning: false,
      critical: false,
      lastCleanup: null as Date | null
    },
    alerts: [] as Array<{
      id: string;
      type: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
      timestamp: Date;
      read: boolean;
    }>,
    resources: {
      isOnline: true,
      isVisible: true,
      hasFocus: true,
      wakeLockActive: false,
      batteryLevel: null as number | null,
      batteryCharging: null as boolean | null
    },
    operations: {
      active: [] as Array<{
        id: string;
        type: string;
        description: string;
        startTime: Date;
        progress?: number;
      }>,
      completed: 0,
      failed: 0
    }
  }
});

// AIDEV-NOTE: Computed properties for derived state
export const useStorageStore = () => {
  
  // Computed values
  const totalDocuments = computed(() => 
    storageState.coldStorage.stats.totalDocuments
  );
  
  const isAnyStorageLoading = computed(() => 
    storageState.coldStorage.isLoading
  );
  
  const allSearchResults = computed(() => {
    console.log('[StorageStore] Converting cold storage results to SearchResult format');
    console.log('[StorageStore] Raw cold storage results:', storageState.search.results.cold);
    
    // Convert cold storage results to SearchResult format for compatibility
    const convertedColdResults = storageState.search.results.cold.map((coldResult): SearchResult | null => {
      // AIDEV-NOTE: Defensive programming - ensure required fields exist
      if (!coldResult || typeof coldResult !== 'object') {
        console.warn('[StorageStore] Invalid cold result:', coldResult);
        return null;
      }
      
      console.log('[StorageStore] Processing cold result:', coldResult);
      
      const resultId = coldResult.id || 'unknown';
      const resultFilename = coldResult.filename || 'unknown.pdf';
      
      // AIDEV-NOTE: Create metadata from all appeal-specific fields, excluding search-specific fields
      const searchSpecificFields = ['id', 'filename', 'snippet', 'relevance', 'tier', 'isArchived', 'batchId'];
      const documentMetadata: any = {};
      
      // Copy all cold storage fields to metadata except the search-specific ones
      Object.keys(coldResult).forEach(key => {
        if (!searchSpecificFields.includes(key)) {
          documentMetadata[key] = (coldResult as any)[key];
        }
      });
      
      const convertedResult = {
        id: resultId,
        document: {
          id: resultId,
          filename: resultFilename,
          size: 0, // Not available in cold storage
          uploadDate: new Date(), // Not available, use current date
          processingStatus: 'completed' as const,
          metadata: documentMetadata
        },
        matches: [{
          content: coldResult.snippet || '',
          matchValue: undefined,
          indices: [],
          score: coldResult.relevance || 0
        }],
        overallScore: coldResult.relevance || 0
      };
      
      console.log('[StorageStore] Converted result:', convertedResult);
      return convertedResult;
    }).filter((result): result is SearchResult => result !== null); // Remove any null results
    
    console.log('[StorageStore] Final converted results:', convertedColdResults);
    
    return [
      ...storageState.search.results.legacy,
      ...convertedColdResults
    ];
  });
  
  const isSearchComplete = computed(() => 
    storageState.search.results.isLegacyComplete && storageState.search.results.isColdComplete
  );
  


  // AIDEV-NOTE: Cold storage actions with feature flag checking
  const coldStorageActions = {
    async initialize() {
      // Cold storage always enabled
      
      try {
        storageState.coldStorage.isLoading = true;
        storageState.coldStorage.error = null;
        
        const coldStorageService = await getColdStorageService();
        await coldStorageService.initialize();
        storageState.coldStorage.isInitialized = true;
        
        // Load storage index
        const storageIndex = await coldStorageService.loadStorageIndex();
        storageState.coldStorage.storageIndex = storageIndex;
        storageState.coldStorage.isAvailable = storageIndex.totalBatches > 0;
        
        // Update stats
        storageState.coldStorage.stats.totalDocuments = storageIndex.totalDocuments;
        storageState.coldStorage.stats.totalBatches = storageIndex.totalBatches;
        
      } catch (error) {
        console.error('[StorageStore] ❌ COLD STORAGE INITIALIZATION FAILED');
        console.error('[StorageStore] Cold storage initialization error:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          errorType: error instanceof Error ? error.constructor.name : typeof error
        });
        
        // AIDEV-NOTE: Provide specific error information instead of generic failure
        const errorMessage = `Cold storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        storageState.coldStorage.error = errorMessage;
        storageState.coldStorage.isAvailable = false;
        
        console.error('[StorageStore] Cold storage will be completely unavailable');
        console.error('[StorageStore] Users will see specific error message explaining why search is unavailable');
        console.error('[StorageStore] Possible causes:');
        console.error('[StorageStore] 1. Worker script failed to load');
        console.error('[StorageStore] 2. Storage index file missing or corrupted');
        console.error('[StorageStore] 3. Network connectivity issues');
        console.error('[StorageStore] 4. Browser compatibility problems');
        
        // Don't throw - allow app to continue with error state displayed to user
      } finally {
        storageState.coldStorage.isLoading = false;
      }
    },

    // Feature flags removed - cold storage always enabled

    async authenticate(keyMaterial: ArrayBuffer) {
      // Cold storage always enabled
      
      try {
        const coldStorageService = await getColdStorageService();
        await coldStorageService.authenticate(keyMaterial);
        storageState.coldStorage.isAuthenticated = true;
        storageState.coldStorage.isAvailable = true;
      } catch (error) {
        storageState.coldStorage.error = `Cold storage authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        storageState.coldStorage.isAuthenticated = false;
        throw error;
      }
    },

    async authenticateWithPassword(password: string) {
      // Cold storage always enabled
      
      try {
        const coldStorageService = await getColdStorageService();
        await coldStorageService.authenticateWithPassword(password);
        storageState.coldStorage.isAuthenticated = true;
        storageState.coldStorage.isAvailable = true;
        console.log('[StorageStore] Cold storage password authentication successful');
      } catch (error) {
        storageState.coldStorage.error = `Cold storage password authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        storageState.coldStorage.isAuthenticated = false;
        throw error;
      }
    },

    async search(query: string, options: any = {}) {
      if (!storageState.coldStorage.isAvailable) {
        storageState.search.results.cold = [];
        storageState.search.results.isColdComplete = true;
        return [];
      }
      
      // AIDEV-NOTE: Check if authentication is required based on encrypted batches
      try {
        const coldStorageService = await getColdStorageService();
        if (coldStorageService.storageIndex) {
          const hasEncryptedBatches = coldStorageService.storageIndex.batches.some((batch: any) => 
            !batch.hasOwnProperty('encrypted') || batch.encrypted !== false
          );
          
          if (hasEncryptedBatches && !storageState.coldStorage.isAuthenticated) {
            console.log('[StorageStore] Cold storage has encrypted batches but not authenticated, skipping search');
            storageState.search.results.cold = [];
            storageState.search.results.isColdComplete = true;
            return [];
          }
        }
      } catch (error) {
        console.warn('[StorageStore] Failed to check encryption requirements:', error);
        storageState.search.results.cold = [];
        storageState.search.results.isColdComplete = true;
        return [];
      }

      try {
        storageState.coldStorage.searchProgress.isSearching = true;
        const startTime = performance.now();
        
        const coldStorageService = await getColdStorageService();
        const result = await coldStorageService.searchDocuments(
          query, 
          {
            limit: options.limit || 50,
            dateFilter: storageState.search.filters.dateFilter.type === 'range' ? {
              start: storageState.search.filters.dateFilter.earlierThan || '',
              end: storageState.search.filters.dateFilter.laterThan || ''
            } : undefined
          },
          (progress: any) => {
            // Update progress state
            storageState.coldStorage.searchProgress.message = progress.message;
            storageState.coldStorage.searchProgress.totalBatches = progress.totalBatches;
            storageState.coldStorage.searchProgress.completedBatches = progress.completedBatches;
            storageState.coldStorage.searchProgress.partialResults = progress.partialResults;
          }
        );
        
        const endTime = performance.now();
        storageState.search.performance.coldSearchTime = Math.round(endTime - startTime);
        
        storageState.search.results.cold = result.results;
        storageState.search.results.isColdComplete = true;
        console.log('[StorageStore] Cold storage search completed:', result.results.length, 'results');
        
        return result.results;
      } catch (error) {
        console.error('[StorageStore] ❌ COLD STORAGE SEARCH FAILED');
        console.error('[StorageStore] Search error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          query: query,
          searchTime: performance.now() - startTime
        });
        
        // AIDEV-NOTE: Provide specific error context instead of generic failure
        let errorMessage = `Cold storage search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        // Add specific error context based on error type
        if (error instanceof Error) {
          if (error.message.includes('Authentication required')) {
            errorMessage = 'Search failed: Cold storage authentication required. Please log in first.';
            console.error('[StorageStore] Search failed due to missing authentication');
          } else if (error.message.includes('Storage index not loaded')) {
            errorMessage = 'Search failed: Storage index not available. Check cold storage configuration.';
            console.error('[StorageStore] Search failed due to missing storage index');
          } else if (error.message.includes('Worker')) {
            errorMessage = 'Search failed: Cold storage worker error. Try refreshing the page.';
            console.error('[StorageStore] Search failed due to worker issues');
          } else if (error.message.includes('timeout')) {
            errorMessage = 'Search failed: Request timed out. Try with a simpler query.';
            console.error('[StorageStore] Search failed due to timeout');
          }
        }
        
        storageState.coldStorage.error = errorMessage;
        storageState.search.results.cold = [];
        storageState.search.results.isColdComplete = true;
        
        console.error('[StorageStore] Cold storage search completely failed - no results returned');
        console.error('[StorageStore] User will see specific error message instead of empty results');
        
        // Return empty array but ensure error state is set for UI display
        return [];
      } finally {
        storageState.coldStorage.searchProgress.isSearching = false;
      }
    },

    async loadCacheStats() {
      // Cold storage always enabled
      
      try {
        const coldStorageService = await getColdStorageService();
        const stats = await coldStorageService.getCacheStats();
        storageState.coldStorage.stats.cacheSize = stats.cacheSize;
        storageState.coldStorage.stats.cachedBatches = stats.cachedBatches;
      } catch (error) {
        console.warn('Failed to load cold storage cache stats:', error);
      }
    },

    async clearCache() {
      // Cold storage always enabled
      
      try {
        const coldStorageService = await getColdStorageService();
        await coldStorageService.clearCache();
        await coldStorageActions.loadCacheStats();
      } catch (error) {
        storageState.coldStorage.error = `Failed to clear cold storage cache: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw error;
      }
    },

    async getStorageInfo() {
      // Cold storage always enabled
      
      try {
        const coldStorageService = await getColdStorageService();
        return coldStorageService.getStorageInfo();
      } catch (error) {
        console.warn('Failed to get cold storage info:', error);
        return {
          totalDocuments: 0,
          totalBatches: 0,
          isLoaded: false,
          batchSizes: []
        };
      }
    }
  };

  // AIDEV-NOTE: Search actions
  const searchActions = {
    setQuery(query: string) {
      storageState.search.query = query;
    },

    setDateFilter(dateFilter: DateFilter) {
      storageState.search.filters.dateFilter = dateFilter;
    },

    setThreshold(threshold: number) {
      storageState.search.filters.threshold = threshold;
    },

    clearResults() {
      console.log('[StorageStore] Clearing search results');
      storageState.search.results.legacy = [];
      storageState.search.results.cold = [];
      storageState.search.results.isLegacyComplete = false;
      storageState.search.results.isColdComplete = false;
      storageState.search.performance = {
        legacySearchTime: 0,
        coldSearchTime: 0,
        totalSearchTime: 0
      };
    },

    async performUnifiedSearch(query: string, options: any = {}) {
      console.log('[StorageStore] Starting cold storage search for:', query);
      searchActions.clearResults();
      storageState.search.results.isLoading = true;
      
      const overallStartTime = performance.now();
      
      try {
        // Search cold storage only
        console.log('[StorageStore] Starting cold storage search...', { isAvailable: storageState.coldStorage.isAvailable });
        if (storageState.coldStorage.isAvailable) {
          await coldStorageActions.search(query, options);
        }
        
        // Mark legacy as complete (no legacy search anymore)
        storageState.search.results.isLegacyComplete = true;
        
        // Ensure cold storage is marked complete
        if (!storageState.search.results.isColdComplete) {
          storageState.search.results.isColdComplete = true;
        }
        
        // Add query to search history
        if (query && !storageState.search.history.includes(query)) {
          storageState.search.history.unshift(query);
          storageState.search.history = storageState.search.history.slice(0, 20); // Keep last 20
        }
        
        const overallEndTime = performance.now();
        storageState.search.performance.totalSearchTime = Math.round(overallEndTime - overallStartTime);
        console.log('[StorageStore] Cold storage search completed:', {
          totalTime: storageState.search.performance.totalSearchTime,
          coldResults: storageState.search.results.cold.length
        });
        
      } catch (error) {
        console.error('[StorageStore] Cold storage search failed:', error);
        throw error;
      } finally {
        storageState.search.results.isLoading = false;
      }
    }
  };

  // AIDEV-NOTE: Migration actions
  // AIDEV-NOTE: Removed migration actions - no longer needed with simplified architecture

  // AIDEV-NOTE: Authentication actions (prepared for authentication system)
  const authActions = {
    setAuthenticated(status: boolean) {
      storageState.authentication.isAuthenticated = status;
    },

    setInitialized(status: boolean) {
      storageState.authentication.isInitialized = status;
    },

    setHasChallenge(status: boolean) {
      storageState.authentication.hasChallenge = status;
    }
  };

  // AIDEV-NOTE: Performance monitoring actions
  const performanceActions = {
    updateMemoryStats() {
      const memStats = memoryManager.getMemoryStats();
      storageState.performance.memory.current = memStats.current;
      storageState.performance.memory.peak = memStats.peak;
      storageState.performance.memory.warning = memStats.current > memStats.thresholds.warning;
      storageState.performance.memory.critical = memStats.current > memStats.thresholds.critical;
    },

    addAlert(type: string, message: string, severity: 'info' | 'warning' | 'critical' = 'info') {
      const alert = {
        id: `alert_${Date.now()}_${Math.random()}`,
        type,
        message,
        severity,
        timestamp: new Date(),
        read: false
      };
      
      storageState.performance.alerts.unshift(alert);
      
      // Keep only last 20 alerts
      if (storageState.performance.alerts.length > 20) {
        storageState.performance.alerts = storageState.performance.alerts.slice(0, 20);
      }
    },

    updateResourceStatus() {
      const resourceStatus = browserResourceManager.getResourceStatus();
      storageState.performance.resources.isOnline = resourceStatus.connection?.isOnline ?? true;
      storageState.performance.resources.isVisible = resourceStatus.visibility?.isVisible ?? true;
      storageState.performance.resources.hasFocus = resourceStatus.visibility?.hasFocus ?? true;
      storageState.performance.resources.wakeLockActive = resourceStatus.wakeLock?.isActive ?? false;
      
      if (resourceStatus.battery) {
        storageState.performance.resources.batteryLevel = resourceStatus.battery.level;
        storageState.performance.resources.batteryCharging = resourceStatus.battery.charging;
      }
    },

    trackOperation(type: string, description: string, operationId: string) {
      const operation = {
        id: operationId,
        type,
        description,
        startTime: new Date(),
        progress: 0
      };
      
      storageState.performance.operations.active.push(operation);
    },

    updateOperationProgress(operationId: string, progress: number) {
      const operation = storageState.performance.operations.active.find(op => op.id === operationId);
      if (operation) {
        operation.progress = progress;
      }
    },

    completeOperation(operationId: string, success: boolean = true) {
      const index = storageState.performance.operations.active.findIndex(op => op.id === operationId);
      if (index >= 0) {
        storageState.performance.operations.active.splice(index, 1);
        
        if (success) {
          storageState.performance.operations.completed++;
        } else {
          storageState.performance.operations.failed++;
        }
      }
    },

    markAlertRead(alertId: string) {
      const alert = storageState.performance.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.read = true;
      }
    },

    clearAlerts() {
      storageState.performance.alerts = [];
    },

    recordCleanup() {
      storageState.performance.memory.lastCleanup = new Date();
    },

    // AIDEV-NOTE: Initialize performance monitoring
    async initializePerformanceMonitoring() {
      // Setup memory warning listener
      memoryManager.onMemoryWarning((data: any) => {
        this.addAlert('memory_warning', `Memory usage: ${data.currentMemory}MB`, 'warning');
        this.updateMemoryStats();
      });

      // Setup cleanup listener
      memoryManager.onCleanup((data: any) => {
        this.addAlert('memory_cleanup', `Freed ${data.memoryFreed}MB of memory`, 'info');
        this.recordCleanup();
        this.updateMemoryStats();
      });

      // Setup performance alert listener
      performanceMonitor.onAlert((alert: any) => {
        this.addAlert(alert.type, alert.message, alert.severity);
      });

      // Setup resource change listeners
      browserResourceManager.onVisibilityChange((isVisible: boolean) => {
        storageState.performance.resources.isVisible = isVisible;
        if (!isVisible) {
          this.addAlert('visibility_change', 'Application moved to background', 'info');
        }
      });

      browserResourceManager.onConnectionChange((isOnline: boolean) => {
        storageState.performance.resources.isOnline = isOnline;
        this.addAlert('connection_change', isOnline ? 'Connection restored' : 'Connection lost', 
                     isOnline ? 'info' : 'warning');
      });

      // Start periodic updates
      setInterval(() => {
        this.updateMemoryStats();
        this.updateResourceStatus();
      }, 5000); // Update every 5 seconds
    }
  };

  return {
    // State
    state: storageState,
    
    // Computed
    totalDocuments,
    isAnyStorageLoading,
    allSearchResults,
    isSearchComplete,
    
    // Actions
    coldStorage: coldStorageActions,
    search: searchActions,
    auth: authActions,
    performance: performanceActions
  };
};

// AIDEV-NOTE: Dynamic cold storage service access
export { getColdStorageService };