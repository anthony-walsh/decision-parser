/**
 * Search Store Module
 * 
 * Manages search state and operations across storage tiers
 * AIDEV-NOTE: Extracted from stores/index.ts for better modularity
 */

import { reactive, computed } from 'vue';
import type { SearchResult, ColdStorageSearchResult, DateFilter } from '@/types';

// AIDEV-NOTE: Search state interface
export interface SearchState {
  query: string;
  results: {
    cold: ColdStorageSearchResult[];
    legacy: SearchResult[];
    isColdComplete: boolean;
    isLegacyComplete: boolean;
    isLoading: boolean;
  };
  filters: {
    dateFilter: DateFilter;
    threshold: number;
  };
  history: string[];
  performance: {
    legacySearchTime: number;
    coldSearchTime: number;
    totalSearchTime: number;
  };
}

// AIDEV-NOTE: Reactive search state
export const searchState = reactive<SearchState>({
  query: '',
  results: {
    cold: [],
    legacy: [],
    isColdComplete: false,
    isLegacyComplete: false,
    isLoading: false
  },
  filters: {
    dateFilter: { type: 'all' },
    threshold: 0.5
  },
  history: [],
  performance: {
    legacySearchTime: 0,
    coldSearchTime: 0,
    totalSearchTime: 0
  }
});

// AIDEV-NOTE: Search actions
export const useSearchStore = () => {
  
  // Computed values
  const isSearchComplete = computed(() => 
    searchState.results.isLegacyComplete && searchState.results.isColdComplete
  );
  
  const isSearching = computed(() => searchState.results.isLoading);
  
  const allSearchResults = computed(() => {
    // AIDEV-NOTE: Convert cold storage results to SearchResult format for compatibility
    const convertedColdResults = searchState.results.cold.map((coldResult): SearchResult | null => {
      // Defensive programming - ensure required fields exist
      if (!coldResult || typeof coldResult !== 'object') {
        console.warn('[SearchStore] Invalid cold result:', coldResult);
        return null;
      }
      
      const resultId = coldResult.id || 'unknown';
      const resultFilename = coldResult.filename || 'unknown.pdf';
      
      // Create metadata from all appeal-specific fields, excluding search-specific fields
      const searchSpecificFields = ['id', 'filename', 'snippet', 'relevance', 'tier', 'isArchived', 'batchId'];
      const documentMetadata: any = {};
      
      // Copy all cold storage fields to metadata except the search-specific ones
      Object.keys(coldResult).forEach(key => {
        if (!searchSpecificFields.includes(key)) {
          documentMetadata[key] = (coldResult as any)[key];
        }
      });
      
      return {
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
    }).filter((result): result is SearchResult => result !== null);
    
    return [
      ...searchState.results.legacy,
      ...convertedColdResults
    ];
  });
  
  const searchActions = {
    // Set current search query
    setQuery(query: string) {
      searchState.query = query;
    },

    // Add query to search history
    addToHistory(query: string) {
      if (query && !searchState.history.includes(query)) {
        searchState.history.unshift(query);
        // Keep only last 10 searches
        if (searchState.history.length > 10) {
          searchState.history = searchState.history.slice(0, 10);
        }
      }
    },

    // Clear search history
    clearHistory() {
      searchState.history = [];
    },

    // Set search filters
    setFilters(filters: Partial<SearchState['filters']>) {
      Object.assign(searchState.filters, filters);
    },

    // Set cold storage search results
    setColdResults(results: ColdStorageSearchResult[], isComplete = true) {
      searchState.results.cold = results;
      searchState.results.isColdComplete = isComplete;
    },

    // Set legacy search results
    setLegacyResults(results: SearchResult[], isComplete = true) {
      searchState.results.legacy = results;
      searchState.results.isLegacyComplete = isComplete;
    },

    // Add partial cold storage results (for progressive search)
    addPartialColdResults(results: ColdStorageSearchResult[]) {
      searchState.results.cold.push(...results);
    },

    // Set search loading state
    setLoading(isLoading: boolean) {
      searchState.results.isLoading = isLoading;
    },

    // Reset search results
    resetResults() {
      searchState.results = {
        cold: [],
        legacy: [],
        isColdComplete: false,
        isLegacyComplete: false,
        isLoading: false
      };
      searchState.performance = {
        legacySearchTime: 0,
        coldSearchTime: 0,
        totalSearchTime: 0
      };
    },

    // Record search performance
    recordPerformance(type: 'legacy' | 'cold' | 'total', duration: number) {
      if (type === 'legacy') {
        searchState.performance.legacySearchTime = duration;
      } else if (type === 'cold') {
        searchState.performance.coldSearchTime = duration;
      } else if (type === 'total') {
        searchState.performance.totalSearchTime = duration;
      }
    },

    // Get search statistics
    getSearchStats() {
      return {
        totalResults: allSearchResults.value.length,
        coldResults: searchState.results.cold.length,
        legacyResults: searchState.results.legacy.length,
        isComplete: isSearchComplete.value,
        performance: { ...searchState.performance },
        currentQuery: searchState.query,
        historyCount: searchState.history.length
      };
    },

    // Filter results by date
    filterByDate(dateFilter: DateFilter) {
      searchState.filters.dateFilter = dateFilter;
      // Note: Actual filtering would be implemented in the search components
      // This just updates the filter state
    },

    // Filter results by relevance threshold
    filterByRelevance(threshold: number) {
      searchState.filters.threshold = threshold;
      // Note: Actual filtering would be implemented in the search components
      // This just updates the filter state
    },

    // Get filtered results based on current filters
    getFilteredResults() {
      let results = allSearchResults.value;
      
      // Apply relevance filter
      if (searchState.filters.threshold > 0) {
        results = results.filter(result => result.overallScore >= searchState.filters.threshold);
      }
      
      // Note: Date filtering would require additional logic based on document metadata
      // This is a simplified implementation
      
      return results;
    },

    // Export search state for debugging/analysis
    exportSearchState() {
      return {
        query: searchState.query,
        resultCounts: {
          cold: searchState.results.cold.length,
          legacy: searchState.results.legacy.length,
          total: allSearchResults.value.length
        },
        filters: { ...searchState.filters },
        performance: { ...searchState.performance },
        history: [...searchState.history],
        isComplete: isSearchComplete.value,
        timestamp: new Date().toISOString()
      };
    }
  };

  return {
    // State
    state: searchState,
    
    // Computed
    allSearchResults,
    isSearchComplete,
    isSearching,
    
    // Actions
    ...searchActions
  };
};