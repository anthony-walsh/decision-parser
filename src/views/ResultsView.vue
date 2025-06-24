<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <!-- Header with Search Bar -->
    <div class="bg-white/80 backdrop-blur-sm border-b border-pink-200 sticky top-0 z-10 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-4">
        <div class="flex items-center space-x-4">
          <router-link to="/" class="flex items-center space-x-2 text-gray-800 hover:text-pink-600 transition-colors">
            <div class="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <span class="text-xl font-bold">PDF_Search</span>
          </router-link>
          <div class="flex-1 max-w-2xl">
            <div class="relative bg-white rounded-xl shadow-lg border border-pink-200 overflow-hidden">
              <div class="flex items-center">
                <div class="pl-4 pr-2">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <input
                  v-model="searchQuery"
                  @keyup.enter="performSearch"
                  type="text"
                  class="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0"
                />
                <div class="border-l border-gray-200 px-4 py-2">
                  <select class="bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-600 cursor-pointer">
                    <option>All Documents</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <button
            @click="showSaveSearch = true"
            v-if="searchQuery && results.length > 0"
            class="px-4 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200"
          >
            Save Search
          </button>
        </div>
      </div>
    </div>

    <!-- Results Container -->
    <div class="max-w-6xl mx-auto px-4 py-6">
      <!-- Search Stats -->
      <div class="mb-6">
        <p class="text-sm text-gray-600">
          {{ results.length }} results for "{{ searchQuery }}" ({{ searchTime }}ms)
        </p>
      </div>

      <!-- Search Engine Initializing -->
      <div v-if="searchEngineStatus?.isInitializing" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-gray-600">Initializing search engine...</p>
      </div>

      <!-- Search Engine Error -->
      <div v-else-if="searchEngineStatus?.error" class="text-center py-12">
        <div class="text-red-600 mb-4">
          <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <p class="text-xl text-red-600 mb-4">Search Engine Error</p>
        <p class="text-gray-600 mb-4">{{ searchEngineStatus.error }}</p>
        <button 
          @click="retryInitialization" 
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry Initialization
        </button>
      </div>

      <!-- Search Error -->
      <div v-else-if="searchError" class="text-center py-12">
        <div class="text-red-600 mb-4">
          <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <p class="text-xl text-red-600 mb-4">Search Failed</p>
        <p class="text-gray-600 mb-4">{{ searchError }}</p>
        <div class="space-y-2">
          <button 
            @click="retrySearch" 
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mr-2"
          >
            Retry Search
          </button>
          <button 
            @click="clearError" 
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
          >
            Clear Error
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-gray-600">Searching...</p>
      </div>

      <!-- No Results -->
      <div v-else-if="results.length === 0 && searchQuery && !searchError" class="text-center py-12">
        <p class="text-xl text-gray-600 mb-4">No results found</p>
        <p class="text-gray-500">Try different keywords or check your spelling</p>
      </div>

      <!-- Results List -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="(result, index) in paginatedResults"
          :key="result.document.id"
          class="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-lg transition-all shadow-md"
        >
          <!-- Document Header -->
          <div class="text-center mb-4">
            <div class="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-2">
              {{ result.document.filename.replace('.pdf', '') }}
            </h3>
            <div class="text-sm text-gray-500 space-y-1">
              <div>{{ formatFileSize(result.document.size) }}</div>
              <div class="inline-flex items-center px-2 py-1 rounded-full text-xs" :class="getScoreColor(Math.round((1 - result.overallScore) * 100))">
                Score: {{ Math.round((1 - result.overallScore) * 100) }}%
              </div>
            </div>
          </div>

          <!-- Search Matches -->
          <div class="space-y-3 mb-4">
            <div
              v-for="(match, matchIndex) in result.matches.slice(0, 2)"
              :key="matchIndex"
              class="bg-gray-50 p-3 rounded-lg"
            >
              <p class="text-xs text-gray-600 leading-relaxed" v-html="highlightMatches(match.content, match.matchValue || searchQuery)"></p>
            </div>
            <button
              v-if="result.matches.length > 2"
              @click="toggleExpandResult(index)"
              class="text-xs text-pink-600 hover:text-pink-800 font-medium"
            >
              {{ expandedResults.has(index) ? 'Show Less' : `Show ${result.matches.length - 2} More` }}
            </button>
            <div
              v-if="expandedResults.has(index)"
              class="space-y-2"
            >
              <div
                v-for="(match, matchIndex) in result.matches.slice(2)"
                :key="`expanded-${matchIndex}`"
                class="bg-gray-50 p-3 rounded-lg"
              >
                <p class="text-xs text-gray-600 leading-relaxed" v-html="highlightMatches(match.content, searchQuery)"></p>
              </div>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex justify-center space-x-2">
            <button
              @click="openDocument(result.document)"
              class="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors"
            >
              View Document
            </button>
            <button
              @click="deleteDocument(result.document.id)"
              class="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-300 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="results.length > resultsPerPage" class="mt-12 flex justify-center">
        <div class="flex space-x-2">
          <button
            v-for="page in totalPages"
            :key="page"
            @click="currentPage = page"
            :class="[
              'px-4 py-2 rounded-lg text-sm transition-all shadow-md',
              currentPage === page 
                ? 'bg-pink-500 text-white shadow-pink-200' 
                : 'bg-white text-gray-700 hover:shadow-lg border border-gray-200'
            ]"
          >
            {{ page }}
          </button>
        </div>
      </div>
    </div>

    <!-- Save Search Modal -->
    <div v-if="showSaveSearch" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 class="text-lg font-semibold mb-4">Save Search</h3>
        <input
          v-model="saveSearchName"
          placeholder="Enter a name for this search..."
          class="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div class="flex justify-end space-x-3">
          <button
            @click="showSaveSearch = false"
            class="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            @click="saveSearch"
            :disabled="!saveSearchName.trim()"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { db } from '@/stores/database';
import type { SearchResult } from '@/types';

const router = useRouter();
const route = useRoute();

const searchQuery = ref('');
const results = ref<SearchResult[]>([]);
const isLoading = ref(false);
const searchTime = ref(0);
const currentPage = ref(1);
const resultsPerPage = 20;
const expandedResults = ref(new Set<number>());
const showSaveSearch = ref(false);
const saveSearchName = ref('');
const searchError = ref<string | null>(null);
const searchEngineStatus = ref<{
  initialized: boolean;
  error: string | null;
  isInitializing: boolean;
} | null>(null);

const totalPages = computed(() => Math.ceil(results.value.length / resultsPerPage));
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * resultsPerPage;
  const end = start + resultsPerPage;
  return results.value.slice(start, end);
});

onMounted(async () => {
  // Check search engine status
  updateSearchEngineStatus();
  
  const query = route.query.q as string;
  if (query) {
    searchQuery.value = query;
    await performSearch();
  }
});

watch(() => route.query.q, (newQuery) => {
  if (newQuery && newQuery !== searchQuery.value) {
    searchQuery.value = newQuery as string;
    performSearch();
  }
});

async function performSearch() {
  if (!searchQuery.value.trim()) return;

  // Clear previous errors
  searchError.value = null;
  
  // Update search engine status
  updateSearchEngineStatus();
  
  // Check if search engine is ready
  if (searchEngineStatus.value?.isInitializing) {
    searchError.value = 'Search engine is still initializing. Please wait a moment and try again.';
    return;
  }
  
  if (searchEngineStatus.value?.error) {
    searchError.value = `Search engine initialization failed: ${searchEngineStatus.value.error}`;
    return;
  }
  
  if (!window.searchEngine) {
    searchError.value = 'Search engine is not available. Please refresh the page and try again.';
    return;
  }

  isLoading.value = true;
  currentPage.value = 1;
  expandedResults.value.clear();

  try {
    const startTime = performance.now();
    
    results.value = await window.searchEngine.search(searchQuery.value.trim());
    
    // AIDEV-NOTE: Context extraction is handled by the search engine's extractContext method
    
    const endTime = performance.now();
    searchTime.value = Math.round(endTime - startTime);

    // Update URL without triggering navigation
    if (route.query.q !== searchQuery.value.trim()) {
      await router.replace({
        name: 'results',
        query: { q: searchQuery.value.trim() }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown search error';
    console.error('Search failed:', error);
    searchError.value = `Search failed: ${errorMessage}`;
    results.value = [];
  } finally {
    isLoading.value = false;
  }
}

function toggleExpandResult(index: number) {
  if (expandedResults.value.has(index)) {
    expandedResults.value.delete(index);
  } else {
    expandedResults.value.add(index);
  }
}

function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text;
  
  let highlightedText = text;
  let regex = new RegExp(query, 'gi');
  let span = `<span class='search-highlight'>` + query + `</span>`;
  highlightedText = text.replace(regex, span);
  return highlightedText;
}

async function openDocument(document: any) {
  // For now, just show an alert. In a real app, you'd implement PDF viewing
  alert(`Opening ${document.filename}\n\nNote: PDF viewer not implemented in this demo. In a production app, this would open the PDF in a viewer.`);
}

async function deleteDocument(docId: string) {
  if (confirm('Are you sure you want to delete this document?')) {
    await db.deleteDocument(docId);
    
    // Remove from current results
    results.value = results.value.filter(result => result.document.id !== docId);
    
    // Refresh search engine
    if (window.searchEngine) {
      await window.searchEngine.refresh();
    }
  }
}

async function saveSearch() {
  if (!saveSearchName.value.trim()) return;
  
  await db.addSavedSearch(saveSearchName.value.trim(), searchQuery.value);
  showSaveSearch.value = false;
  saveSearchName.value = '';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

async function retryInitialization() {
  // Reload the page to reinitialize the search engine
  window.location.reload();
}

async function retrySearch() {
  searchError.value = null;
  await performSearch();
}

function clearError() {
  searchError.value = null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

// AIDEV-NOTE: Context extraction is handled by the search engine's extractContext method
</script>

<style>
.search-highlight {
  background-color: #fef3c7;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

.search-highlight-exact {
  background-color: #fbbf24;
  color: #1f2937;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>