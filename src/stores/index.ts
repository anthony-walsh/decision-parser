/**
 * Vue Store for Hot/Cold Storage Architecture
 * 
 * Manages state for documents across hot and cold storage tiers
 */

import { computed, reactive } from 'vue';
import { HotStorageService } from '@/services/HotStorageService';
import { coldStorageService } from '@/services/ColdStorageService';
import { documentTierManager } from '@/services/DocumentTierManager';
import { memoryManager } from '@/services/MemoryManager.js';
import { performanceMonitor } from '@/services/PerformanceMonitor.js';
import { browserResourceManager } from '@/utils/BrowserResourceManager.js';
import type { Document, SearchResult, ColdStorageSearchResult, DateFilter } from '@/types';

// AIDEV-NOTE: Storage service instances
const hotStorage = new HotStorageService();

// AIDEV-NOTE: Reactive state for storage tiers
export const storageState = reactive({
  // Hot storage state
  hotStorage: {
    documents: [] as Document[],
    isLoading: false,
    isInitialized: false,
    error: null as string | null,
    stats: {
      documentCount: 0,
      indexedCount: 0,
      totalSize: 0
    }
  },
  
  // Cold storage state
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
  
  // Migration state
  migration: {
    isInitialized: false,
    inProgress: false,
    currentMigration: null as any,
    lastMigrationDate: null as Date | null,
    status: {
      totalMigrated: 0,
      totalFailed: 0,
      avgMigrationTime: 0
    },
    currentOperation: {
      migrationId: null as string | null,
      batchId: null as string | null,
      progress: {
        processed: 0,
        total: 0,
        currentDocument: null as string | null
      },
      message: ''
    },
    config: {
      maxHotStorageDocuments: 5000,
      migrationAgeThresholdDays: 90,
      accessThresholdDays: 30,
      batchSize: 100,
      migrationInterval: 24 * 60 * 60 * 1000
    },
    notifications: [] as Array<{
      id: string;
      type: 'info' | 'warning' | 'error' | 'success';
      message: string;
      timestamp: Date;
      read: boolean;
    }>
  },
  
  // Search state
  search: {
    query: '',
    results: {
      hot: [] as SearchResult[],
      cold: [] as ColdStorageSearchResult[],
      isHotComplete: false,
      isColdComplete: false,
      isLoading: false
    },
    filters: {
      dateFilter: { type: 'all' } as DateFilter,
      threshold: 0.5
    },
    history: [] as string[],
    performance: {
      hotSearchTime: 0,
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
    storageState.hotStorage.stats.documentCount + storageState.coldStorage.stats.totalDocuments
  );
  
  const isAnyStorageLoading = computed(() => 
    storageState.hotStorage.isLoading || storageState.coldStorage.isLoading
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
      ...storageState.search.results.hot,
      ...convertedColdResults
    ];
  });
  
  const isSearchComplete = computed(() => 
    storageState.search.results.isHotComplete && storageState.search.results.isColdComplete
  );
  
  const migrationProgress = computed(() => {
    const { processed, total } = storageState.migration.currentOperation.progress;
    return total > 0 ? Math.round((processed / total) * 100) : 0;
  });
  
  const unreadNotifications = computed(() => 
    storageState.migration.notifications.filter(n => !n.read)
  );
  
  const hotStorageUtilization = computed(() => {
    const { documentCount } = storageState.hotStorage.stats;
    const maxDocuments = storageState.migration.config.maxHotStorageDocuments;
    return {
      count: documentCount,
      max: maxDocuments,
      percentage: Math.round((documentCount / maxDocuments) * 100),
      warning: documentCount >= maxDocuments * 0.9,
      critical: documentCount >= maxDocuments
    };
  });

  // AIDEV-NOTE: Hot storage actions
  const hotStorageActions = {
    async initialize() {
      try {
        storageState.hotStorage.isLoading = true;
        storageState.hotStorage.error = null;
        
        await hotStorage.initialize();
        
        storageState.hotStorage.isInitialized = true;
        await hotStorageActions.loadStats();
        
      } catch (error) {
        storageState.hotStorage.error = `Hot storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw error;
      } finally {
        storageState.hotStorage.isLoading = false;
      }
    },

    async addDocument(document: Document, searchIndex: any) {
      try {
        await hotStorage.addDocument(document, searchIndex);
        await hotStorageActions.loadStats();
      } catch (error) {
        storageState.hotStorage.error = `Failed to add document: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw error;
      }
    },

    async search(query: string, options: any = {}) {
      try {
        storageState.search.results.isLoading = true;
        const startTime = performance.now();
        
        const results = await hotStorage.search(query, {
          limit: options.limit || 50,
          dateFilter: storageState.search.filters.dateFilter.type !== 'all' ? storageState.search.filters.dateFilter : undefined,
          threshold: storageState.search.filters.threshold
        });
        
        const endTime = performance.now();
        storageState.search.performance.hotSearchTime = Math.round(endTime - startTime);
        
        storageState.search.results.hot = results;
        storageState.search.results.isHotComplete = true;
        storageState.search.query = query;
        
        // Add to search history
        if (query && !storageState.search.history.includes(query)) {
          storageState.search.history.unshift(query);
          storageState.search.history = storageState.search.history.slice(0, 20); // Keep last 20
        }
        
        return results;
      } catch (error) {
        storageState.hotStorage.error = `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw error;
      } finally {
        storageState.search.results.isLoading = false;
      }
    },

    async loadStats() {
      try {
        const stats = await hotStorage.getStats();
        storageState.hotStorage.stats = stats;
      } catch (error) {
        console.error('Failed to load hot storage stats:', error);
      }
    },

    async clearAll() {
      try {
        storageState.hotStorage.isLoading = true;
        await hotStorage.clearAll();
        storageState.hotStorage.stats = { documentCount: 0, indexedCount: 0, totalSize: 0 };
        storageState.search.results.hot = [];
      } catch (error) {
        storageState.hotStorage.error = `Failed to clear documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw error;
      } finally {
        storageState.hotStorage.isLoading = false;
      }
    },

    async refresh() {
      try {
        await hotStorage.refresh();
        await hotStorageActions.loadStats();
      } catch (error) {
        storageState.hotStorage.error = `Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw error;
      }
    }
  };

  // AIDEV-NOTE: Cold storage actions
  const coldStorageActions = {
    async initialize() {
      try {
        storageState.coldStorage.isLoading = true;
        storageState.coldStorage.error = null;
        
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

    async authenticate(keyMaterial: ArrayBuffer) {
      try {
        await coldStorageService.authenticate(keyMaterial);
        storageState.coldStorage.isAuthenticated = true;
        storageState.coldStorage.isAvailable = true;
      } catch (error) {
        storageState.coldStorage.error = `Cold storage authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        storageState.coldStorage.isAuthenticated = false;
        throw error;
      }
    },

    async search(query: string, options: any = {}) {
      if (!storageState.coldStorage.isAuthenticated || !storageState.coldStorage.isAvailable) {
        storageState.search.results.cold = [];
        storageState.search.results.isColdComplete = true;
        return [];
      }

      try {
        storageState.coldStorage.searchProgress.isSearching = true;
        const startTime = performance.now();
        
        const result = await coldStorageService.searchDocuments(
          query, 
          {
            limit: options.limit || 50,
            dateFilter: storageState.search.filters.dateFilter.type === 'range' ? {
              start: storageState.search.filters.dateFilter.earlierThan || '',
              end: storageState.search.filters.dateFilter.laterThan || ''
            } : undefined
          },
          (progress) => {
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
      try {
        const stats = await coldStorageService.getCacheStats();
        storageState.coldStorage.stats.cacheSize = stats.cacheSize;
        storageState.coldStorage.stats.cachedBatches = stats.cachedBatches;
      } catch (error) {
        console.warn('Failed to load cold storage cache stats:', error);
      }
    },

    async clearCache() {
      try {
        await coldStorageService.clearCache();
        await coldStorageActions.loadCacheStats();
      } catch (error) {
        storageState.coldStorage.error = `Failed to clear cold storage cache: ${error instanceof Error ? error.message : 'Unknown error'}`;
        throw error;
      }
    },

    getStorageInfo() {
      return coldStorageService.getStorageInfo();
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
      storageState.search.results.hot = [];
      storageState.search.results.cold = [];
      storageState.search.results.isHotComplete = false;
      storageState.search.results.isColdComplete = false;
      storageState.search.performance = {
        hotSearchTime: 0,
        coldSearchTime: 0,
        totalSearchTime: 0
      };
    },

    async performUnifiedSearch(query: string, options: any = {}) {
      searchActions.clearResults();
      storageState.search.results.isLoading = true;
      
      const overallStartTime = performance.now();
      
      try {
        // Search hot storage first for immediate results
        const hotPromise = hotStorageActions.search(query, options);
        
        // Search cold storage in parallel if available
        const coldPromise = storageState.coldStorage.isAvailable 
          ? coldStorageActions.search(query, options)
          : Promise.resolve([]);
        
        // Wait for both searches to complete
        await Promise.allSettled([hotPromise, coldPromise]);
        
        // Ensure cold storage is marked complete even if search failed
        if (!storageState.search.results.isColdComplete) {
          storageState.search.results.isColdComplete = true;
        }
        
        const overallEndTime = performance.now();
        storageState.search.performance.totalSearchTime = Math.round(overallEndTime - overallStartTime);
        
      } catch (error) {
        console.error('Unified search failed:', error);
        throw error;
      } finally {
        storageState.search.results.isLoading = false;
      }
    }
  };

  // AIDEV-NOTE: Migration actions
  const migrationActions = {
    async initialize() {
      try {
        await documentTierManager.initialize();
        storageState.migration.isInitialized = true;
        
        // Set up event listeners
        documentTierManager.on('migration-started', (data) => {
          storageState.migration.inProgress = true;
          storageState.migration.currentOperation.migrationId = data.migrationId;
          storageState.migration.currentOperation.message = `Migration started: ${data.reason}`;
          
          migrationActions.addNotification('info', `Migration started: ${data.estimatedDocuments} documents to migrate`);
        });
        
        documentTierManager.on('migration-progress', (data) => {
          storageState.migration.currentOperation.batchId = data.batchId;
          storageState.migration.currentOperation.progress = {
            processed: data.migratedCount || 0,
            total: data.estimatedDocuments || 0,
            currentDocument: null
          };
          storageState.migration.currentOperation.message = `Batch ${data.batchNumber}/${data.totalBatches} processing...`;
        });
        
        documentTierManager.on('migration-completed', (data) => {
          storageState.migration.inProgress = false;
          storageState.migration.lastMigrationDate = new Date();
          storageState.migration.status.totalMigrated += data.migratedCount;
          storageState.migration.status.totalFailed += data.failedCount;
          
          storageState.migration.currentOperation = {
            migrationId: null,
            batchId: null,
            progress: { processed: 0, total: 0, currentDocument: null },
            message: ''
          };
          
          migrationActions.addNotification('success', `Migration completed: ${data.migratedCount} migrated, ${data.failedCount} failed`);
        });
        
        documentTierManager.on('migration-failed', (data) => {
          storageState.migration.inProgress = false;
          storageState.migration.currentOperation.message = `Migration failed: ${data.error}`;
          
          migrationActions.addNotification('error', `Migration failed: ${data.error}`);
        });
        
        documentTierManager.on('error', (data) => {
          migrationActions.addNotification('error', `Migration system error: ${data.message}`);
        });
        
      } catch (error) {
        console.error('Failed to initialize migration system:', error);
        migrationActions.addNotification('error', `Failed to initialize migration system: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async checkMigrationNeed() {
      try {
        await documentTierManager.checkAndTriggerMigration();
      } catch (error) {
        console.error('Migration check failed:', error);
        migrationActions.addNotification('warning', 'Migration check failed');
      }
    },

    async forceMigration() {
      try {
        await documentTierManager.forceMigrationCheck();
      } catch (error) {
        console.error('Force migration failed:', error);
        migrationActions.addNotification('error', 'Force migration failed');
      }
    },

    getMigrationStatus() {
      return documentTierManager.getMigrationStatus();
    },

    updateConfig(newConfig: any) {
      documentTierManager.updateConfig(newConfig);
      storageState.migration.config = { ...storageState.migration.config, ...newConfig };
    },

    addNotification(type: 'info' | 'warning' | 'error' | 'success', message: string) {
      const notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        type,
        message,
        timestamp: new Date(),
        read: false
      };
      
      storageState.migration.notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (storageState.migration.notifications.length > 50) {
        storageState.migration.notifications = storageState.migration.notifications.slice(0, 50);
      }
    },

    markNotificationRead(notificationId: string) {
      const notification = storageState.migration.notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
      }
    },

    clearNotifications() {
      storageState.migration.notifications = [];
    }
  };

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
    migrationProgress,
    unreadNotifications,
    hotStorageUtilization,
    
    // Actions
    hotStorage: hotStorageActions,
    coldStorage: coldStorageActions,
    search: searchActions,
    migration: migrationActions,
    auth: authActions,
    performance: performanceActions
  };
};

// AIDEV-NOTE: Export individual services for direct access when needed
export { hotStorage, coldStorageService, documentTierManager };