<template>
  <!-- AIDEV-NOTE: Unified search interface with dark theme - refined spacing, alignment, and colors -->
  <div class="min-h-screen bg-gray-900 text-white">
    <!-- Header Section with Branding and Search -->
    <div class="bg-gray-800 border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <!-- Logo/Branding -->
        <div class="text-center mb-4">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full mb-2">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
          </div>
        </div>

        <!-- Main Search Bar -->
        <div class="max-w-2xl mx-auto mb-3">
          <div class="relative bg-gray-700 rounded-xl shadow-xl border border-gray-600 overflow-hidden">
            <div class="flex items-center">
              <div class="pl-8 pr-4">
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <input
                v-model="searchQuery"
                @keyup.enter="performSearch"
                type="text"
                placeholder="Ask me anything..."
                class="flex-1 px-4 py-3 text-base bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-inset text-white placeholder-gray-400"
                aria-label="Search query"
              />
              <button 
                @click="performSearch"
                :disabled="!searchQuery.trim()"
                class="px-6 py-2 m-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                aria-label="Start search"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-center gap-4">
          <button 
            @click="showUploadModal = true"
            class="px-6 py-2 bg-gray-700 text-white rounded-lg shadow-lg hover:bg-gray-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all border border-gray-600 font-medium"
            aria-label="Upload PDF documents"
          >
            Upload PDFs
          </button>
          <button 
            @click="clearAllPDFs"
            :disabled="documentCount === 0"
            class="px-6 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear all PDF documents"
          >
            Clear PDFs
          </button>
        </div>
      </div>
    </div>

    <!-- Search Controls Section -->
    <div class="max-w-7xl mx-auto px-6 py-3">
      <!-- Search Sensitivity Slider -->
      <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 mb-3">
        <div class="flex items-center justify-between mb-2">
          <label class="text-base font-medium text-gray-200">Search Sensitivity</label>
          <span class="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded-full">{{ thresholdLabel }}</span>
        </div>
        <div class="relative">
          <input
            v-model.number="searchThreshold"
            @input="updateThreshold"
            type="range"
            min="0"
            max="1"
            step="0.1"
            class="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-dark focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-label="Search sensitivity threshold"
          />
          <div class="flex justify-between text-xs text-gray-400 mt-2">
            <span>More Fuzzy</span>
            <span>More Sensitive</span>
          </div>
        </div>
      </div>

      <!-- Date Filter Controls -->
      <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4">
        <div class="mb-2">
          <label class="text-base font-medium text-gray-200">Date Filter (Decision Date)</label>
        </div>
        
        <!-- Filter Type Selection -->
        <div class="flex gap-3 mb-3 flex-wrap">
          <button 
            @click="updateDateFilter('all')"
            :class="[
              'px-4 py-3 text-sm rounded-lg transition-colors',
              dateFilter.type === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            ]"
          >
            All
          </button>
          <button 
            @click="updateDateFilter('laterThan')"
            :class="[
              'px-4 py-3 text-sm rounded-lg transition-colors',
              dateFilter.type === 'laterThan' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            ]"
          >
            No earlier than
          </button>
          <button 
            @click="updateDateFilter('earlierThan')"
            :class="[
              'px-4 py-3 text-sm rounded-lg transition-colors',
              dateFilter.type === 'earlierThan' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            ]"
          >
            No later than
          </button>
          <button 
            @click="updateDateFilter('range')"
            :class="[
              'px-4 py-3 text-sm rounded-lg transition-colors',
              dateFilter.type === 'range' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            ]"
          >
            Date Range
          </button>
        </div>

        <!-- Date Input Fields -->
        <div v-if="dateFilter.type === 'laterThan'" class="space-y-2">
          <label class="text-xs text-gray-400">No earlier than:</label>
          <input
            v-model="dateFilter.laterThan"
            @change="applyDateFilter"
            type="date"
            class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-700 text-white"
          />
        </div>

        <div v-if="dateFilter.type === 'earlierThan'" class="space-y-2">
          <label class="text-xs text-gray-400">No later than:</label>
          <input
            v-model="dateFilter.earlierThan"
            @change="applyDateFilter"
            type="date"
            class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-700 text-white"
          />
        </div>

        <div v-if="dateFilter.type === 'range'" class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">From:</label>
              <input
                v-model="dateFilter.laterThan"
                @change="applyDateFilter"
                type="date"
                class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-700 text-white"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">To:</label>
              <input
                v-model="dateFilter.earlierThan"
                @change="applyDateFilter"
                type="date"
                class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-700 text-white"
              />
            </div>
          </div>
        </div>

        <!-- Clear Date Filter Button -->
        <div v-if="dateFilter.type !== 'all'" class="pt-2">
          <button
            @click="clearDateFilter"
            class="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear date filter
          </button>
        </div>
      </div>
    </div>

    <!-- Search Summary Section -->
    <div v-if="filteredResults.length > 0 && searchQuery" class="max-w-7xl mx-auto px-6 py-3">
      <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4">
        <!-- Dark theme version of SearchSummary component -->
        <div class="text-white">
          <!-- Header -->
          <div class="flex items-center mb-4">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mr-3">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-200">Search Results for "{{ searchQuery }}"</h3>
          </div>

          <!-- Basic Search Stats -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <!-- Total Results -->
            <div class="bg-blue-900/30 rounded-lg p-3 text-center border border-blue-800/30">
              <div class="text-xl font-bold text-blue-300">
                {{ searchSummary.totalResults }}
                <span v-if="hiddenDocuments.size > 0" class="text-xs text-gray-400 ml-1">
                  ({{ hiddenDocuments.size }} hidden)
                </span>
              </div>
              <div class="text-xs text-blue-200">Visible Results</div>
            </div>
            
            <!-- Unique Documents -->
            <div class="bg-green-900/30 rounded-lg p-3 text-center border border-green-800/30">
              <div class="text-xl font-bold text-green-300">{{ searchSummary.uniqueDocuments }}</div>
              <div class="text-xs text-green-200">Documents Found</div>
            </div>
            
            <!-- Search Time -->
            <div class="bg-purple-900/30 rounded-lg p-3 text-center border border-purple-800/30">
              <div class="text-xl font-bold text-purple-300">{{ searchSummary.searchTime }}ms</div>
              <div class="text-xs text-purple-200">Search Time</div>
            </div>
          </div>

          <!-- Decision Outcomes -->
          <div v-if="searchSummary.decisionBreakdown.total > 0" class="mb-4">
            <h4 class="text-sm font-semibold text-gray-300 mb-2">Planning Appeal Decisions</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <!-- Allowed Decisions -->
              <div class="bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    <span class="text-xs font-medium text-green-300">Allowed</span>
                  </div>
                  <span class="text-sm font-bold text-green-400">{{ searchSummary.decisionBreakdown.allowed }}</span>
                </div>
                <div class="text-xs text-green-200">
                  {{ getPercentage(searchSummary.decisionBreakdown.allowed, searchSummary.decisionBreakdown.total) }}%
                </div>
              </div>

              <!-- Dismissed Decisions -->
              <div class="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                    <span class="text-xs font-medium text-red-300">Dismissed</span>
                  </div>
                  <span class="text-sm font-bold text-red-400">{{ searchSummary.decisionBreakdown.dismissed }}</span>
                </div>
                <div class="text-xs text-red-200">
                  {{ getPercentage(searchSummary.decisionBreakdown.dismissed, searchSummary.decisionBreakdown.total) }}%
                </div>
              </div>

              <!-- Unknown Decisions -->
              <div class="bg-gray-700/30 border border-gray-600 rounded-lg p-3">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                    <span class="text-xs font-medium text-gray-400">Unknown</span>
                  </div>
                  <span class="text-sm font-bold text-gray-400">{{ searchSummary.decisionBreakdown.unknown }}</span>
                </div>
                <div class="text-xs text-gray-500">
                  {{ getPercentage(searchSummary.decisionBreakdown.unknown, searchSummary.decisionBreakdown.total) }}%
                </div>
              </div>
            </div>
          </div>

          <!-- Planning Appeal Insights -->
          <div v-if="searchSummary.planningInsights.uniqueLPAs > 0 || searchSummary.planningInsights.uniqueInspectors > 0" class="pt-3 border-t border-gray-700">
            <h4 class="text-sm font-semibold text-gray-300 mb-2">Planning Insights</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div v-if="searchSummary.planningInsights.uniqueLPAs > 0">
                <div class="text-sm font-bold text-indigo-400">{{ searchSummary.planningInsights.uniqueLPAs }}</div>
                <div class="text-xs text-indigo-300">Unique LPAs</div>
              </div>
              <div v-if="searchSummary.planningInsights.uniqueInspectors > 0">
                <div class="text-sm font-bold text-indigo-400">{{ searchSummary.planningInsights.uniqueInspectors }}</div>
                <div class="text-xs text-indigo-300">Inspectors</div>
              </div>
              <div v-if="searchSummary.planningInsights.dateRange.start">
                <div class="text-xs font-medium text-indigo-400">{{ searchSummary.planningInsights.dateRange.start }}</div>
                <div class="text-xs text-indigo-300">Earliest</div>
              </div>
              <div v-if="searchSummary.planningInsights.dateRange.end">
                <div class="text-xs font-medium text-indigo-400">{{ searchSummary.planningInsights.dateRange.end }}</div>
                <div class="text-xs text-indigo-300">Latest</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Section -->
    <div class="max-w-7xl mx-auto px-6 py-3">
      <!-- Search Engine Error -->
      <div v-if="searchEngineStatus?.error" class="text-center py-8">
        <div class="text-red-400 mb-3">
          <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <p class="text-lg text-red-400 mb-3">Search Engine Error</p>
        <p class="text-gray-400 mb-3">{{ searchEngineStatus.error }}</p>
        <button 
          @click="retryInitialization" 
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors shadow-lg hover:shadow-xl"
          aria-label="Retry search engine initialization"
        >
          Retry Initialization
        </button>
      </div>

      <!-- Search Error -->
      <div v-else-if="searchError" class="text-center py-8">
        <div class="text-red-400 mb-3">
          <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <p class="text-lg text-red-400 mb-3">Search Failed</p>
        <p class="text-gray-400 mb-3">{{ searchError }}</p>
        <div class="flex justify-center gap-2">
          <button 
            @click="retrySearch" 
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors shadow-lg hover:shadow-xl"
            aria-label="Retry last search"
          >
            Retry Search
          </button>
          <button 
            @click="clearError" 
            class="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors shadow-lg hover:shadow-xl"
            aria-label="Clear error message"
          >
            Clear Error
          </button>
        </div>
      </div>

      <!-- Progressive Loading State - Enhanced for Hot/Cold Storage -->
      <div v-else-if="isLoading || store.state.search.results.isLoading" class="text-center py-8">
        <div class="space-y-4">
          <!-- Main loading spinner -->
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          
          <!-- Progressive loading indicators -->
          <div class="max-w-lg mx-auto space-y-2">
            <!-- Hot storage search status -->
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div class="flex items-center space-x-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span class="text-sm text-gray-300">Hot Storage (Recent)</span>
              </div>
              <div class="flex items-center space-x-2">
                <span v-if="store.state.search.results.isHotComplete" class="text-green-400 text-xs">
                  ✓ {{ store.state.search.results.hot.length }} results
                </span>
                <span v-else class="text-blue-400 text-xs">Searching...</span>
              </div>
            </div>
            
            <!-- Cold storage search status -->
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div class="flex items-center space-x-2">
                <div class="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                <span class="text-sm text-gray-300">Cold Storage (Archive)</span>
              </div>
              <div class="flex items-center space-x-2">
                <span v-if="store.state.search.results.isColdComplete" class="text-green-400 text-xs">
                  ✓ {{ store.state.search.results.cold.length }} results
                </span>
                <span v-else-if="store.state.coldStorage.searchProgress.isSearching" class="text-cyan-400 text-xs">
                  {{ store.state.coldStorage.searchProgress.completedBatches }}/{{ store.state.coldStorage.searchProgress.totalBatches }} batches
                </span>
                <span v-else class="text-gray-500 text-xs">Waiting...</span>
              </div>
            </div>
          </div>
          
          <!-- Search progress message -->
          <p class="text-gray-400 text-sm">
            {{ store.state.coldStorage.searchProgress.message || 'Searching across storage tiers...' }}
          </p>
        </div>
      </div>

      <!-- No Results -->
      <div v-else-if="filteredResults.length === 0 && searchQuery && !searchError" class="text-center py-8">
        <p class="text-lg text-gray-400 mb-3">
          {{ results.length > 0 ? 'All results hidden' : 'No results found' }}
        </p>
        <p class="text-gray-500">
          {{ results.length > 0 ? 'All search results have been hidden from view' : 'Try different keywords or check your spelling' }}
        </p>
      </div>

      <!-- Results List -->
      <div v-else-if="filteredResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SearchResultCard
          v-for="result in paginatedResults"
          :key="result.document.id"
          :result="result"
          :search-query="searchQuery"
          @view-document="openDocument"
          @hide-document="hideDocument"
        />
      </div>

      <!-- Pagination -->
      <div v-if="filteredResults.length > resultsPerPage" class="mt-6 flex justify-center">
        <div class="flex gap-2">
          <button
            v-for="page in totalPages"
            :key="page"
            @click="currentPage = page"
            :class="[
              'px-4 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50',
              currentPage === page 
                ? 'bg-blue-600 text-white shadow-lg hover:shadow-xl' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:shadow-lg border border-gray-600'
            ]"
            :aria-label="`Go to page ${page}`"
            :aria-current="currentPage === page ? 'page' : undefined"
          >
            {{ page }}
          </button>
        </div>
      </div>
    </div>

    <!-- Document Stats Footer -->
    <div class="text-center py-4 border-t border-gray-700 bg-gray-800/50 mt-3">
      <div class="text-xs text-gray-400">
        <p v-if="documentCount > 0">
          {{ documentCount }} documents indexed | {{ indexedCount }} searchable
        </p>
        <p v-else class="text-gray-500">
          No documents uploaded yet. Click "Upload PDFs" to get started.
        </p>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-700">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold text-white">Upload PDF Documents</h2>
            <button @click="closeUploadModal" class="text-gray-400 hover:text-gray-200">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <UploadComponent @upload-complete="handleUploadComplete" />
        </div>
      </div>
    </div>

    <!-- Performance Indicator -->
    <PerformanceIndicator />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { db } from '@/stores/database';
import { useStorageStore } from '@/stores';
import type { SearchHistory, SavedSearch, DateFilter, SearchResult, SearchSummaryData } from '@/types';
import UploadComponent from '@/components/UploadComponent.vue';
import SearchResultCard from '@/components/SearchResultCard.vue';
import PerformanceIndicator from '@/components/PerformanceIndicator.vue';

// AIDEV-NOTE: Use new Vue store for hot/cold storage management
const store = useStorageStore();

const router = useRouter();
const route = useRoute();

// Search state
const searchQuery = ref('');
const results = ref<SearchResult[]>([]);
const isLoading = ref(false);
const searchTime = ref(0);
const searchError = ref<string | null>(null);

// UI state
const showUploadModal = ref(false);
const documentCount = ref(0);
const indexedCount = ref(0);
const recentSearches = ref<SearchHistory[]>([]);
const savedSearches = ref<SavedSearch[]>([]);
const currentPage = ref(1);
const resultsPerPage = 20;
// AIDEV-NOTE: expandedResults state moved to SearchResultCard component
// AIDEV-NOTE: Track hidden documents for current search session only
const hiddenDocuments = ref(new Set<string>());

// Search configuration
const searchThreshold = ref(0.5);
const dateFilter = ref<DateFilter>({
  type: 'all'
});

// Search engine status
const searchEngineStatus = ref<{
  initialized: boolean;
  error: string | null;
  isInitializing: boolean;
} | null>(null);

// AIDEV-NOTE: Computed property for threshold display label
const thresholdLabel = computed(() => {
  const value = searchThreshold.value;
  if (value <= 0.2) return 'Very Fuzzy';
  if (value <= 0.4) return 'Fuzzy';
  if (value <= 0.6) return 'Balanced';
  if (value <= 0.8) return 'Sensitive';
  return 'Very Sensitive';
});

// AIDEV-NOTE: Computed property for comprehensive search summary statistics - use filtered results for accurate counts
const searchSummary = computed((): SearchSummaryData => {
  const visibleResults = filteredResults.value;
  const uniqueDocuments = new Set(visibleResults.map(r => r.document.id)).size;
  const totalIndexedDocuments = window.searchEngine?.getIndexedDocumentCount?.() || 0;
  
  // Decision breakdown
  const decisionCounts = { allowed: 0, dismissed: 0, unknown: 0 };
  const lpas = new Set<string>();
  const inspectors = new Set<string>();
  const decisionDates: Date[] = [];
  
  let totalScore = 0;
  let highQualityCount = 0;
  
  visibleResults.forEach(result => {
    const decision = result.document.metadata?.decisionOutcome;
    if (decision === 'Allowed') {
      decisionCounts.allowed++;
    } else if (decision === 'Dismissed') {
      decisionCounts.dismissed++;
    } else {
      decisionCounts.unknown++;
    }
    
    // LPA and Inspector tracking
    if (result.document.metadata?.lpa && result.document.metadata.lpa !== 'NOT_FOUND') {
      lpas.add(result.document.metadata.lpa);
    }
    if (result.document.metadata?.inspector && result.document.metadata.inspector !== 'NOT_FOUND') {
      inspectors.add(result.document.metadata.inspector);
    }
    
    // Date tracking
    if (result.document.metadata?.decisionDate && result.document.metadata.decisionDate !== 'NOT_FOUND') {
      const date = new Date(result.document.metadata.decisionDate);
      if (!isNaN(date.getTime())) {
        decisionDates.push(date);
      }
    }
    
    // Match quality
    totalScore += result.overallScore;
    if (result.overallScore < 0.3) { // Low score = high quality in fuzzy search
      highQualityCount++;
    }
  });
  
  // Date range calculation
  const sortedDates = decisionDates.sort((a, b) => a.getTime() - b.getTime());
  const dateRange = {
    start: sortedDates.length > 0 ? sortedDates[0].toLocaleDateString('en-GB') : null,
    end: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1].toLocaleDateString('en-GB') : null
  };
  
  return {
    totalResults: visibleResults.length,
    uniqueDocuments,
    totalIndexedDocuments,
    searchTime: searchTime.value,
    decisionBreakdown: {
      allowed: decisionCounts.allowed,
      dismissed: decisionCounts.dismissed,
      unknown: decisionCounts.unknown,
      total: decisionCounts.allowed + decisionCounts.dismissed + decisionCounts.unknown
    },
    matchQuality: {
      averageScore: visibleResults.length > 0 ? totalScore / visibleResults.length : 0,
      highQualityCount
    },
    planningInsights: {
      uniqueLPAs: lpas.size,
      uniqueInspectors: inspectors.size,
      dateRange
    },
    // AIDEV-NOTE: Include applied filter information in search summary
    appliedFilters: {
      dateFilter: dateFilter.value.type !== 'all' ? dateFilter.value : undefined
    }
  };
});

onMounted(async () => {
  // AIDEV-NOTE: Initialize storage through Vue store
  try {
    await store.hotStorage.initialize();
    console.log('Hot storage initialized through store');
  } catch (error) {
    console.error('Hot storage initialization failed:', error);
    searchError.value = store.state.hotStorage.error || 'Hot storage initialization failed';
  }
  
  // Initialize legacy search engine as fallback (gradually phase out)
  updateSearchEngineStatus();
  if (window.searchEngine) {
    window.searchEngine.setThreshold(searchThreshold.value);
  }
  
  // Set initial search threshold in store
  store.search.setThreshold(searchThreshold.value);
  
  // Load initial data
  await loadStats();
  await loadSearchHistory();
  await loadSavedSearches();
  
  // Check for initial search query from URL
  const query = route.query.q as string;
  if (query) {
    searchQuery.value = query;
    await performSearch();
  }
});

async function loadStats() {
  try {
    // AIDEV-NOTE: Load stats through store for better state management
    await store.hotStorage.loadStats();
    
    // Also get legacy stats for backward compatibility during migration
    const [legacyDocs, legacyIndices] = await Promise.all([
      db.getAllDocuments(),
      db.getAllSearchIndices()
    ]);
    
    // Use hot storage stats if available, otherwise use legacy stats
    documentCount.value = store.state.hotStorage.stats.documentCount || legacyDocs.length;
    indexedCount.value = store.state.hotStorage.stats.indexedCount || legacyIndices.length;
  } catch (error) {
    console.error('Failed to load stats:', error);
    // Fallback to legacy stats only
    const [docs, indices] = await Promise.all([
      db.getAllDocuments(),
      db.getAllSearchIndices()
    ]);
    documentCount.value = docs.length;
    indexedCount.value = indices.length;
  }
}

async function loadSearchHistory() {
  await db.cleanupDuplicateSearchHistory();
  recentSearches.value = await db.getSearchHistory();
}

async function loadSavedSearches() {
  savedSearches.value = await db.getSavedSearches();
}

async function performSearch() {
  if (!searchQuery.value.trim()) return;

  // Clear previous errors
  searchError.value = null;
  
  isLoading.value = true;
  currentPage.value = 1;
  // AIDEV-NOTE: expandedResults now handled by individual SearchResultCard components
  // AIDEV-NOTE: Clear hidden documents for new search
  hiddenDocuments.value.clear();

  try {
    const startTime = performance.now();
    
    // AIDEV-NOTE: Use store for unified search across hot/cold storage
    try {
      // Update store with current search filters
      store.search.setDateFilter(dateFilter.value);
      store.search.setThreshold(searchThreshold.value);
      
      // Perform unified search through store
      await store.search.performUnifiedSearch(searchQuery.value.trim(), {
        limit: 50
      });
      
      // Get results from store
      results.value = store.allSearchResults.value;
      searchTime.value = store.state.search.performance.totalSearchTime;
      
      console.log(`Store search returned ${results.value.length} results in ${searchTime.value}ms`);
    } catch (storeSearchError) {
      console.warn('Store search failed, falling back to legacy search:', storeSearchError);
      
      // Fallback to legacy search engine
      updateSearchEngineStatus();
      if (window.searchEngine) {
        const searchDateFilter = dateFilter.value.type !== 'all' ? dateFilter.value : undefined;
        const searchResults = await window.searchEngine.search(searchQuery.value.trim(), 50, searchDateFilter);
        results.value = searchResults;
        const endTime = performance.now();
        searchTime.value = Math.round(endTime - startTime);
      } else {
        throw new Error('Both store search and legacy search are unavailable');
      }
    }

    // Update URL without triggering navigation
    const queryParams: any = { q: searchQuery.value.trim() };
    if (dateFilter.value.type !== 'all') {
      queryParams.dateFilterType = dateFilter.value.type;
      if (dateFilter.value.laterThan) {
        queryParams.dateFilterFrom = dateFilter.value.laterThan;
      }
      if (dateFilter.value.earlierThan) {
        queryParams.dateFilterTo = dateFilter.value.laterThan;
      }
    }
    
    await router.replace({
      name: 'search',
      query: queryParams
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown search error';
    console.error('Search failed:', error);
    searchError.value = `Search failed: ${errorMessage}`;
    results.value = [];
  } finally {
    isLoading.value = false;
  }
}

function updateSearchEngineStatus() {
  if (typeof window !== 'undefined' && window.searchEngineStatus) {
    searchEngineStatus.value = { ...window.searchEngineStatus };
  } else {
    searchEngineStatus.value = {
      initialized: false,
      error: 'Search engine status not available',
      isInitializing: true
    };
  }
}

function updateThreshold() {
  // Update store threshold
  store.search.setThreshold(searchThreshold.value);
  
  // Update legacy search engine as well for fallback
  if (window.searchEngine) {
    window.searchEngine.setThreshold(searchThreshold.value);
  }
  
  // Automatically re-run the search with new threshold
  if (searchQuery.value.trim()) {
    performSearch();
  }
}

function updateDateFilter(type: DateFilter['type']) {
  dateFilter.value.type = type;
  
  // Clear date inputs when switching to 'all'
  if (type === 'all') {
    dateFilter.value.laterThan = undefined;
    dateFilter.value.earlierThan = undefined;
  }
  
  applyDateFilter();
}

async function applyDateFilter() {
  // Re-run search if there's a query
  if (searchQuery.value.trim()) {
    await performSearch();
  }
}

function clearDateFilter() {
  dateFilter.value = { type: 'all' };
  applyDateFilter();
}

function closeUploadModal() {
  showUploadModal.value = false;
}

async function handleUploadComplete() {
  showUploadModal.value = false;
  await loadStats();
  
  // Refresh hot storage through store
  try {
    await store.hotStorage.refresh();
  } catch (error) {
    console.error('Failed to refresh hot storage through store:', error);
  }
  
  // Refresh legacy search engine as fallback
  if (window.searchEngine) {
    await window.searchEngine.refresh();
  }
}

async function clearAllPDFs() {
  if (confirm('Are you sure you want to clear all PDFs? This action cannot be undone.')) {
    // Clear hot storage through store
    try {
      await store.hotStorage.clearAll();
    } catch (error) {
      console.error('Failed to clear hot storage through store:', error);
    }
    
    // Clear legacy data as fallback
    await db.clearAllData();
    await loadStats();
    await loadSearchHistory();
    await loadSavedSearches();
    
    // Clear current results and search state
    results.value = [];
    searchQuery.value = '';
    store.search.clearResults();
    
    // Refresh both storage systems
    try {
      await store.hotStorage.refresh();
    } catch (error) {
      console.error('Failed to refresh hot storage through store:', error);
    }
    
    if (window.searchEngine) {
      await window.searchEngine.refresh();
    }
  }
}

// AIDEV-NOTE: formatFileSize and getDecisionColor functions moved to SearchResultCard component

// AIDEV-NOTE: toggleExpandResult and highlightMatches functions moved to SearchResultCard component

async function openDocument(document: any) {
  // For now, just show an alert. In a real app, you'd implement PDF viewing
  alert(`Opening ${document.filename}\n\nNote: PDF viewer not implemented in this demo. In a production app, this would open the PDF in a viewer.`);
}

// AIDEV-NOTE: Hide document from current search results only (not permanently deleted)
function hideDocument(docId: string) {
  if (confirm('Are you sure you want to hide this document from the current search results?')) {
    // Add to hidden documents set - document remains in IndexedDB and search engine
    hiddenDocuments.value.add(docId);
    
    // Reset to first page if current page becomes empty
    if (paginatedResults.value.length === 0 && currentPage.value > 1) {
      currentPage.value = 1;
    }
  }
}

// AIDEV-NOTE: Filter out hidden documents from displayed results
const filteredResults = computed(() => {
  return results.value.filter(result => !hiddenDocuments.value.has(result.document.id));
});

// Pagination computed properties
const totalPages = computed(() => Math.ceil(filteredResults.value.length / resultsPerPage));
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * resultsPerPage;
  const end = start + resultsPerPage;
  return filteredResults.value.slice(start, end);
});

// Error handling functions
function retryInitialization() {
  // Force search engine re-initialization
  if (window.searchEngine) {
    window.searchEngine.refresh();
  }
  updateSearchEngineStatus();
}

function retrySearch() {
  searchError.value = null;
  performSearch();
}

function clearError() {
  searchError.value = null;
}

// Helper function for percentage calculation
function getPercentage(value: number, total: number): string {
  if (total === 0) return '0';
  return ((value / total) * 100).toFixed(1);
}

// AIDEV-NOTE: getStorageTierBadge function moved to SearchResultCard component

// AIDEV-NOTE: Global window declarations are defined in App.vue
</script>

<style scoped>
/* AIDEV-NOTE: Custom dark theme slider styling with blue/cyan color scheme */
.slider-dark::-webkit-slider-thumb {
  appearance: none;
  height: 24px;
  width: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border: 2px solid #374151;
}

.slider-dark::-moz-range-thumb {
  height: 24px;
  width: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  cursor: pointer;
  border: 2px solid #374151;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.slider-dark::-webkit-slider-track {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(to right, #10b981, #f59e0b, #ef4444);
  border: 1px solid #4b5563;
}

.slider-dark::-moz-range-track {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(to right, #10b981, #f59e0b, #ef4444);
  border: 1px solid #4b5563;
}
</style>