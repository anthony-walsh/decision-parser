<template>
  <div class="bg-white rounded-xl shadow-lg border border-pink-200 p-6 mb-6">
    <!-- Header -->
    <div class="flex items-center mb-4">
      <div class="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-800">Search Summary</h3>
    </div>

    <!-- Basic Search Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <!-- Total Results -->
      <div class="bg-blue-50 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-blue-600">{{ summary.totalResults }}</div>
        <div class="text-sm text-blue-800">Total Results</div>
      </div>
      
      <!-- Unique Documents -->
      <div class="bg-green-50 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-green-600">{{ summary.uniqueDocuments }}</div>
        <div class="text-sm text-green-800">Documents Found</div>
      </div>
      
      <!-- Search Time -->
      <div class="bg-purple-50 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-purple-600">{{ summary.searchTime }}ms</div>
        <div class="text-sm text-purple-800">Search Time</div>
      </div>
    </div>

    <!-- Decision Outcomes -->
    <div v-if="summary.decisionBreakdown.total > 0" class="mb-6">
      <h4 class="text-md font-semibold text-gray-700 mb-3">Planning Appeal Decisions</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Allowed Decisions -->
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span class="text-sm font-medium text-green-800">Allowed</span>
            </div>
            <span class="text-lg font-bold text-green-600">{{ summary.decisionBreakdown.allowed }}</span>
          </div>
          <div class="text-xs text-green-700">
            {{ getPercentage(summary.decisionBreakdown.allowed, summary.decisionBreakdown.total) }}%
          </div>
        </div>

        <!-- Dismissed Decisions -->
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span class="text-sm font-medium text-red-800">Dismissed</span>
            </div>
            <span class="text-lg font-bold text-red-600">{{ summary.decisionBreakdown.dismissed }}</span>
          </div>
          <div class="text-xs text-red-700">
            {{ getPercentage(summary.decisionBreakdown.dismissed, summary.decisionBreakdown.total) }}%
          </div>
        </div>

        <!-- Unknown Decisions -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
              <span class="text-sm font-medium text-gray-600">Unknown</span>
            </div>
            <span class="text-lg font-bold text-gray-600">{{ summary.decisionBreakdown.unknown }}</span>
          </div>
          <div class="text-xs text-gray-500">
            {{ getPercentage(summary.decisionBreakdown.unknown, summary.decisionBreakdown.total) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- Match Quality and Coverage -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Match Quality -->
      <div>
        <h4 class="text-md font-semibold text-gray-700 mb-3">Match Quality</h4>
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-600">Average Relevance</span>
            <span class="font-medium text-gray-800">{{ summary.matchQuality.averageScore.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-600">High Quality Matches</span>
            <span class="font-medium text-gray-800">{{ summary.matchQuality.highQualityCount }}</span>
          </div>
        </div>
      </div>

      <!-- Document Coverage -->
      <div>
        <h4 class="text-md font-semibold text-gray-700 mb-3">Coverage</h4>
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-600">Documents with Matches</span>
            <span class="font-medium text-gray-800">{{ summary.uniqueDocuments }} of {{ summary.totalIndexedDocuments }}</span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-600">Coverage Percentage</span>
            <span class="font-medium text-gray-800">{{ getPercentage(summary.uniqueDocuments, summary.totalIndexedDocuments) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Planning Appeal Insights -->
    <div v-if="summary.planningInsights.uniqueLPAs > 0 || summary.planningInsights.uniqueInspectors > 0" class="mt-6 pt-4 border-t border-gray-200">
      <h4 class="text-md font-semibold text-gray-700 mb-3">Planning Appeal Insights</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div v-if="summary.planningInsights.uniqueLPAs > 0">
          <div class="text-lg font-bold text-indigo-600">{{ summary.planningInsights.uniqueLPAs }}</div>
          <div class="text-xs text-indigo-800">Unique LPAs</div>
        </div>
        <div v-if="summary.planningInsights.uniqueInspectors > 0">
          <div class="text-lg font-bold text-indigo-600">{{ summary.planningInsights.uniqueInspectors }}</div>
          <div class="text-xs text-indigo-800">Inspectors</div>
        </div>
        <div v-if="summary.planningInsights.dateRange.start">
          <div class="text-sm font-medium text-indigo-600">{{ summary.planningInsights.dateRange.start }}</div>
          <div class="text-xs text-indigo-800">Earliest Decision</div>
        </div>
        <div v-if="summary.planningInsights.dateRange.end">
          <div class="text-sm font-medium text-indigo-600">{{ summary.planningInsights.dateRange.end }}</div>
          <div class="text-xs text-indigo-800">Latest Decision</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchSummaryData } from '@/types';

// AIDEV-NOTE: SearchSummary component for displaying comprehensive search result statistics
interface Props {
  summary: SearchSummaryData;
}

defineProps<Props>();

function getPercentage(value: number, total: number): string {
  if (total === 0) return '0';
  return ((value / total) * 100).toFixed(1);
}
</script>