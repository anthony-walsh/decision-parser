/**
 * Unified Store Module
 * 
 * Combines focused store modules for a clean, maintainable architecture
 * AIDEV-NOTE: Refactored from monolithic stores/index.ts for better modularity
 */

import { computed } from 'vue';
import { useAuthenticationStore } from './authentication';
import { useColdStorageStore } from './coldStorage';
import { useSearchStore } from './search';
import { usePerformanceStore } from './performance';

// AIDEV-NOTE: Main store composable that combines all focused modules
export const useStorageStore = () => {
  // Initialize all store modules
  const auth = useAuthenticationStore();
  const coldStorage = useColdStorageStore();
  const search = useSearchStore();
  const performance = usePerformanceStore();
  
  // AIDEV-NOTE: Computed properties that combine data from multiple stores
  const totalDocuments = computed(() => coldStorage.totalDocuments.value);
  
  const isAnyStorageLoading = computed(() => coldStorage.isLoading.value);
  
  const allSearchResults = computed(() => search.allSearchResults.value);
  
  const isSearchComplete = computed(() => search.isSearchComplete.value);
  
  // AIDEV-NOTE: Global actions that coordinate between stores
  const globalActions = {
    // Initialize all stores
    async initialize() {
      try {
        // Initialize in order of dependency
        await auth.initialize();
        await coldStorage.initialize();
        await performance.initializePerformanceMonitoring();
        
        console.log('[StorageStore] All stores initialized successfully');
      } catch (error) {
        console.error('[StorageStore] Store initialization failed:', error);
        throw error;
      }
    },

    // Perform unified search across all storage tiers
    async performUnifiedSearch(query: string, options: any = {}) {
      if (!query.trim()) {
        search.resetResults();
        return [];
      }

      try {
        // Add to search history
        search.addToHistory(query);
        search.setQuery(query);
        search.setLoading(true);
        search.resetResults();

        const searchStartTime = window.performance.now();
        const operationId = performance.addOperation('search', `Searching for "${query}"`);

        // Search cold storage if available
        if (coldStorage.isAvailable.value) {
          try {
            const coldStartTime = window.performance.now();
            
            const coldResults = await coldStorage.search(query, options);
            const coldDuration = window.performance.now() - coldStartTime;
            
            search.setColdResults(coldResults, true);
            search.recordPerformance('cold', coldDuration);
            
            performance.updateOperationProgress(operationId, 100);
            
          } catch (error) {
            console.error('[StorageStore] Cold storage search failed:', error);
            search.setColdResults([], true);
            performance.addAlert('search_error', `Cold storage search failed: ${error}`, 'warning');
          }
        } else {
          // Mark cold search as complete if not available
          search.setColdResults([], true);
        }

        // Mark legacy search as complete (no legacy storage in current architecture)
        search.setLegacyResults([], true);

        const totalDuration = window.performance.now() - searchStartTime;
        search.recordPerformance('total', totalDuration);

        performance.completeOperation(operationId, true);
        
        return allSearchResults.value;

      } catch (error) {
        console.error('[StorageStore] Unified search failed:', error);
        search.resetResults();
        throw error;
      } finally {
        search.setLoading(false);
      }
    },

    // Authenticate with password
    async authenticateWithPassword(password: string) {
      try {
        auth.setHasChallenge(true);
        
        await coldStorage.authenticateWithPassword(password);
        
        auth.setAuthenticated(true);
        performance.addAlert('authentication', 'Successfully authenticated', 'info');
        
        console.log('[StorageStore] Authentication successful');
        
      } catch (error) {
        auth.setAuthenticated(false);
        console.error('[StorageStore] Authentication failed:', error);
        throw error;
      }
    },

    // Reset all stores to initial state
    resetAll() {
      auth.reset();
      search.resetResults();
      coldStorage.clearError();
      coldStorage.resetSearchProgress();
      performance.clearAlerts();
      
      console.log('[StorageStore] All stores reset');
    },

    // Get comprehensive status across all stores
    getStatus() {
      return {
        authentication: auth.getStatus(),
        coldStorage: coldStorage.getStorageInfo(),
        search: search.getSearchStats(),
        performance: performance.getPerformanceSummary(),
        global: {
          totalDocuments: totalDocuments.value,
          isLoading: isAnyStorageLoading.value,
          isSearchComplete: isSearchComplete.value,
          resultCount: allSearchResults.value.length
        }
      };
    },

    // Export all store data for debugging/analysis
    exportAllData() {
      return {
        authentication: auth.state,
        coldStorage: coldStorage.state,
        search: search.exportSearchState(),
        performance: performance.exportPerformanceData(),
        timestamp: new Date().toISOString()
      };
    }
  };

  // AIDEV-NOTE: Return combined interface with all functionality
  return {
    // State (from individual stores)
    state: {
      authentication: auth.state,
      coldStorage: coldStorage.state,
      search: search.state,
      performance: performance.state
    },
    
    // Computed (global computed properties)
    totalDocuments,
    isAnyStorageLoading,
    allSearchResults,
    isSearchComplete,
    
    // Actions (organized by store)
    auth: {
      initialize: auth.initialize,
      setAuthenticated: auth.setAuthenticated,
      setHasChallenge: auth.setHasChallenge,
      setInitialized: auth.setInitialized,
      reset: auth.reset,
      getStatus: auth.getStatus
    },
    
    coldStorage: {
      initialize: coldStorage.initialize,
      authenticate: coldStorage.authenticate,
      authenticateWithPassword: coldStorage.authenticateWithPassword,
      search: coldStorage.search,
      getCacheStats: coldStorage.getCacheStats,
      clearCache: coldStorage.clearCache,
      resetSearchProgress: coldStorage.resetSearchProgress,
      clearError: coldStorage.clearError,
      getStorageInfo: coldStorage.getStorageInfo
    },
    
    search: {
      setQuery: search.setQuery,
      addToHistory: search.addToHistory,
      clearHistory: search.clearHistory,
      setFilters: search.setFilters,
      setColdResults: search.setColdResults,
      setLegacyResults: search.setLegacyResults,
      addPartialColdResults: search.addPartialColdResults,
      setLoading: search.setLoading,
      resetResults: search.resetResults,
      recordPerformance: search.recordPerformance,
      getSearchStats: search.getSearchStats,
      filterByDate: search.filterByDate,
      filterByRelevance: search.filterByRelevance,
      getFilteredResults: search.getFilteredResults,
      exportSearchState: search.exportSearchState
    },
    
    performance: {
      addAlert: performance.addAlert,
      markAlertRead: performance.markAlertRead,
      clearAlerts: performance.clearAlerts,
      cleanupOldAlerts: performance.cleanupOldAlerts,
      updateMemoryStats: performance.updateMemoryStats,
      updateResourceStatus: performance.updateResourceStatus,
      addOperation: performance.addOperation,
      updateOperationProgress: performance.updateOperationProgress,
      completeOperation: performance.completeOperation,
      forceMemoryCleanup: performance.forceMemoryCleanup,
      recordCleanup: performance.recordCleanup,
      initializePerformanceMonitoring: performance.initializePerformanceMonitoring,
      getPerformanceSummary: performance.getPerformanceSummary,
      exportPerformanceData: performance.exportPerformanceData
    },
    
    // Global actions
    ...globalActions
  };
};

// AIDEV-NOTE: Export individual stores for direct access if needed
export { useAuthenticationStore } from './authentication';
export { useColdStorageStore } from './coldStorage';
export { useSearchStore } from './search';
export { usePerformanceStore } from './performance';

// AIDEV-NOTE: Export types for external use
export type { AuthenticationState } from './authentication';
export type { ColdStorageState } from './coldStorage';
export type { SearchState } from './search';
export type { PerformanceState, PerformanceAlert, PerformanceOperation } from './performance';