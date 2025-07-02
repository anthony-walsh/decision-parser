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
        <div class="flex justify-center gap-4 flex-wrap">
          <button 
            @click="showImportModal = true"
            :disabled="isImporting"
            class="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg shadow-lg hover:from-cyan-700 hover:to-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Import appeal decision letters from UK Planning Appeals database"
          >
            <svg v-if="isImporting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Import Appeal Cases
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
      <!-- Search Error -->
      <div v-if="searchError" class="text-center py-8">
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
            <!-- Legacy storage search status -->
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div class="flex items-center space-x-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span class="text-sm text-gray-300">Legacy Storage (Local)</span>
              </div>
              <div class="flex items-center space-x-2">
                <span v-if="store.state.search.results.isLegacyComplete" class="text-green-400 text-xs">
                  ✓ {{ store.state.search.results.legacy.length }} results
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

    <!-- Search Debug Panel -->
    <div v-if="showDebugPanel" class="max-w-7xl mx-auto px-6 py-4">
      <SearchDebugPanel ref="debugPanel" />
    </div>

    <!-- Document Stats Footer -->
    <div class="text-center py-4 border-t border-gray-700 bg-gray-800/50 mt-3">
      <div class="text-xs text-gray-400">
        <p v-if="documentCount > 0">
          {{ documentCount }} documents in cold storage | {{ indexedCount }} searchable
        </p>
        <p v-else class="text-gray-500">
          No documents available. Use "Import Appeal Cases" to populate the archive.
        </p>
      </div>
      
      <!-- Debug Panel Toggle -->
      <button 
        @click="toggleDebugPanel"
        class="mt-2 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition-colors"
        title="Toggle Search Diagnostics"
      >
        {{ showDebugPanel ? 'Hide' : 'Show' }} Debug Panel
      </button>
    </div>

    <!-- Authentication Required Modal -->
    <div v-if="authenticationRequired" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        <div class="p-6">
          <div class="flex items-center mb-4">
            <div class="w-12 h-12 bg-blue-900/20 rounded-full flex items-center justify-center mr-4">
              <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-white">Authentication Required</h3>
          </div>
          
          <p class="text-gray-300 mb-4">
            Cold storage contains encrypted documents that require authentication to access. 
            You can either authenticate to access the full archive or continue with local document search only.
          </p>
          
          <div class="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 mb-4">
            <p class="text-blue-300 text-sm font-medium">Cold Storage Features:</p>
            <ul class="text-blue-200 text-xs mt-1 space-y-1">
              <li>• Encrypted document archive with thousands of planning appeal decisions</li>
              <li>• Advanced search across large datasets</li>
              <li>• Secure AES-256-GCM encryption</li>
              <li>• Password-protected access</li>
            </ul>
          </div>
          
          <div class="flex justify-center">
            <button
              @click="authenticateForColdStorage"
              class="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors font-medium"
            >
              Authenticate
            </button>
          </div>
        </div>
      </div>
    </div>


    <!-- Import Appeal Cases Modal -->
    <div v-if="showImportModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h2 class="text-2xl font-semibold text-white">Import Appeal Cases</h2>
              <p class="text-gray-400 text-sm mt-1">Download and import UK Planning Appeal decision letters</p>
            </div>
            <button @click="closeImportModal" class="text-gray-400 hover:text-gray-200" :disabled="isImporting">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Import Configuration -->
          <div v-if="!isImporting" class="space-y-6">
            <!-- Import Settings -->
            <div class="bg-gray-700/50 rounded-lg p-4">
              <h3 class="text-lg font-medium text-white mb-3">Import Settings</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Batch Size</label>
                  <select v-model="importSettings.batchSize" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="50">50 cases (Testing)</option>
                    <option value="100">100 cases (Small)</option>
                    <option value="500">500 cases (Medium)</option>
                    <option value="1000">1000 cases (Large)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Concurrency Limit</label>
                  <select v-model="importSettings.concurrencyLimit" class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="5">5 (Conservative)</option>
                    <option value="10">10 (Balanced)</option>
                    <option value="15">15 (Aggressive)</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end gap-3">
              <button
                @click="closeImportModal"
                class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="startImport"
                class="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-colors font-medium"
              >
                Start Import
              </button>
            </div>
          </div>

          <!-- Import Progress -->
          <div v-else class="space-y-6">
            <!-- Progress Header -->
            <div class="text-center">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mb-4">
                <svg class="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-white">{{ importProgress.stage }}</h3>
              <p class="text-gray-400 mt-1">{{ importProgress.message }}</p>
            </div>

            <!-- Progress Bar -->
            <div v-if="importProgress.total > 0" class="w-full bg-gray-700 rounded-full h-3">
              <div 
                class="bg-gradient-to-r from-cyan-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                :style="{ width: `${(importProgress.processed / importProgress.total) * 100}%` }"
              ></div>
            </div>

            <!-- Progress Stats -->
            <div class="grid grid-cols-3 gap-4 text-center">
              <div class="bg-gray-700/50 rounded-lg p-3">
                <div class="text-2xl font-bold text-cyan-400">{{ importProgress.processed }}</div>
                <div class="text-xs text-gray-400">Processed</div>
              </div>
              <div class="bg-gray-700/50 rounded-lg p-3">
                <div class="text-2xl font-bold text-blue-400">{{ importProgress.total }}</div>
                <div class="text-xs text-gray-400">Total</div>
              </div>
              <div class="bg-gray-700/50 rounded-lg p-3">
                <div class="text-2xl font-bold text-red-400">{{ importProgress.errors.length }}</div>
                <div class="text-xs text-gray-400">Errors</div>
              </div>
            </div>

            <!-- Error Log -->
            <div v-if="importProgress.errors.length > 0" class="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <h4 class="text-red-400 font-medium mb-2">Import Errors</h4>
              <div class="max-h-32 overflow-y-auto space-y-1">
                <div 
                  v-for="(error, index) in importProgress.errors.slice(-5)" 
                  :key="index"
                  class="text-xs text-red-300 font-mono"
                >
                  {{ error }}
                </div>
              </div>
            </div>
          </div>
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
import { useStorageStore } from '@/stores';
import { searchHistoryService } from '@/utils/searchHistoryService';
import type { SearchHistory, SavedSearch, DateFilter, SearchResult, SearchSummaryData } from '@/types';
import SearchResultCard from '@/components/SearchResultCard.vue';
import PerformanceIndicator from '@/components/PerformanceIndicator.vue';
import SearchDebugPanel from '@/components/SearchDebugPanel.vue';
import { logger, logImport, logUI, startTimer } from '@/utils/logger';
import { appealImportService } from '@/services/AppealImportService';
import { authService } from '@/services/AuthenticationService.js';

// AIDEV-NOTE: Replaced Dexie database import with localStorage-based search history service

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
const showImportModal = ref(false);
const isImporting = ref(false);
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

// AIDEV-NOTE: Cold storage is the only storage mode

// AIDEV-NOTE: Authentication state for cold storage access
const authenticationRequired = ref(false);
const isAuthenticated = ref(false);

// Debug panel state
const showDebugPanel = ref(false);
const debugPanel = ref();

// AIDEV-NOTE: Import settings for appeal cases downloader
const importSettings = ref({
  batchSize: 50, // Start with testing size
  concurrencyLimit: 5 // Conservative concurrency
});


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
  const totalIndexedDocuments = 0; // Cold storage only, no legacy search engine
  
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
  // AIDEV-NOTE: Check authentication state first
  try {
    const authState = authService.getAuthState();
    isAuthenticated.value = authState.isAuthenticated;
    console.log('[UnifiedSearchView] Authentication state:', authState);
    
    // Update store authentication state
    await store.auth.setAuthenticated(authState.isAuthenticated);
    await store.auth.setInitialized(authState.isInitialized);
  } catch (error) {
    console.error('Failed to check authentication state:', error);
  }
  
  // AIDEV-NOTE: Initialize cold storage through Vue store (simplified architecture)
  try {
    await store.coldStorage.initialize();
    console.log('Cold storage initialized through store');
    
    // Initialize appeal import service with cold storage
    const { getColdStorageService } = await import('@/stores/index');
    const coldStorageService = await getColdStorageService();
    await appealImportService.initialize(coldStorageService);
    logImport('Appeal import service initialized with cold storage', {
      coldStorageAvailable: true
    }, 'UnifiedSearchView');
    
  } catch (error) {
    console.error('Cold storage initialization failed:', error);
    searchError.value = store.state.coldStorage.error || 'Cold storage initialization failed';
    
    // Try to initialize appeal import service without cold storage
    try {
      await appealImportService.initialize(null);
      logImport('Appeal import service initialized without cold storage (fallback mode)', {}, 'UnifiedSearchView');
    } catch (importError) {
      console.error('Appeal import service initialization failed:', importError);
    }
  }
  
  // Cold storage is the only mode - check authentication requirement
  if (!isAuthenticated.value) {
    const shouldShowAuth = await checkColdStorageAuthRequirement();
    if (shouldShowAuth) {
      authenticationRequired.value = true;
    }
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
    // AIDEV-NOTE: Load stats from cold storage only
    documentCount.value = store.state.coldStorage.stats.totalDocuments || 0;
    indexedCount.value = store.state.coldStorage.stats.totalDocuments || 0; // All cold storage documents are searchable
  } catch (error) {
    console.error('Failed to load cold storage stats:', error);
    documentCount.value = 0;
    indexedCount.value = 0;
  }
}

async function loadSearchHistory() {
  await searchHistoryService.cleanupDuplicateSearchHistory();
  recentSearches.value = await searchHistoryService.getSearchHistory();
}

async function loadSavedSearches() {
  savedSearches.value = await searchHistoryService.getSavedSearches();
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
    // AIDEV-NOTE: Use store for unified search across cold storage
    try {
      // Check authentication for cold storage
      if (!isAuthenticated.value) {
        // Check if cold storage has encrypted data that requires authentication
        const requiresAuth = await checkColdStorageAuthRequirement();
        if (requiresAuth) {
          console.log('[UnifiedSearchView] Cold storage search requires authentication');
          authenticationRequired.value = true;
          searchError.value = 'Authentication required for cold storage access. Please authenticate to continue.';
          return;
        }
      }
      
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
      console.error('Cold storage search failed:', storeSearchError);
      throw new Error('Cold storage search unavailable');
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
    
    // Track search in debug panel
    trackSearchInDebugPanel();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown search error';
    console.error('Search failed:', error);
    searchError.value = `Search failed: ${errorMessage}`;
    results.value = [];
  } finally {
    isLoading.value = false;
  }
}


function updateThreshold() {
  // Update store threshold
  store.search.setThreshold(searchThreshold.value);
  
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


// AIDEV-NOTE: Import modal handlers
function closeImportModal() {
  if (!isImporting.value) {
    showImportModal.value = false;
    // Reset import progress
    importProgress.value = {
      stage: '',
      message: '',
      processed: 0,
      total: 0,
      errors: []
    };
  }
}

// AIDEV-NOTE: Start import process using AppealImportService
async function startImport() {
  // Check authentication for cold storage import
  if (!isAuthenticated.value) {
    console.log('[UnifiedSearchView] Cold storage import requires authentication');
    authenticationRequired.value = true;
    return;
  }
  
  const timer = startTimer('appeal-cases-import');
  
  logImport('Starting appeal cases import', {
    batchSize: importSettings.value.batchSize,
    concurrencyLimit: importSettings.value.concurrencyLimit,
    authenticated: isAuthenticated.value,
    timestamp: new Date().toISOString()
  }, 'UnifiedSearchView');

  logUI('Import modal transitioning to progress view', {
    previousStage: 'configuration',
    newStage: 'progress'
  }, 'UnifiedSearchView');

  isImporting.value = true;
  importProgress.value = {
    stage: 'Initializing',
    message: 'Setting up import process...',
    processed: 0,
    total: 0,
    errors: []
  };

  try {
    // Set up progress callback
    appealImportService.setProgressCallback((progress: any) => {
      importProgress.value = {
        stage: progress.stage || 'Processing',
        message: progress.message || 'Processing...',
        processed: progress.processed || 0,
        total: progress.total || 0,
        errors: progress.errors || []
      };
    });

    // Start import with configured settings
    const importStats = await appealImportService.startImport({
      batchSize: importSettings.value.batchSize,
      concurrencyLimit: importSettings.value.concurrencyLimit,
      useFileSystem: false // Always use cold storage
    });
    
    logImport('Import completed successfully', {
      importStats,
      successRate: importStats.totalStored > 0 ? 
        `${((importStats.totalStored / (importStats.totalStored + importStats.errors)) * 100).toFixed(1)}%` : '0%'
    }, 'UnifiedSearchView');

    // Refresh stats after import
    const statsTimer = startTimer('refresh-stats-after-import');
    await loadStats();
    statsTimer.end({ action: 'refresh-stats' });
    
    // Update cold storage stats after import
    try {
      await store.coldStorage.loadCacheStats();
      logUI('Cold storage stats refreshed after import', {
        newStats: store.state.coldStorage.stats
      }, 'UnifiedSearchView');
    } catch (error) {
      console.warn('Failed to refresh cold storage stats:', error);
    }
    
    logUI('Import completed, closing modal in 2 seconds', {
      delayMs: 2000,
      finalStage: importProgress.value.stage,
      importStats
    }, 'UnifiedSearchView');
    
    // Close modal after brief delay
    setTimeout(() => {
      closeImportModal();
    }, 2000);

  } catch (error) {
    logger.importError('Import operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processedBeforeFailure: importProgress.value.processed
    }, 'UnifiedSearchView');
    
    importProgress.value.stage = 'Error';
    importProgress.value.message = `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    importProgress.value.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    isImporting.value = false;
    timer.end({
      finalProcessed: importProgress.value.processed,
      finalErrors: importProgress.value.errors.length
    });
  }
}




// AIDEV-NOTE: formatFileSize and getDecisionColor functions moved to SearchResultCard component

// AIDEV-NOTE: toggleExpandResult and highlightMatches functions moved to SearchResultCard component

async function openDocument(document: any) {
  try {
    // Get the doc_link_span URL from document metadata
    const linkUrl = document.metadata?.doc_link_span;
    
    if (linkUrl && linkUrl !== 'NOT_FOUND') {
      // Open the URL in a new tab
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback if no URL is available
      alert(`No document link available for ${document.filename}\n\nThe document may not have an associated online link.`);
    }
  } catch (error) {
    console.error('Failed to open document:', error);
    alert(`Error opening document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

// AIDEV-NOTE: Authentication handling for cold storage
async function checkColdStorageAuthRequirement(): Promise<boolean> {
  try {
    // Check if cold storage has encrypted batches that require authentication
    const storageInfo = store.state.coldStorage.stats;
    return storageInfo.totalDocuments > 0; // Assume all cold storage requires auth
  } catch (error) {
    console.error('Failed to check cold storage auth requirement:', error);
    return true; // Default to requiring authentication
  }
}


async function authenticateForColdStorage() {
  try {
    // Use global authentication function from App.vue
    const authState = authService.getAuthState();
    
    if (authState.hasChallenge && !authState.isAuthenticated) {
      // Password is set up but user isn't authenticated - show login
      console.log('[UnifiedSearchView] Authentication challenge exists, user needs to login');
      if (typeof window !== 'undefined' && window.showAuthentication) {
        window.showAuthentication(true); // true = login mode
      }
    } else if (!authState.hasChallenge) {
      // No password set up - show setup
      console.log('[UnifiedSearchView] No authentication setup, user needs to create password');
      if (typeof window !== 'undefined' && window.showAuthentication) {
        window.showAuthentication(false); // false = setup mode
      }
    }
    
    // Close the authentication required modal
    authenticationRequired.value = false;
  } catch (error) {
    console.error('Failed to authenticate for cold storage:', error);
    searchError.value = 'Authentication failed. Please try again.';
  }
}

// Debug panel methods
function toggleDebugPanel() {
  showDebugPanel.value = !showDebugPanel.value;
  console.log('[UnifiedSearchView] Debug panel toggled:', showDebugPanel.value);
}

// Track search in debug panel when search completes
function trackSearchInDebugPanel() {
  if (debugPanel.value && searchQuery.value && searchTime.value > 0) {
    const totalResults = results.value.length;
    debugPanel.value.trackSearch(searchQuery.value, totalResults, searchTime.value);
  }
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