<template>
  <!-- AIDEV-NOTE: Extracted search results display with loading, error, and pagination -->
  <div class="max-w-7xl mx-auto px-6 py-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-12">
      <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-blue-600 transition ease-in-out duration-150">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Searching...
      </div>
      
      <!-- Search Status Messages -->
      <div class="mt-4 space-y-2">
        <div v-if="searchStatusMessage" class="text-gray-400 text-sm">
          {{ searchStatusMessage }}
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="searchError" class="text-center py-12">
      <div class="text-red-400 text-lg mb-2">Search Error</div>
      <div class="text-gray-400">{{ searchError }}</div>
    </div>

    <!-- No Results -->
    <div v-else-if="results.length === 0 && searchQuery && !isLoading" class="text-center py-12">
      <div class="text-gray-400 text-lg mb-2">No results found</div>
      <div class="text-gray-500">Try adjusting your search terms or filters</div>
    </div>

    <!-- Results List -->
    <div v-else-if="results.length > 0" class="space-y-4">
      <!-- Results Header -->
      <div class="flex items-center justify-between text-sm text-gray-400 mb-4">
        <div>
          {{ totalResults }} results found in {{ searchTime }}ms
        </div>
        <div v-if="currentPage > 1 || totalResults > resultsPerPage">
          Showing {{ startResult }}-{{ endResult }} of {{ totalResults }}
        </div>
      </div>

      <!-- Result Cards -->
      <div class="space-y-4">
        <SearchResultCard
          v-for="result in paginatedResults"
          :key="result.id"
          :result="result"
          :search-query="searchQuery"
          :opening-document="openingDocument"
          @view-document="$emit('view-document', $event)"
          @hide-document="$emit('hide-document', $event)"
        />
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center mt-8">
        <nav class="flex space-x-2" aria-label="Pagination">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage <= 1"
            class="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-l-lg hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            Previous
          </button>
          
          <template v-for="page in displayedPages" :key="page">
            <button
              v-if="page !== '...'"
              @click="goToPage(page as number)"
              :class="[
                'px-3 py-2 text-sm font-medium border transition-colors',
                page === currentPage
                  ? 'text-white bg-blue-600 border-blue-600'
                  : 'text-gray-300 bg-gray-800 border-gray-600 hover:bg-gray-700 hover:text-white'
              ]"
              :aria-label="`Go to page ${page}`"
              :aria-current="page === currentPage ? 'page' : undefined"
            >
              {{ page }}
            </button>
            <span v-else class="px-3 py-2 text-sm font-medium text-gray-500 bg-gray-800 border border-gray-600">
              ...
            </span>
          </template>

          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-r-lg hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SearchResultCard from './SearchResultCard.vue';
import type { SearchResult } from '@/types';

// Component props
interface Props {
  results: SearchResult[];
  isLoading: boolean;
  searchError: string | null;
  searchQuery: string;
  searchTime: number;
  currentPage: number;
  resultsPerPage: number;
  searchStatusMessage?: string;
  openingDocument?: string | null;
}

const props = defineProps<Props>();

// Component emits
const emit = defineEmits<{
  'update:currentPage': [page: number];
  'view-document': [document: any];
  'hide-document': [documentId: string];
}>();

// Computed properties
const totalResults = computed(() => props.results.length);

const totalPages = computed(() => 
  Math.ceil(totalResults.value / props.resultsPerPage)
);

const startResult = computed(() => 
  (props.currentPage - 1) * props.resultsPerPage + 1
);

const endResult = computed(() => 
  Math.min(props.currentPage * props.resultsPerPage, totalResults.value)
);

const paginatedResults = computed(() => {
  const start = (props.currentPage - 1) * props.resultsPerPage;
  const end = start + props.resultsPerPage;
  return props.results.slice(start, end);
});

const displayedPages = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = props.currentPage;
  
  // Always show first page
  pages.push(1);
  
  if (total <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 2; i <= total; i++) {
      pages.push(i);
    }
  } else {
    // More complex pagination logic
    if (current <= 4) {
      // Show 1, 2, 3, 4, 5, ..., last
      for (let i = 2; i <= 5; i++) {
        pages.push(i);
      }
      if (total > 6) {
        pages.push('...');
        pages.push(total);
      } else if (total === 6) {
        pages.push(6);
      }
    } else if (current >= total - 3) {
      // Show 1, ..., last-4, last-3, last-2, last-1, last
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Show 1, ..., current-1, current, current+1, ..., last
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }
  }
  
  return pages;
});

// Methods
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('update:currentPage', page);
  }
};
</script>