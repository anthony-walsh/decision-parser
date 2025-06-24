<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { SearchEngine } from '@/utils/searchEngine';

let searchEngine: SearchEngine | null = null;
const initializationError = ref<string | null>(null);
const isInitializing = ref(true);

onMounted(async () => {
  try {
    searchEngine = new SearchEngine();
    await searchEngine.initialize();
    
    // Make search engine available globally
    if (typeof window !== 'undefined') {
      window.searchEngine = searchEngine;
      window.searchEngineStatus = {
        initialized: true,
        error: null,
        isInitializing: false
      };
      
    }
    isInitializing.value = false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    
    initializationError.value = errorMessage;
    isInitializing.value = false;
    
    // Make error status available globally
    if (typeof window !== 'undefined') {
      window.searchEngine = null;
      window.searchEngineStatus = {
        initialized: false,
        error: errorMessage,
        isInitializing: false
      };
    }
  }
});

// Make search engine available globally
declare global {
  interface Window {
    searchEngine: SearchEngine | null;
    searchEngineStatus: {
      initialized: boolean;
      error: string | null;
      isInitializing: boolean;
    };
  }
}
</script>