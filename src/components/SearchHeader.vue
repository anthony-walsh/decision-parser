<template>
  <!-- AIDEV-NOTE: Extracted search header with branding, search bar, and actions -->
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
              :value="searchQuery"
              @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
              @keyup.enter="$emit('search')"
              type="text"
              placeholder="Ask me anything..."
              class="flex-1 px-4 py-3 text-base bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-inset text-white placeholder-gray-400"
              aria-label="Search query"
            />
            <button 
              @click="$emit('search')"
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
        <!-- AIDEV-NOTE: Import button only shown in production mode -->
        <button 
          v-if="isImportEnabled"
          @click="$emit('import')"
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
        
        <!-- Development mode indicator -->
        <div v-if="!isImportEnabled" class="px-6 py-2 bg-gray-700 text-gray-400 rounded-lg border border-gray-600">
          <span class="text-sm">Development Mode - Using Test Data</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isImportEnabled as getIsImportEnabled } from '@/utils/environment';

// Component props
interface Props {
  searchQuery: string;
  isImporting: boolean;
}

defineProps<Props>();

// Component emits
defineEmits<{
  'update:searchQuery': [value: string];
  search: [];
  import: [];
}>();

// Environment-based functionality
const isImportEnabled = computed(() => getIsImportEnabled());
</script>