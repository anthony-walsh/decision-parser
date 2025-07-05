/**
 * Cold Storage Store Module
 * 
 * Manages cold storage state and operations
 * AIDEV-NOTE: Extracted from stores/index.ts for better modularity
 */

import { reactive, computed } from 'vue';
import type { ColdStorageSearchResult } from '@/types';
import { UserFriendlyErrorFactory } from '@/utils/UserFriendlyError';

// AIDEV-NOTE: Dynamic import helper for cold storage service
let _coldStorageServiceInstance: any = null;
async function getColdStorageService() {
  if (!_coldStorageServiceInstance) {
    const { coldStorageService } = await import('@/services/ColdStorageService');
    _coldStorageServiceInstance = coldStorageService;
  }
  return _coldStorageServiceInstance;
}

// AIDEV-NOTE: Cold storage state interface
export interface ColdStorageState {
  storageIndex: any;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isAvailable: boolean;
  stats: {
    totalDocuments: number;
    totalBatches: number;
    cacheSize: number;
    cachedBatches: number;
  };
  searchProgress: {
    isSearching: boolean;
    message: string;
    totalBatches: number;
    completedBatches: number;
    partialResults: ColdStorageSearchResult[];
  };
}

// AIDEV-NOTE: Reactive cold storage state
export const coldStorageState = reactive<ColdStorageState>({
  storageIndex: null,
  isLoading: false,
  isInitialized: false,
  isAuthenticated: false,
  error: null,
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
    partialResults: []
  }
});

// AIDEV-NOTE: Helper function for stats synchronization (DRY principle)
const syncStorageStats = async (coldStorageService: any): Promise<void> => {
  try {
    if (coldStorageService.storageIndex) {
      coldStorageState.stats.totalDocuments = coldStorageService.storageIndex.totalDocuments || 0;
      coldStorageState.stats.totalBatches = coldStorageService.storageIndex.batches?.length || 0;
      coldStorageState.storageIndex = coldStorageService.storageIndex;
      
      console.log('[ColdStorageStore] Storage stats synced:', {
        totalDocuments: coldStorageState.stats.totalDocuments,
        totalBatches: coldStorageState.stats.totalBatches
      });
    }
  } catch (error) {
    console.error('[ColdStorageStore] Failed to sync storage stats:', error);
  }
};

// AIDEV-NOTE: Cold storage actions
export const useColdStorageStore = () => {
  
  // Computed values
  const totalDocuments = computed(() => coldStorageState.stats.totalDocuments);
  const isLoading = computed(() => coldStorageState.isLoading);
  const isAvailable = computed(() => coldStorageState.isAvailable);
  
  const coldStorageActions = {
    async initialize() {
      try {
        coldStorageState.isLoading = true;
        coldStorageState.error = null;
        
        const coldStorageService = await getColdStorageService();
        await coldStorageService.initialize();
        coldStorageState.isInitialized = true;
        
        // AIDEV-NOTE: Use consolidated stats sync to maintain DRY principle
        await syncStorageStats(coldStorageService);
        coldStorageState.isAvailable = coldStorageState.stats.totalBatches > 0;
        
        console.log('[ColdStorageStore] Cold storage initialized successfully');
        
      } catch (error) {
        console.error('[ColdStorageStore] Cold storage initialization failed:', error);
        
        // AIDEV-NOTE: Use UserFriendlyError for better error handling
        const userFriendlyError = UserFriendlyErrorFactory.storage(
          'initialize cold storage',
          error instanceof Error ? error.message : 'Unknown initialization error',
          error as Error
        );
        
        coldStorageState.error = userFriendlyError.userMessage;
        coldStorageState.isAvailable = false;
        
        console.error('[ColdStorageStore] Cold storage will be unavailable');
        
        // Don't throw - allow app to continue with error state displayed to user
      } finally {
        coldStorageState.isLoading = false;
      }
    },

    async authenticate(keyMaterial: ArrayBuffer) {
      try {
        const coldStorageService = await getColdStorageService();
        await coldStorageService.authenticate(keyMaterial);
        coldStorageState.isAuthenticated = true;
        coldStorageState.isAvailable = true;
        
        // AIDEV-NOTE: Use consolidated stats sync after authentication
        await syncStorageStats(coldStorageService);
        
        console.log('[ColdStorageStore] Cold storage authenticated successfully');
      } catch (error) {
        const userFriendlyError = UserFriendlyErrorFactory.authentication(
          error instanceof Error ? error.message : 'Authentication failed',
          error as Error
        );
        
        coldStorageState.error = userFriendlyError.userMessage;
        coldStorageState.isAuthenticated = false;
        throw userFriendlyError;
      }
    },

    async authenticateWithPassword(password: string) {
      try {
        const coldStorageService = await getColdStorageService();
        await coldStorageService.authenticateWithPassword(password);
        
        coldStorageState.isAuthenticated = true;
        coldStorageState.isAvailable = true;
        
        // AIDEV-NOTE: Use consolidated stats sync after authentication
        await syncStorageStats(coldStorageService);
        
        console.log('[ColdStorageStore] Cold storage password authentication successful');
        
      } catch (error) {
        console.error('[ColdStorageStore] Authentication failed:', error);
        
        const userFriendlyError = UserFriendlyErrorFactory.authentication(
          error instanceof Error ? error.message : 'Password authentication failed',
          error as Error
        );
        
        coldStorageState.error = userFriendlyError.userMessage;
        coldStorageState.isAuthenticated = false;
        throw userFriendlyError;
      }
    },

    async search(query: string, options: any = {}) {
      if (!coldStorageState.isAvailable) {
        return [];
      }
      
      try {
        const coldStorageService = await getColdStorageService();
        
        // Check if authentication is required
        if (coldStorageService.storageIndex) {
          const hasEncryptedBatches = coldStorageService.storageIndex.batches.some((batch: any) => 
            !batch.hasOwnProperty('encrypted') || batch.encrypted !== false
          );
          
          if (hasEncryptedBatches && !coldStorageState.isAuthenticated) {
            console.log('[ColdStorageStore] Cold storage has encrypted batches but not authenticated, skipping search');
            return [];
          }
        }

        // Set up progress callback
        const progressCallback = (progress: any) => {
          coldStorageState.searchProgress = {
            isSearching: true,
            message: progress.message,
            totalBatches: progress.totalBatches,
            completedBatches: progress.completedBatches,
            partialResults: progress.partialResults || []
          };
        };

        coldStorageState.searchProgress.isSearching = true;
        
        const searchResult = await coldStorageService.searchDocuments(query, options, progressCallback);
        
        coldStorageState.searchProgress.isSearching = false;
        return searchResult.results || [];
        
      } catch (error) {
        console.error('[ColdStorageStore] Cold storage search failed:', error);
        
        coldStorageState.searchProgress.isSearching = false;
        
        const userFriendlyError = UserFriendlyErrorFactory.search(
          query,
          error instanceof Error ? error.message : 'Search failed',
          error as Error
        );
        
        throw userFriendlyError;
      }
    },

    async getCacheStats() {
      try {
        const coldStorageService = await getColdStorageService();
        const stats = await coldStorageService.getCacheStats();
        
        coldStorageState.stats.cacheSize = stats.cacheSize;
        coldStorageState.stats.cachedBatches = stats.cachedBatches;
        
        return stats;
      } catch (error) {
        console.error('[ColdStorageStore] Failed to get cache stats:', error);
        return null;
      }
    },

    async clearCache() {
      try {
        const coldStorageService = await getColdStorageService();
        await coldStorageService.clearCache();
        
        // Update stats
        coldStorageState.stats.cacheSize = 0;
        coldStorageState.stats.cachedBatches = 0;
        
        console.log('[ColdStorageStore] Cache cleared successfully');
      } catch (error) {
        console.error('[ColdStorageStore] Failed to clear cache:', error);
        throw error;
      }
    },

    // Reset search progress
    resetSearchProgress() {
      coldStorageState.searchProgress = {
        isSearching: false,
        message: '',
        totalBatches: 0,
        completedBatches: 0,
        partialResults: []
      };
    },

    // Clear error state
    clearError() {
      coldStorageState.error = null;
    },

    // AIDEV-NOTE: Manual stats sync method (uses consolidated helper)
    async syncStorageStats() {
      try {
        const coldStorageService = await getColdStorageService();
        await syncStorageStats(coldStorageService);
      } catch (error) {
        console.error('[ColdStorageStore] Failed to manually sync storage stats:', error);
      }
    },

    // Get storage info
    getStorageInfo() {
      return {
        totalDocuments: coldStorageState.stats.totalDocuments,
        totalBatches: coldStorageState.stats.totalBatches,
        isLoaded: !!coldStorageState.storageIndex,
        isAuthenticated: coldStorageState.isAuthenticated,
        isAvailable: coldStorageState.isAvailable
      };
    }
  };

  return {
    // State
    state: coldStorageState,
    
    // Computed
    totalDocuments,
    isLoading,
    isAvailable,
    
    // Actions
    ...coldStorageActions
  };
};