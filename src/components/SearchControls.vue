<template>
  <!-- AIDEV-NOTE: Extracted search controls for sensitivity, date filters, and metadata -->
  <div class="max-w-7xl mx-auto px-6 py-3">
    <!-- Search Sensitivity Slider -->
    <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 mb-3">
      <div class="flex items-center justify-between mb-2">
        <label class="text-base font-medium text-gray-200">Search Sensitivity</label>
        <span class="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded-full">{{ thresholdLabel }}</span>
      </div>
      <div class="relative">
        <input
          :value="searchThreshold"
          @input="$emit('update:searchThreshold', Number(($event.target as HTMLInputElement).value))"
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
    <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 mb-3">
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
          :value="dateFilter.laterThan"
          @change="updateDateValue('laterThan', ($event.target as HTMLInputElement).value)"
          type="date"
          class="block w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      <div v-if="dateFilter.type === 'earlierThan'" class="space-y-2">
        <label class="text-xs text-gray-400">No later than:</label>
        <input
          :value="dateFilter.earlierThan"
          @change="updateDateValue('earlierThan', ($event.target as HTMLInputElement).value)"
          type="date"
          class="block w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      <div v-if="dateFilter.type === 'range'" class="space-y-2">
        <label class="text-xs text-gray-400">Date range:</label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label class="text-xs text-gray-400">From:</label>
            <input
              :value="dateFilter.from"
              @change="updateDateValue('from', ($event.target as HTMLInputElement).value)"
              type="date"
              class="block w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label class="text-xs text-gray-400">To:</label>
            <input
              :value="dateFilter.to"
              @change="updateDateValue('to', ($event.target as HTMLInputElement).value)"
              type="date"
              class="block w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      <!-- Clear Date Filter Button -->
      <div v-if="dateFilter.type !== 'all'" class="mt-3">
        <button 
          @click="clearDateFilter"
          class="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear date filter
        </button>
      </div>
    </div>

    <!-- Advanced Metadata Filters Section -->
    <div class="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4">
      <!-- Filter Header with Toggle -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-medium text-gray-200">Advanced Filters</h3>
        <button 
          @click="showAdvancedFilters = !showAdvancedFilters"
          class="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          {{ showAdvancedFilters ? 'Hide' : 'Show' }}
          <svg 
            :class="['w-4 h-4 transition-transform', showAdvancedFilters ? 'rotate-180' : '']"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
      </div>

      <!-- Expandable Filter Controls -->
      <div v-if="showAdvancedFilters" class="space-y-4">
        <!-- Case Information Filters -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- LPA Names Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-200 mb-1">
              Local Planning Authority
            </label>
            <MultiSelect
              :modelValue="metadataFilters.lpaNames"
              @update:modelValue="updateMetadataFilter('lpaNames', $event)"
              :options="filterOptions.lpaNames"
              placeholder="Select LPA..."
              :maxSelectedLabels="2"
              class="w-full"
              :pt="multiselectPt"
            />
          </div>

          <!-- Case Types Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-200 mb-1">
              Case Type
            </label>
            <MultiSelect
              :modelValue="metadataFilters.caseTypes"
              @update:modelValue="updateMetadataFilter('caseTypes', $event)"
              :options="filterOptions.caseTypes"
              placeholder="Select case types..."
              :maxSelectedLabels="2"
              class="w-full"
              :pt="multiselectPt"
            />
          </div>

          <!-- Case Officers Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-200 mb-1">
              Case Officer
            </label>
            <MultiSelect
              :modelValue="metadataFilters.caseOfficers"
              @update:modelValue="updateMetadataFilter('caseOfficers', $event)"
              :options="filterOptions.caseOfficers"
              placeholder="Select officers..."
              :maxSelectedLabels="2"
              class="w-full"
              :pt="multiselectPt"
            />
          </div>

          <!-- Procedures Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-200 mb-1">
              Procedure
            </label>
            <MultiSelect
              :modelValue="metadataFilters.procedures"
              @update:modelValue="updateMetadataFilter('procedures', $event)"
              :options="filterOptions.procedures"
              placeholder="Select procedures..."
              :maxSelectedLabels="2"
              class="w-full"
              :pt="multiselectPt"
            />
          </div>

          <!-- Statuses Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-200 mb-1">
              Status
            </label>
            <MultiSelect
              :modelValue="metadataFilters.statuses"
              @update:modelValue="updateMetadataFilter('statuses', $event)"
              :options="filterOptions.statuses"
              placeholder="Select statuses..."
              :maxSelectedLabels="2"
              class="w-full"
              :pt="multiselectPt"
            />
          </div>

          <!-- Decision Outcomes Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-200 mb-1">
              Decision Outcome
            </label>
            <MultiSelect
              :modelValue="metadataFilters.decisionOutcomes"
              @update:modelValue="updateMetadataFilter('decisionOutcomes', $event)"
              :options="filterOptions.decisionOutcomes"
              placeholder="Select outcomes..."
              :maxSelectedLabels="2"
              class="w-full"
              :pt="multiselectPt"
            />
          </div>
        </div>

        <!-- Clear All Filters Button -->
        <div class="flex justify-end">
          <button 
            @click="clearAllFilters"
            class="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear all filters
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import MultiSelect from 'primevue/multiselect';
import type { DateFilter, MetadataFilters, FilterOptions } from '@/types';

// Component props
interface Props {
  searchThreshold: number;
  dateFilter: DateFilter;
  metadataFilters: MetadataFilters;
  filterOptions: FilterOptions;
}

const props = defineProps<Props>();

// Component emits
const emit = defineEmits<{
  'update:searchThreshold': [value: number];
  'update:dateFilter': [filter: DateFilter];
  'update:metadataFilters': [filters: MetadataFilters];
}>();

// Local state
const showAdvancedFilters = ref(false);

// Computed properties
const thresholdLabel = computed(() => {
  if (props.searchThreshold <= 0.2) return 'Very Fuzzy';
  if (props.searchThreshold <= 0.4) return 'Fuzzy';
  if (props.searchThreshold <= 0.6) return 'Balanced';
  if (props.searchThreshold <= 0.8) return 'Sensitive';
  return 'Very Sensitive';
});

// PrimeVue MultiSelect styling
const multiselectPt = {
  root: { 
    class: 'bg-gray-700 border-gray-600 text-white min-h-[2.5rem]' 
  },
  labelContainer: { 
    class: 'text-white' 
  },
  label: { 
    class: 'text-white placeholder-gray-400' 
  },
  trigger: { 
    class: 'text-gray-400' 
  },
  panel: { 
    class: 'bg-gray-700 border-gray-600' 
  },
  item: { 
    class: 'text-white hover:bg-gray-600 focus:bg-gray-600' 
  },
  itemGroup: { 
    class: 'text-gray-300 bg-gray-800' 
  },
  checkboxContainer: { 
    class: 'mr-2' 
  },
  checkbox: { 
    class: 'border-gray-500' 
  },
  closeButton: { 
    class: 'text-gray-400 hover:text-white' 
  }
};

// Methods
const updateDateFilter = (type: DateFilter['type']) => {
  const newFilter: DateFilter = { ...props.dateFilter, type };
  emit('update:dateFilter', newFilter);
};

const updateDateValue = (field: string, value: string) => {
  const newFilter = { ...props.dateFilter, [field]: value };
  emit('update:dateFilter', newFilter);
};

const clearDateFilter = () => {
  const newFilter: DateFilter = {
    type: 'all',
    laterThan: '',
    earlierThan: '',
    from: '',
    to: ''
  };
  emit('update:dateFilter', newFilter);
};

const updateMetadataFilter = (field: keyof MetadataFilters, value: string[]) => {
  const newFilters = { ...props.metadataFilters, [field]: value };
  emit('update:metadataFilters', newFilters);
};

const clearAllFilters = () => {
  const clearedFilters: MetadataFilters = {
    lpaNames: [],
    caseTypes: [],
    caseOfficers: [],
    procedures: [],
    statuses: [],
    decisionOutcomes: []
  };
  emit('update:metadataFilters', clearedFilters);
  clearDateFilter();
};
</script>

<style scoped>
/* Dark theme slider styling */
.slider-dark::-webkit-slider-thumb {
  appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #1f2937;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5);
}

.slider-dark::-moz-range-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #1f2937;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5);
}
</style>