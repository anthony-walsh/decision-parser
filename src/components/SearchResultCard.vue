<template>
  <!-- AIDEV-NOTE: Reusable search result card component with tier indicators -->
  <div class="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-200 shadow-lg hover:border-gray-600 hover:-translate-y-1 relative">
    <!-- Document Header -->
    <div class="text-center mb-3">
      <h3 class="text-sm font-semibold text-gray-200 mb-1">
        {{ displayFilename }}
      </h3>
    </div>

    <!-- Comprehensive Metadata Display -->
    <div class="space-y-3 mb-3">
      <!-- Case Information -->
      <div class="bg-blue-900/20 p-3 rounded-lg text-xs border border-blue-800/30">
        <h4 class="font-semibold text-blue-300 mb-2">Case Information</h4>
        <div class="grid grid-cols-1 gap-1 text-blue-200">
          <div><span class="font-medium">Case Type:</span> {{ getMetadataValue('case_type') }}</div>
          <div><span class="font-medium">Case ID:</span> {{ getMetadataValue('case_id') }}</div>
          <div><span class="font-medium">LPA Name:</span> {{ getMetadataValue('lpa_name') }}</div>
          <div><span class="font-medium">Case Officer:</span> {{ getMetadataValue('case_officer') }}</div>
          <div><span class="font-medium">Procedure:</span> {{ getMetadataValue('procedure') }}</div>
          <div><span class="font-medium">Status:</span> {{ getMetadataValue('status') }}</div>
        </div>
      </div>

      <!-- Important Dates -->
      <div class="bg-green-900/20 p-3 rounded-lg text-xs border border-green-800/30">
        <h4 class="font-semibold text-green-300 mb-2">Important Dates</h4>
        <div class="grid grid-cols-1 gap-1 text-green-200">
          <div><span class="font-medium">Start Date:</span> {{ getMetadataValue('start_date') }}</div>
          <div><span class="font-medium">Questionnaire Due:</span> {{ getMetadataValue('questionnaire_due') }}</div>
          <div><span class="font-medium">Statement Due:</span> {{ getMetadataValue('statement_due') }}</div>
          <div><span class="font-medium">Interested Party Comments Due:</span> {{ getMetadataValue('interested_party_comments_due') }}</div>
          <div><span class="font-medium">Final Comments Due:</span> {{ getMetadataValue('final_comments_due') }}</div>
          <div><span class="font-medium">Inquiry Evidence Due:</span> {{ getMetadataValue('inquiry_evidence_due') }}</div>
          <div><span class="font-medium">Event Date:</span> {{ getMetadataValue('event_date') }}</div>
        </div>
      </div>

      <!-- Decision Information -->
      <div class="bg-purple-900/20 p-3 rounded-lg text-xs border border-purple-800/30">
        <h4 class="font-semibold text-purple-300 mb-2">Decision Information</h4>
        <div class="grid grid-cols-1 gap-1 text-purple-200">
          <div>
            <span class="font-medium">Decision Outcome:</span> 
            <span :class="getDecisionColor(getMetadataValue('decision_outcome'))">
              {{ getMetadataValue('decision_outcome') }}
            </span>
          </div>
          <div><span class="font-medium">Decision Date:</span> {{ getMetadataValue('decision_date') }}</div>
          <div><span class="font-medium">Link Status:</span> {{ getMetadataValue('link_status') }}</div>
          <div><span class="font-medium">Linked Case Count:</span> {{ getMetadataValue('linked_case_count') }}</div>
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
        View Online
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


// Component state
const isExpanded = ref(false);

// Computed properties
const displayFilename = computed(() => {
  return props.result.document.filename.replace('.pdf', '');
});

const metadata = computed(() => {
  return props.result.document.metadata || {};
});

const visibleMatches = computed(() => {
  return props.result.matches.slice(0, props.maxVisibleMatches);
});

const expandedMatches = computed(() => {
  return props.result.matches.slice(props.maxVisibleMatches);
});


// Helper functions
function getMetadataValue(field: string): string {
  const value = (metadata.value as any)?.[field];
  if (value === undefined || value === null || value === '' || value === 'NOT_FOUND') {
    return 'NOT_FOUND';
  }
  return String(value);
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
    highlightedText = highlightedText.replace(regex, '<span class="bg-blue-500/40 text-blue-100 px-1 rounded font-medium">$1</span>');
  });
  
  return highlightedText;
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>