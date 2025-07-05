<template>
  <!-- AIDEV-NOTE: Extracted search stats footer with document counts and debug panel -->
  <div class="bg-gray-800 border-t border-gray-700 mt-8">
    <div class="max-w-7xl mx-auto px-6 py-4">
      <div class="flex items-center justify-between">
        <!-- Document Stats -->
        <div class="flex items-center gap-6 text-sm text-gray-400">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>{{ documentCount }} documents</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <span>{{ indexedCount }} indexed</span>
          </div>
          <div v-if="storageInfo" class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"></path>
            </svg>
            <span>{{ storageInfo }}</span>
          </div>
        </div>

        <!-- Debug Panel Toggle -->
        <div class="flex items-center gap-4">
          <button 
            @click="toggleDebugPanel"
            class="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            :aria-label="showDebugPanel ? 'Hide debug panel' : 'Show debug panel'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            {{ showDebugPanel ? 'Hide' : 'Debug' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Search Debug Panel -->
    <div v-if="showDebugPanel" class="border-t border-gray-700">
      <SearchDebugPanel 
        v-if="searchDebugInfo"
        :debug-info="searchDebugInfo"
        @close="showDebugPanel = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SearchDebugPanel from './SearchDebugPanel.vue';

// Component props
interface Props {
  documentCount: number;
  indexedCount: number;
  storageInfo?: string;
  searchDebugInfo?: any;
}

defineProps<Props>();

// Component emits
defineEmits<{
  'toggle-debug': [show: boolean];
}>();

// Local state
const showDebugPanel = ref(false);

// Methods
const toggleDebugPanel = () => {
  showDebugPanel.value = !showDebugPanel.value;
};
</script>