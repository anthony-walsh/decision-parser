<template>
  <div class="search-debug-panel bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 mt-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Search System Diagnostics
      </h3>
      <button 
        @click="toggleExpanded"
        class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        {{ isExpanded ? 'Collapse' : 'Expand' }}
      </button>
    </div>

    <!-- Status Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <!-- Authentication Status -->
      <div class="bg-white dark:bg-gray-700 p-3 rounded border">
        <div class="flex items-center">
          <div :class="authStatusClass" class="w-3 h-3 rounded-full mr-2"></div>
          <span class="font-medium text-gray-900 dark:text-white">Authentication</span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {{ authStatus }}
        </p>
      </div>

      <!-- Cold Storage Status -->
      <div class="bg-white dark:bg-gray-700 p-3 rounded border">
        <div class="flex items-center">
          <div :class="coldStorageStatusClass" class="w-3 h-3 rounded-full mr-2"></div>
          <span class="font-medium text-gray-900 dark:text-white">Cold Storage</span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {{ coldStorageStatus }}
        </p>
      </div>

      <!-- Search Performance -->
      <div class="bg-white dark:bg-gray-700 p-3 rounded border">
        <div class="flex items-center">
          <svg class="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span class="font-medium text-gray-900 dark:text-white">Performance</span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Last search: {{ lastSearchTime }}ms
        </p>
      </div>
    </div>

    <!-- Expanded Details -->
    <div v-if="isExpanded" class="space-y-4">
      <!-- Storage Index Information -->
      <div class="bg-white dark:bg-gray-700 p-4 rounded border">
        <h4 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
          Storage Index Details
        </h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-600 dark:text-gray-400">Total Documents:</span>
            <div class="font-mono">{{ storageInfo.totalDocuments }}</div>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Total Batches:</span>
            <div class="font-mono">{{ storageInfo.totalBatches }}</div>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Encryption Policy:</span>
            <div class="font-mono">{{ storageInfo.encryptionPolicy || 'required' }}</div>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Last Updated:</span>
            <div class="font-mono text-xs">{{ formatDate(storageInfo.lastUpdated) }}</div>
          </div>
        </div>
      </div>

      <!-- Batch Information -->
      <div v-if="batchInfo.length > 0" class="bg-white dark:bg-gray-700 p-4 rounded border">
        <h4 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          Available Batches ({{ batchInfo.length }})
        </h4>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <div 
            v-for="batch in batchInfo" 
            :key="batch.id"
            class="border border-gray-200 dark:border-gray-600 rounded p-3 text-sm"
          >
            <div class="flex justify-between items-start mb-2">
              <span class="font-mono text-blue-600 dark:text-blue-400">{{ batch.id }}</span>
              <div class="flex items-center">
                <div :class="batch.encrypted ? 'bg-green-500' : 'bg-red-500'" class="w-2 h-2 rounded-full mr-1"></div>
                <span class="text-xs">{{ batch.encrypted ? 'Encrypted' : 'Unencrypted' }}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
              <div>Documents: {{ batch.documentCount }}</div>
              <div>Size: {{ batch.size }}</div>
              <div>Keywords: {{ batch.keywordCount }}</div>
            </div>
            <div v-if="batch.keywords.length > 0" class="mt-2">
              <div class="text-xs text-gray-500 mb-1">Keywords:</div>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="keyword in batch.keywords.slice(0, 6)" 
                  :key="keyword"
                  class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-xs rounded"
                >
                  {{ keyword }}
                </span>
                <span v-if="batch.keywords.length > 6" class="text-xs text-gray-500">
                  +{{ batch.keywords.length - 6 }} more
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Search History -->
      <div v-if="searchHistory.length > 0" class="bg-white dark:bg-gray-700 p-4 rounded border">
        <h4 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          Recent Searches
        </h4>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div 
            v-for="search in searchHistory.slice(0, 10)" 
            :key="search.id"
            class="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-600 rounded text-sm"
          >
            <div class="flex-1">
              <span class="font-mono">{{ search.query }}</span>
              <span class="text-gray-500 ml-2">({{ search.results }} results)</span>
            </div>
            <div class="text-xs text-gray-500 flex items-center">
              <span class="mr-2">{{ search.duration }}ms</span>
              <span>{{ formatTime(search.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex space-x-3">
        <button 
          @click="refreshStorageInfo"
          :disabled="isRefreshing"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {{ isRefreshing ? 'Refreshing...' : 'Refresh Storage Info' }}
        </button>
        <button 
          @click="clearSearchHistory"
          :disabled="searchHistory.length === 0"
          class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          Clear Search History
        </button>
        <button 
          @click="downloadDiagnostics"
          class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Download Diagnostics
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStorageStore } from '@/stores';

// Store access
const store = useStorageStore();

// Component state
const isExpanded = ref(false);
const isRefreshing = ref(false);
const lastSearchTime = ref(0);
const searchHistory = ref<Array<{
  id: string;
  query: string;
  results: number;
  duration: number;
  timestamp: Date;
}>>([]);

// Computed properties
const authStatus = computed(() => {
  const authState = store.state.authentication;
  if (authState.isAuthenticated) return 'Authenticated';
  if (authState.isInitialized) return 'Password Required';
  return 'Setup Required';
});

const authStatusClass = computed(() => {
  const authState = store.state.authentication;
  if (authState.isAuthenticated) return 'bg-green-500';
  if (authState.isInitialized) return 'bg-yellow-500';
  return 'bg-red-500';
});

const coldStorageStatus = computed(() => {
  const coldState = store.state.coldStorage;
  if (!coldState.isInitialized) return 'Not Initialized';
  if (!coldState.isAuthenticated) return 'Authentication Required';
  if (coldState.isAvailable) return `Ready (${coldState.stats.totalBatches} batches)`;
  return 'No Data Available';
});

const coldStorageStatusClass = computed(() => {
  const coldState = store.state.coldStorage;
  if (coldState.isAvailable && coldState.isAuthenticated) return 'bg-green-500';
  if (coldState.isInitialized) return 'bg-yellow-500';
  return 'bg-red-500';
});

const storageInfo = computed(() => {
  const coldState = store.state.coldStorage;
  return {
    totalDocuments: coldState.stats.totalDocuments || 0,
    totalBatches: coldState.stats.totalBatches || 0,
    encryptionPolicy: 'required',
    lastUpdated: new Date().toISOString()
  };
});

const batchInfo = computed(() => {
  const coldState = store.state.coldStorage;
  // Extract batch info from storage index if available
  const batches = coldState.storageIndex?.batches || [];
  return batches.map((batch: any) => ({
    id: batch.batchId || 'unknown',
    documentCount: batch.documentCount || 0,
    size: batch.size || '0KB',
    encrypted: batch.encrypted !== false, // Default to true for security
    keywords: batch.keywords || [],
    keywordCount: (batch.keywords || []).length
  }));
});

// Methods
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const refreshStorageInfo = async () => {
  isRefreshing.value = true;
  try {
    // Reload cold storage info
    await store.coldStorage.getCacheStats();
    console.log('[SearchDebugPanel] Storage info refreshed');
  } catch (error) {
    console.error('[SearchDebugPanel] Failed to refresh storage info:', error);
  } finally {
    isRefreshing.value = false;
  }
};

const clearSearchHistory = () => {
  searchHistory.value = [];
  console.log('[SearchDebugPanel] Search history cleared');
};

const downloadDiagnostics = () => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    authStatus: {
      isAuthenticated: store.state.authentication.isAuthenticated,
      isInitialized: store.state.authentication.isInitialized
    },
    coldStorage: {
      isInitialized: store.state.coldStorage.isInitialized,
      isAuthenticated: store.state.coldStorage.isAuthenticated,
      isAvailable: store.state.coldStorage.isAvailable,
      stats: store.state.coldStorage.stats,
      storageIndex: store.state.coldStorage.storageIndex
    },
    searchHistory: searchHistory.value,
    performance: {
      lastSearchTime: lastSearchTime.value,
      searchPerformance: store.state.search.performance
    }
  };

  const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `search-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('[SearchDebugPanel] Diagnostics downloaded');
};

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return 'Invalid Date';
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString();
};

// Search tracking
const trackSearch = (query: string, results: number, duration: number) => {
  searchHistory.value.unshift({
    id: `search-${Date.now()}`,
    query,
    results,
    duration,
    timestamp: new Date()
  });
  
  // Keep only last 20 searches
  if (searchHistory.value.length > 20) {
    searchHistory.value = searchHistory.value.slice(0, 20);
  }
  
  lastSearchTime.value = duration;
};

// Performance monitoring
let performanceObserver: PerformanceObserver | null = null;

onMounted(() => {
  // Set up performance monitoring
  if ('PerformanceObserver' in window) {
    performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('search')) {
          lastSearchTime.value = Math.round(entry.duration);
        }
      }
    });
    
    try {
      performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('[SearchDebugPanel] Performance monitoring not supported:', error);
    }
  }

  // Note: Store subscription would be added here if needed for automatic tracking
  // For now, we rely on manual tracking from the search view component
});

onUnmounted(() => {
  if (performanceObserver) {
    performanceObserver.disconnect();
  }
});

// Expose tracking function for external use
defineExpose({
  trackSearch
});
</script>

<style scoped>
/* AIDEV-NOTE: Use theme variable for consistent font family */
.search-debug-panel {
  font-family: var(--font-family-sans);
}
</style>