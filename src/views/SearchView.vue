<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
    <!-- Main Content Container -->
    <div class="flex-1 flex flex-col justify-start items-center px-4 py-8 pt-24">
      <!-- Logo Section -->
      <div class="text-center mb-16">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full mb-6">
          <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
        </div>
        <h1 class="text-5xl font-bold text-gray-800 mb-4">PDF_Search</h1>
        <p class="text-gray-600 text-xl">Search documents on your device</p>
      </div>

      <!-- Search Bar -->
      <div class="w-full max-w-2xl mb-32 pt-8">
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
            placeholder="Enter search term..."
            class="flex-1 px-4 py-4 text-lg border-0 focus:outline-none focus:ring-0"
          />
        </div>
      </div>

      </div>

      <!-- Spacer -->
      <div class="h-16"></div>

      <!-- Search buttons -->
      <div class="flex justify-center gap-16 mb-32 pt-8">
        <button
          @click="performSearch"
          :disabled="!searchQuery.trim()"
          class="px-10 py-4 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-200 text-lg"
        >
          PDF Search
        </button>
        <button
          @click="showUploadModal = true"
          class="px-10 py-4 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 text-lg"
        >
          Upload PDFs
        </button>
        <button
          @click="clearAllPDFs"
          :disabled="documentCount === 0"
          class="px-10 py-4 bg-red-500 text-white rounded-lg shadow-md hover:shadow-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
        >
          Clear PDFs
        </button>
      </div>

      <!-- Spacer -->
      <div class="h-16"></div>

      <!-- Document Stats -->
      <div class="text-center mb-32 pt-8">
        <div class="text-sm text-gray-500">
          <p v-if="documentCount > 0">
            {{ documentCount }} documents indexed | {{ indexedCount }} searchable
          </p>
          <p v-else class="text-gray-400">
            No documents uploaded yet. Click "Upload PDFs" to get started.
          </p>
        </div>
      </div>

      <!-- Recent Searches -->
      <div v-if="recentSearches.length > 0" class="w-full max-w-4xl mb-16">
        <h3 class="text-xl font-semibold text-gray-800 mb-8 text-center">Recent Searches</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button
            v-for="search in recentSearches"
            :key="search.id"
            @click="searchQuery = search.query; performSearch()"
            class="bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6 text-left border border-gray-100"
          >
            <div class="text-sm font-medium text-gray-800 mb-2">"{{ search.query }}"</div>
            <div class="text-xs text-gray-500">{{ search.resultCount }} results</div>
          </button>
        </div>
      </div>

      <!-- Saved Searches -->
      <div v-if="savedSearches.length > 0" class="w-full max-w-4xl mb-16">
        <h3 class="text-xl font-semibold text-gray-800 mb-8 text-center">Saved Searches</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="search in savedSearches"
            :key="search.id"
            class="bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6 border border-gray-100"
          >
            <button
              @click="searchQuery = search.query; performSearch()"
              class="w-full text-left mb-3"
            >
              <div class="text-sm font-medium text-gray-800 mb-1">{{ search.name }}</div>
              <div class="text-xs text-gray-500">"{{ search.query }}"</div>
            </button>
            <button
              @click="deleteSavedSearch(search.id)"
              class="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-semibold">Upload PDF Documents</h2>
            <button @click="closeUploadModal" class="text-gray-500 hover:text-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <UploadComponent @upload-complete="handleUploadComplete" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { db } from '@/stores/database';
import type { SearchHistory, SavedSearch } from '@/types';
import UploadComponent from '@/components/UploadComponent.vue';

const router = useRouter();
const searchQuery = ref('');
const showUploadModal = ref(false);
const documentCount = ref(0);
const indexedCount = ref(0);
const recentSearches = ref<SearchHistory[]>([]);
const savedSearches = ref<SavedSearch[]>([]);

onMounted(async () => {
  await loadStats();
  await loadSearchHistory();
  await loadSavedSearches();
});

async function loadStats() {
  const [docs, indices] = await Promise.all([
    db.getAllDocuments(),
    db.getAllSearchIndices()
  ]);
  documentCount.value = docs.length;
  indexedCount.value = indices.length;
}

async function loadSearchHistory() {
  // AIDEV-NOTE: Clean up any existing duplicates before loading search history
  await db.cleanupDuplicateSearchHistory();
  recentSearches.value = await db.getSearchHistory();
}

async function loadSavedSearches() {
  savedSearches.value = await db.getSavedSearches();
}

async function performSearch() {
  if (!searchQuery.value.trim()) return;
  
  await router.push({
    name: 'results',
    query: { q: searchQuery.value.trim() }
  });
}

function closeUploadModal() {
  showUploadModal.value = false;
}

async function handleUploadComplete() {
  showUploadModal.value = false;
  await loadStats();
  
  // Refresh search engine
  if (window.searchEngine) {
    await window.searchEngine.refresh();
  }
}

async function deleteSavedSearch(id: string) {
  await db.deleteSavedSearch(id);
  await loadSavedSearches();
}

async function clearAllPDFs() {
  if (confirm('Are you sure you want to clear all PDFs? This action cannot be undone.')) {
    await db.clearAllData();
    await loadStats();
    await loadSearchHistory();
    await loadSavedSearches();
    
    // Refresh search engine
    if (window.searchEngine) {
      await window.searchEngine.refresh();
    }
  }
}
</script>

<style>
.search-highlight {
  background-color: #fef3c7;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-weight: 600;
}
</style>