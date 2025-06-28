/**
 * Vue Store for Simplified Cold Storage Architecture
 * 
 * AIDEV-NOTE: Simplified to remove hot storage complexity - only cold storage and legacy fallback
 * Manages state for documents in cold storage with legacy Dexie fallback
 */

import { computed, reactive } from 'vue';
import { memoryManager } from '@/services/MemoryManager.js';
import { performanceMonitor } from '@/services/PerformanceMonitor.js';
import { browserResourceManager } from '@/utils/BrowserResourceManager.js';
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
    // Convert cold storage results to SearchResult format for compatibility
    const convertedColdResults = storageState.search.results.cold.map((coldResult): SearchResult => ({
      document: {
        id: coldResult.id,
        filename: coldResult.filename,
        size: 0, // Not available in cold storage
        uploadDate: new Date(), // Not available, use current date
        processingStatus: 'completed' as const,
        metadata: coldResult.metadata
      },
      matches: [{
        content: coldResult.snippet,
        matchValue: undefined,
        indices: [],
        score: coldResult.relevance
      }],
      overallScore: coldResult.relevance
    }));
    
    return [
      ...storageState.search.results.legacy,
      ...convertedColdResults
    ];
  });
  
  const isSearchComplete = computed(() => 
    storageState.search.results.isLegacyComplete && storageState.search.results.isColdComplete
  );
  

  // AIDEV-NOTE: Legacy Dexie search actions (fallback for when cold storage not available)
  const legacySearchActions = {
    async search(query: string, options: any = {}) {
      try {
        console.log('[StorageStore] Performing legacy search for:', query);
        const startTime = performance.now();
        
        // Use existing search engine from window if available
        let results: SearchResult[] = [];
        if (window.searchEngine && typeof (window.searchEngine as any).performSearch === 'function') {
          results = await (window.searchEngine as any).performSearch(query, options);
          console.log('[StorageStore] Legacy search returned:', results.length, 'results');
        } else {
          console.warn('[StorageStore] Legacy search engine not available');
        }
        
        const endTime = performance.now();
        storageState.search.performance.legacySearchTime = Math.round(endTime - startTime);
        
        storageState.search.results.legacy = results;
        storageState.search.results.isLegacyComplete = true;
        storageState.search.query = query;
        
        // Add to search history
        if (query && !storageState.search.history.includes(query)) {
          storageState.search.history.unshift(query);
          storageState.search.history = storageState.search.history.slice(0, 20); // Keep last 20
        }
        
        return results;
      } catch (error) {
        console.error('[StorageStore] Legacy search failed:', error);
        storageState.search.results.legacy = [];
        storageState.search.results.isLegacyComplete = true;
        return [];
      }
    }
  };

  // AIDEV-NOTE: Cold storage actions with feature flag checking
  const coldStorageActions = {
    async initialize() {
      // Check if cold storage feature is enabled
      if (!this.isFeatureEnabled()) {
        console.log('[StorageStore] Cold storage feature disabled, skipping initialization');
        storageState.coldStorage.isLoading = false;
        storageState.coldStorage.isAvailable = false;
        return;
      }
      
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
        storageState.coldStorage.error = `Cold storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        storageState.coldStorage.isAvailable = false;
        console.warn('Cold storage initialization failed:', error);
        // Don't throw - cold storage should degrade gracefully
      } finally {
        storageState.coldStorage.isLoading = false;
      }
    },

    // Check if cold storage feature is enabled via ServiceProvider
    isFeatureEnabled() {
      // Try to get ServiceProvider instance if available
      if (typeof window !== 'undefined' && (window as any).serviceProvider) {
        const serviceProvider = (window as any).serviceProvider;
        // Check if ServiceProvider has cold storage feature flag enabled
        const migrationState = serviceProvider.getMigrationState();
        return migrationState?.featureFlags?.useNewColdStorage || false;
      }
      
      // Fallback: check environment variables (always false for now since feature is disabled)
      return false;
    },

    async authenticate(keyMaterial: ArrayBuffer) {
      if (!this.isFeatureEnabled()) {
        console.log('[StorageStore] Cold storage feature disabled, skipping authentication');
        return;
      }
      
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
      if (!this.isFeatureEnabled()) {
        console.log('[StorageStore] Cold storage feature disabled, skipping password authentication');
        return;
      }
      
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
      if (!this.isFeatureEnabled() || !storageState.coldStorage.isAvailable) {
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
        storageState.coldStorage.error = `Cold storage search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        storageState.search.results.cold = [];
        storageState.search.results.isColdComplete = true;
        console.warn('Cold storage search failed:', error);
        return []; // Graceful degradation
      } finally {
        storageState.coldStorage.searchProgress.isSearching = false;
      }
    },

    async loadCacheStats() {
      if (!this.isFeatureEnabled()) {
        return;
      }
      
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
      if (!this.isFeatureEnabled()) {
        return;
      }
      
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
      if (!this.isFeatureEnabled()) {
        return {
          totalDocuments: 0,
          totalBatches: 0,
          isLoaded: false,
          batchSizes: []
        };
      }
      
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
      console.log('[StorageStore] Starting unified search for:', query);
      searchActions.clearResults();
      storageState.search.results.isLoading = true;
      
      const overallStartTime = performance.now();
      
      try {
        // Search legacy storage first for immediate results
        console.log('[StorageStore] Starting legacy search...');
        const legacyPromise = legacySearchActions.search(query, options);
        
        // Search cold storage in parallel if available
        console.log('[StorageStore] Starting cold storage search...', { isAvailable: storageState.coldStorage.isAvailable });
        const coldPromise = storageState.coldStorage.isAvailable 
          ? coldStorageActions.search(query, options)
          : Promise.resolve([]);
        
        // Wait for both searches to complete
        await Promise.allSettled([legacyPromise, coldPromise]);
        
        // Ensure cold storage is marked complete even if search failed
        if (!storageState.search.results.isColdComplete) {
          storageState.search.results.isColdComplete = true;
        }
        
        // Ensure legacy search is marked complete
        if (!storageState.search.results.isLegacyComplete) {
          storageState.search.results.isLegacyComplete = true;
        }
        
        const overallEndTime = performance.now();
        storageState.search.performance.totalSearchTime = Math.round(overallEndTime - overallStartTime);
        console.log('[StorageStore] Unified search completed:', {
          totalTime: storageState.search.performance.totalSearchTime,
          legacyResults: storageState.search.results.legacy.length,
          coldResults: storageState.search.results.cold.length
        });
        
      } catch (error) {
        console.error('[StorageStore] Unified search failed:', error);
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
    legacy: legacySearchActions,
    coldStorage: coldStorageActions,
    search: searchActions,
    auth: authActions,
    performance: performanceActions
  };
};

// AIDEV-NOTE: Dynamic cold storage service access
export { getColdStorageService };