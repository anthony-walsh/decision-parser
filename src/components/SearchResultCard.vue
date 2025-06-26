<template>
  <!-- AIDEV-NOTE: Reusable search result card component with tier indicators -->
  <div class="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-200 shadow-lg hover:border-gray-600 hover:-translate-y-1 relative">
    <!-- Storage Tier Badge -->
    <div class="absolute top-3 right-3">
      <span 
        :class="[
          'px-2 py-1 text-xs font-medium rounded-full border',
          storageTierBadge.class
        ]"
        :title="storageTierBadge.tooltip"
      >
        {{ storageTierBadge.label }}
      </span>
    </div>

    <!-- Document Header -->
    <div class="text-center mb-3">
      <div class="w-12 h-12 mx-auto mb-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </div>
      <h3 class="text-sm font-semibold text-gray-200 mb-1">
        {{ displayFilename }}
      </h3>
      <div class="text-xs text-gray-400">
        <div>{{ formatFileSize(result.document.size) }}</div>
      </div>
    </div>

    <!-- Appeal Metadata Display -->
    <div class="bg-blue-900/20 p-2 rounded-lg mb-3 text-xs border border-blue-800/30">
      <h4 class="font-semibold text-blue-300 mb-1">Appeal Details</h4>
      <div class="grid grid-cols-1 gap-0.5 text-blue-200">
        <div>
          <span class="font-medium">Appeal Ref: </span> 
          <span :class="metadata.appealReferenceNumber === 'NOT_FOUND' ? 'text-gray-500' : ''">
            {{ metadata.appealReferenceNumber || 'NOT_FOUND' }}
          </span>
        </div>
        <div>
          <span class="font-medium">LPA: </span> 
          <span :class="metadata.lpa === 'NOT_FOUND' ? 'text-gray-500' : ''">
            {{ metadata.lpa || 'NOT_FOUND' }}
          </span>
        </div>
        <div>
          <span class="font-medium">Decision: </span> 
          <span :class="metadata.decisionOutcome === 'NOT_FOUND' ? 'text-gray-500' : getDecisionColor(metadata.decisionOutcome)">
            {{ metadata.decisionOutcome || 'NOT_FOUND' }}
          </span>
        </div>
        <div>
          <span class="font-medium">Decision Date: </span> 
          <span :class="metadata.decisionDate === 'NOT_FOUND' ? 'text-gray-500' : ''">
            {{ metadata.decisionDate || 'NOT_FOUND' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Search Matches -->
    <div class="space-y-2 mb-3">
      <div
        v-for="(match, matchIndex) in visibleMatches"
        :key="matchIndex"
        class="bg-gray-700/50 p-2 rounded-lg border border-gray-600"
      >
        <p class="text-xs text-gray-300 leading-relaxed" v-html="highlightMatches(match.content, match.matchValue || searchQuery)"></p>
      </div>
      
      <!-- Expand/Collapse Button -->
      <button
        v-if="result.matches.length > maxVisibleMatches"
        @click="toggleExpanded"
        class="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
      >
        {{ isExpanded ? 'Show Less' : `Show ${result.matches.length - maxVisibleMatches} More` }}
      </button>
      
      <!-- Expanded Matches -->
      <div v-if="isExpanded" class="space-y-2">
        <div
          v-for="(match, matchIndex) in expandedMatches"
          :key="`expanded-${matchIndex}`"
          class="bg-gray-700/50 p-2 rounded-lg border border-gray-600"
        >
          <p class="text-xs text-gray-300 leading-relaxed" v-html="highlightMatches(match.content, searchQuery)"></p>
        </div>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="flex justify-center gap-2">
      <button
        @click="$emit('view-document', result.document)"
        class="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg text-xs hover:from-blue-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium shadow-md hover:shadow-lg"
        :aria-label="`View document ${result.document.filename}`"
      >
        View Document
      </button>
      <button
        @click="$emit('hide-document', result.document.id)"
        class="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all border border-gray-600 shadow-md hover:shadow-lg"
        :aria-label="`Hide document ${result.document.filename}`"
      >
        Hide
      </button>
    </div>

    <!-- Performance Indicators -->
    <div v-if="showPerformanceInfo" class="mt-3 pt-2 border-t border-gray-700">
      <div class="flex justify-between items-center text-xs text-gray-500">
        <span>Score: {{ result.overallScore.toFixed(3) }}</span>
        <span>{{ result.matches.length }} matches</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStorageStore } from '@/stores';
import type { SearchResult } from '@/types';

// Component props
interface Props {
  result: SearchResult;
  searchQuery: string;
  maxVisibleMatches?: number;
  showPerformanceInfo?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  maxVisibleMatches: 2,
  showPerformanceInfo: false
});

// Emits
defineEmits<{
  'view-document': [document: any];
  'hide-document': [documentId: string];
}>();

// Store
const store = useStorageStore();

// Component state
const isExpanded = ref(false);

// Computed properties
const displayFilename = computed(() => {
  return props.result.document.filename.replace('.pdf', '');
});

const metadata = computed(() => {
  return props.result.document.metadata || {
    appealReferenceNumber: 'NOT_FOUND',
    lpa: 'NOT_FOUND', 
    decisionOutcome: 'NOT_FOUND',
    decisionDate: 'NOT_FOUND'
  };
});

const visibleMatches = computed(() => {
  return props.result.matches.slice(0, props.maxVisibleMatches);
});

const expandedMatches = computed(() => {
  return props.result.matches.slice(props.maxVisibleMatches);
});

// AIDEV-NOTE: Storage tier badge logic - determines hot vs cold storage
const storageTierBadge = computed(() => {
  // Check if this result came from hot storage (recent documents)
  const isHotStorage = store.state.search.results.hot.some(hotResult => 
    hotResult.document.id === props.result.document.id
  );
  
  if (isHotStorage) {
    return {
      label: 'Recent',
      class: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      tooltip: 'This document is in hot storage (recently uploaded or accessed)'
    };
  } else {
    // Check if it's from cold storage
    const isColdStorage = store.state.search.results.cold.some(coldResult => 
      coldResult.id === props.result.document.id
    );
    
    if (isColdStorage) {
      return {
        label: 'Archive',
        class: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        tooltip: 'This document is in cold storage (archived for space optimization)'
      };
    } else {
      // Fallback for unknown tier
      return {
        label: 'Unknown',
        class: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
        tooltip: 'Storage tier could not be determined'
      };
    }
  }
});

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDecisionColor(decision: string | undefined): string {
  if (decision === 'Allowed') return 'text-green-400 font-semibold';
  if (decision === 'Dismissed') return 'text-red-400 font-semibold';
  return 'text-gray-400';
}

function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text;
  
  // Split query into individual words for better highlighting
  const words = query.trim().split(/\s+/);
  let highlightedText = text;
  
  words.forEach(word => {
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<span class="bg-yellow-500/30 text-yellow-200 px-1 rounded font-medium">$1</span>');
  });
  
  return highlightedText;
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>