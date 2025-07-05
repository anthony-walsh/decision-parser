<template>
  <!-- AIDEV-NOTE: Refactored unified search view using focused sub-components -->
  <div class="min-h-screen bg-gray-900 text-white">
    <!-- Search Header -->
    <SearchHeader 
      v-model:search-query="searchQuery"
      :is-importing="isImporting"
      @search="performSearch"
      @import="showImportModal = true"
    />

    <!-- Search Controls -->
    <SearchControls
      v-model:search-threshold="searchThreshold"
      v-model:date-filter="dateFilter"
      v-model:metadata-filters="metadataFilters"
      :filter-options="filterOptions"
    />

    <!-- Authentication Required Modal -->
    <div v-if="!isAuthenticated" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4">
        <div class="p-6 text-center">
          <div class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">Authentication Required</h3>
          
          <!-- AIDEV-NOTE: Show specific authentication state for debugging -->
          <div class="text-sm text-gray-400 mb-3 text-left">
            <div class="flex justify-between">
              <span>General Authentication:</span>
              <span :class="isGeneralAuthenticated ? 'text-green-400' : 'text-red-400'">
                {{ isGeneralAuthenticated ? '✓ Complete' : '✗ Required' }}
              </span>
            </div>
            <div class="flex justify-between">
              <span>Cold Storage Access:</span>
              <span :class="isColdStorageAuthenticated ? 'text-green-400' : 'text-red-400'">
                {{ isColdStorageAuthenticated ? '✓ Complete' : '✗ Required' }}
              </span>
            </div>
          </div>
          
          <p class="text-gray-300 mb-4">
            {{ !isGeneralAuthenticated ? 'Please authenticate to access the search functionality.' : 'Cold storage authentication required for encrypted document access.' }}
          </p>
          <button 
            @click="showAuthenticationModal"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <SearchResults
      v-if="isAuthenticated"
      :results="filteredResults"
      :is-loading="isLoading"
      :search-error="searchError"
      :search-query="searchQuery"
      :search-time="searchTime"
      v-model:current-page="currentPage"
      :results-per-page="resultsPerPage"
      :search-status-message="searchStatusMessage"
      :opening-document="openingDocument"
      @view-document="viewDocument"
      @hide-document="hideDocument"
    />

    <!-- Import Modal - Only in production mode -->
    <ImportModal
      v-if="isImportEnabled"
      :show="showImportModal"
      :is-importing="isImporting"
      :import-progress="importProgress"
      @close="showImportModal = false"
      @start-import="startImport"
      @cancel-import="cancelImport"
    />

    <!-- Search Stats Footer -->
    <SearchStats
      :document-count="documentCount"
      :indexed-count="indexedCount"
      :storage-info="storageInfo"
      :search-debug-info="searchDebugInfo"
      @toggle-debug="handleDebugToggle"
    />

    <!-- Performance Indicator -->
    <PerformanceIndicator />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStorageStore } from '@/stores';
import type { DateFilter, SearchResult, MetadataFilters, FilterOptions } from '@/types';
import { isImportEnabled as getIsImportEnabled } from '@/utils/environment';

// AIDEV-NOTE: Using dependency injection for services
import { useSearchHistoryService, useLogger } from '@/composables/useServices';

// Import appeal import service
import { appealImportService } from '@/services/AppealImportService';

// Import error handling system
import { UserFriendlyErrorFactory } from '@/utils/UserFriendlyError';

// Import components
import SearchHeader from '@/components/SearchHeader.vue';
import SearchControls from '@/components/SearchControls.vue';
import SearchResults from '@/components/SearchResults.vue';
import ImportModal from '@/components/ImportModal.vue';
import SearchStats from '@/components/SearchStats.vue';
import PerformanceIndicator from '@/components/PerformanceIndicator.vue';

// Store and routing
const store = useStorageStore();
const route = useRoute();

// AIDEV-NOTE: Injected services using DI container
const searchHistoryService = useSearchHistoryService();
const logger = useLogger();
// Note: coldStorageService accessed through store for now - gradual migration

// Authentication state
// AIDEV-NOTE: Both general auth and cold storage auth must be verified for search
const isAuthenticated = computed(() => 
  store.state.authentication.isAuthenticated && store.state.coldStorage.isAuthenticated
);

// Separate computed properties for debugging authentication state
const isGeneralAuthenticated = computed(() => store.state.authentication.isAuthenticated);
const isColdStorageAuthenticated = computed(() => store.state.coldStorage.isAuthenticated);

// Search state
const searchQuery = ref('');
const results = ref<SearchResult[]>([]);
const isLoading = ref(false);
const searchTime = ref(0);
const searchError = ref<string | null>(null);
const searchStatusMessage = ref('');

// Hidden documents state
const hiddenDocuments = ref<Set<string>>(new Set());

// Document viewing state
const openingDocument = ref<string | null>(null);

// UI state
const showImportModal = ref(false);
const isImporting = ref(false);
const currentPage = ref(1);
const resultsPerPage = 20;

// Import progress
const importProgress = ref<{
  stage: string;
  message: string;
  processed: number;
  total: number;
  errors: string[];
}>({
  stage: '',
  message: '',
  processed: 0,
  total: 0,
  errors: []
});

// Document stats
const documentCount = ref(0);
const indexedCount = ref(0);

// Search configuration
const searchThreshold = ref(0.6);
const dateFilter = ref<DateFilter>({
  type: 'all',
  laterThan: '',
  earlierThan: '',
  from: '',
  to: ''
});

const metadataFilters = ref<MetadataFilters>({
  lpaNames: [],
  caseTypes: [],
  caseOfficers: [],
  procedures: [],
  statuses: [],
  decisionOutcomes: []
});

const filterOptions = ref<FilterOptions>({
  lpaNames: [],
  caseTypes: [],
  caseOfficers: [],
  procedures: [],
  statuses: [],
  decisionOutcomes: []
});

// Debug info
const searchDebugInfo = ref<any>(null);

// Computed properties
const storageInfo = computed(() => {
  const auth = store.state.authentication.isAuthenticated;
  const cold = store.state.coldStorage.isAuthenticated;
  return auth && cold ? 'Cold Storage Ready' : 'Storage Initializing';
});

// Filter out hidden documents
const filteredResults = computed(() => {
  return results.value.filter(result => {
    const documentId = result.document?.id || result.id;
    return !hiddenDocuments.value.has(documentId);
  });
});

// Environment-based functionality
const isImportEnabled = computed(() => getIsImportEnabled());

// Methods
const performSearch = async () => {
  console.log('[UnifiedSearchView] ===== SEARCH REQUEST START =====');
  console.log('[UnifiedSearchView] Search request details:', {
    query: searchQuery.value.trim(),
    queryLength: searchQuery.value.trim().length,
    generalAuth: isGeneralAuthenticated.value,
    coldStorageAuth: isColdStorageAuthenticated.value,
    combinedAuth: isAuthenticated.value
  });
  
  if (!searchQuery.value.trim()) {
    console.log('[UnifiedSearchView] Search aborted: empty query');
    return;
  }
  
  if (!isAuthenticated.value) {
    console.error('[UnifiedSearchView] ❌ SEARCH AUTHENTICATION FAILURE');
    console.error('[UnifiedSearchView] Search blocked due to authentication requirements');
    console.error('[UnifiedSearchView] Authentication state breakdown:', {
      generalAuth: isGeneralAuthenticated.value,
      coldStorageAuth: isColdStorageAuthenticated.value,
      required: 'Both must be true for search to proceed'
    });
    
    if (!isGeneralAuthenticated.value) {
      console.error('[UnifiedSearchView] General app authentication missing - user needs to log in');
    }
    
    if (!isColdStorageAuthenticated.value) {
      console.error('[UnifiedSearchView] Cold storage authentication missing - encrypted batch access not available');
    }
    
    return;
  }

  console.log('[UnifiedSearchView] ✓ Authentication verified, proceeding with search:', searchQuery.value);
  
  // Clear hidden documents for new search
  hiddenDocuments.value.clear();
  isLoading.value = true;
  searchError.value = null;
  searchStatusMessage.value = 'Initializing search...';
  
  const startTime = performance.now();

  try {
    // Perform search using store
    searchStatusMessage.value = 'Searching documents...';
    await store.performUnifiedSearch(
      searchQuery.value,
      { threshold: searchThreshold.value }
    );

    // Use the converted results from store (proper SearchResult structure)
    results.value = store.allSearchResults.value;
    searchTime.value = Math.round(performance.now() - startTime);
    currentPage.value = 1; // Reset to first page
    
    // Save search to history after getting results
    await searchHistoryService.addSearchHistory(searchQuery.value, results.value.length);
    
    console.log(`[UnifiedSearchView] Search completed: ${results.value.length} results in ${searchTime.value}ms`);
    
    // Log successful search
    logger.info('Search completed', {
      query: searchQuery.value,
      resultCount: results.value.length,
      searchTime: searchTime.value,
      threshold: searchThreshold.value
    });

  } catch (error) {
    console.error('[UnifiedSearchView] Search failed:', error);
    searchError.value = error instanceof Error ? error.message : 'Search failed';
    results.value = [];
    searchTime.value = Math.round(performance.now() - startTime);
    
    // Log search error
    logger.error('Search failed', {
      query: searchQuery.value,
      error: searchError.value,
      searchTime: searchTime.value
    });
  } finally {
    isLoading.value = false;
    searchStatusMessage.value = '';
  }
};

const startImport = async (config: { mode: string; batchSize: number }) => {
  console.log('[UnifiedSearchView] Starting import with config:', config);
  
  if (!isAuthenticated.value) {
    logger.error('Cannot start import: not authenticated');
    return;
  }
  
  isImporting.value = true;
  
  try {
    // Initialize the appeal import service with cold storage
    const coldStorageService = store.coldStorage;
    await appealImportService.initialize(coldStorageService);
    
    // Set up progress callback to update UI
    appealImportService.setProgressCallback((progress) => {
      importProgress.value = {
        stage: progress.stage,
        message: progress.message,
        processed: progress.processed,
        total: progress.total,
        errors: progress.errors
      };
    });
    
    // Configure import options based on mode
    const importOptions = {
      batchSize: config.batchSize,
      concurrencyLimit: config.mode === 'sample' ? 3 : 5,
      useFileSystem: false // Use cold storage mode
    };
    
    // Start the import process
    console.log('[UnifiedSearchView] Starting appeal import with options:', importOptions);
    const importStats = await appealImportService.startImport(importOptions);
    
    console.log('[UnifiedSearchView] Import completed successfully:', importStats);
    logger.info('Import completed successfully', {
      mode: config.mode,
      batchSize: config.batchSize,
      stats: importStats
    });
    
    // Close modal and refresh document counts
    showImportModal.value = false;
    await updateDocumentCounts();
    
    // Log successful import
    logger.info('Document counts updated after import', {
      documentCount: documentCount.value,
      indexedCount: indexedCount.value
    });
    
  } catch (error) {
    console.error('[UnifiedSearchView] Import failed:', error);
    logger.error('Import failed', {
      mode: config.mode,
      batchSize: config.batchSize,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    importProgress.value.errors.push(`Import failed: ${errorMessage}`);
    
    // Keep modal open to show error state
  } finally {
    isImporting.value = false;
  }
};

const cancelImport = async () => {
  console.log('[UnifiedSearchView] Import cancellation requested');
  
  try {
    // Stop the import service
    await appealImportService.stopImport();
    logger.info('Import cancelled successfully');
  } catch (error) {
    console.error('[UnifiedSearchView] Error cancelling import:', error);
    logger.error('Failed to cancel import', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    isImporting.value = false;
    showImportModal.value = false;
    console.log('[UnifiedSearchView] Import cancelled');
  }
};

const viewDocument = (document: any) => {
  console.log('[UnifiedSearchView] View document request:', document.id);
  
  // Set loading state
  openingDocument.value = document.id;
  
  try {
    // Extract document URL from various possible fields
    let documentUrl: string | null = null;
    
    // Try different ways the URL might be stored
    if (document.doc_link_span) {
      documentUrl = document.doc_link_span;
    } else if (document.url) {
      documentUrl = document.url;
    } else if (document.link) {
      documentUrl = document.link;
    } else if (document.metadata?.url) {
      documentUrl = document.metadata.url;
    } else if (document.metadata?.doc_link_span) {
      documentUrl = document.metadata.doc_link_span;
    }
    
    if (documentUrl) {
      console.log('[UnifiedSearchView] Opening document URL:', documentUrl);
      
      // Ensure URL is properly formatted
      let finalUrl = documentUrl;
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `https://${finalUrl}`;
      }
      
      // Open in new tab
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
      
      logger.info('Document opened successfully', {
        documentId: document.id,
        filename: document.filename,
        url: finalUrl
      });
      
      // Clear loading state after a short delay to show user the action succeeded
      setTimeout(() => {
        openingDocument.value = null;
      }, 500);
    } else {
      // Document URL not available
      console.warn('[UnifiedSearchView] Document URL not found for:', document.id);
      logger.warn('Document URL not available', {
        documentId: document.id,
        filename: document.filename,
        availableFields: Object.keys(document)
      });
      
      // Show user-friendly error message using UserFriendlyError system
      const error = UserFriendlyErrorFactory.application(
        'Document Not Available',
        'This document doesn\'t have an online version available. It may only exist in physical archives.',
        {
          operation: 'view-document',
          component: 'UnifiedSearchView',
          userAction: 'view document online'
        }
      );
      console.error(error);
      
      // For now, show alert - in future this could integrate with a toast/notification system
      alert(error.userMessage);
      
      // Clear loading state
      openingDocument.value = null;
    }
  } catch (error) {
    console.error('[UnifiedSearchView] Error opening document:', error);
    logger.error('Failed to open document', {
      documentId: document.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Show user-friendly error using UserFriendlyError system
    const userError = UserFriendlyErrorFactory.application(
      'Unable to Open Document',
      'There was a problem opening the document. Please try again in a moment.',
      {
        operation: 'view-document',
        component: 'UnifiedSearchView',
        userAction: 'open document link',
        technicalDetails: error instanceof Error ? error.message : 'Unknown error'
      }
    );
    console.error(userError);
    alert(userError.userMessage);
  } finally {
    // Clear loading state
    openingDocument.value = null;
  }
};

const hideDocument = (documentId: string) => {
  console.log('[UnifiedSearchView] Hide document:', documentId);
  hiddenDocuments.value.add(documentId);
  logger.info('Document hidden', { documentId, totalHidden: hiddenDocuments.value.size });
};

const handleDebugToggle = (show: boolean) => {
  // Handle debug panel toggle
  console.log('[UnifiedSearchView] Debug panel toggled:', show);
};

const showAuthenticationModal = () => {
  // Call the global showAuthentication function defined in App.vue
  if (typeof window !== 'undefined' && window.showAuthentication) {
    window.showAuthentication(true); // Pass true to indicate this is for setup
  }
};

const updateDocumentCounts = async () => {
  try {
    console.log('[UnifiedSearchView] Updating document counts...');
    console.log('[UnifiedSearchView] Cold storage state:', {
      isAuthenticated: store.state.coldStorage.isAuthenticated,
      isAvailable: store.state.coldStorage.isAvailable,
      stats: store.state.coldStorage.stats,
      storageIndex: store.state.coldStorage.storageIndex
    });
    
    // Get counts from cold storage service directly if available
    if (store.state.coldStorage.isAuthenticated && store.state.coldStorage.isAvailable) {
      const storageInfo = await store.coldStorage.getStorageInfo();
      console.log('[UnifiedSearchView] Cold storage info:', storageInfo);
      
      documentCount.value = storageInfo.totalDocuments || 0;
      indexedCount.value = storageInfo.totalDocuments || 0; // For now, assume all documents are indexed
      
      console.log('[UnifiedSearchView] Document counts updated:', {
        documentCount: documentCount.value,
        indexedCount: indexedCount.value
      });
    } else {
      // Fallback to store stats
      const stats = store.state.coldStorage.stats;
      documentCount.value = stats.totalDocuments || 0;
      indexedCount.value = stats.totalDocuments || 0;
      
      console.log('[UnifiedSearchView] Document counts from store stats:', {
        documentCount: documentCount.value,
        indexedCount: indexedCount.value,
        authenticated: store.state.coldStorage.isAuthenticated,
        available: store.state.coldStorage.isAvailable
      });
    }
  } catch (error) {
    console.error('[UnifiedSearchView] Failed to update document counts:', error);
  }
};

const loadFilterOptions = async () => {
  try {
    // Placeholder for future filter options loading
    filterOptions.value = {
      lpaNames: [],
      caseTypes: [],
      caseOfficers: [],
      procedures: [],
      statuses: [],
      decisionOutcomes: []
    };
  } catch (error) {
    console.error('[UnifiedSearchView] Failed to load filter options:', error);
  }
};

// Watchers
watch(() => route.query.q, (newQuery) => {
  if (typeof newQuery === 'string' && newQuery.trim()) {
    searchQuery.value = newQuery.trim();
    performSearch();
  }
}, { immediate: true });

// Watch for authentication completion to update document counts
watch(() => store.state.coldStorage.isAuthenticated, (isAuthenticated) => {
  console.log('[UnifiedSearchView] Cold storage authentication changed:', isAuthenticated);
  if (isAuthenticated) {
    // Update document counts when authentication completes
    updateDocumentCounts();
  }
}, { immediate: true });

// Lifecycle
onMounted(async () => {
  console.log('[UnifiedSearchView] Component mounted');
  
  // Load initial data
  await updateDocumentCounts();
  await loadFilterOptions();
  
  // Check for query parameter
  const queryParam = route.query.q;
  if (typeof queryParam === 'string' && queryParam.trim()) {
    searchQuery.value = queryParam.trim();
    await performSearch();
  }
});
</script>