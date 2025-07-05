<template>
  <!-- AIDEV-NOTE: Extracted import modal for appeal cases import functionality -->
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-white">Import Appeal Decision Letters</h2>
          <button 
            @click="$emit('close')"
            class="text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Import Configuration -->
        <div v-if="!isImporting">
          <!-- Import Settings -->
          <div class="space-y-4 mb-6">
            <div>
              <label class="block text-sm font-medium text-gray-200 mb-2">Import Mode</label>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input 
                    v-model="importConfig.mode" 
                    type="radio" 
                    value="sample" 
                    class="mr-2 text-blue-600"
                  />
                  <span class="text-gray-300">Sample Import (First 100 cases)</span>
                </label>
                <label class="flex items-center">
                  <input 
                    v-model="importConfig.mode" 
                    type="radio" 
                    value="full" 
                    class="mr-2 text-blue-600"
                  />
                  <span class="text-gray-300">Full Import (All available cases)</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-200 mb-2">Batch Size</label>
              <select 
                v-model="importConfig.batchSize" 
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="100">100 cases per batch</option>
                <option value="500">500 cases per batch</option>
                <option value="1000">1000 cases per batch</option>
              </select>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3 justify-end">
            <button 
              @click="$emit('close')"
              class="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-colors"
            >
              Cancel
            </button>
            <button 
              @click="startImport"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors"
            >
              Start Import
            </button>
          </div>
        </div>

        <!-- Import Progress -->
        <div v-else>
          <!-- Progress Header -->
          <div class="mb-4">
            <div class="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>{{ importProgress.stage }}</span>
              <span>{{ importProgress.processed }} / {{ importProgress.total }}</span>
            </div>
            <div class="text-gray-300 text-sm mb-2">{{ importProgress.message }}</div>
          </div>

          <!-- Progress Bar -->
          <div class="w-full bg-gray-700 rounded-full h-2 mb-4">
            <div 
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>

          <!-- Progress Stats -->
          <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div class="bg-gray-700 rounded-lg p-3">
              <div class="text-gray-400">Processed</div>
              <div class="text-white font-medium">{{ importProgress.processed }} cases</div>
            </div>
            <div class="bg-gray-700 rounded-lg p-3">
              <div class="text-gray-400">Errors</div>
              <div class="text-white font-medium">{{ importProgress.errors.length }} cases</div>
            </div>
            <div class="bg-gray-700 rounded-lg p-3">
              <div class="text-gray-400">Progress</div>
              <div class="text-white font-medium">{{ progressPercentage.toFixed(1) }}%</div>
            </div>
            <div class="bg-gray-700 rounded-lg p-3">
              <div class="text-gray-400">Estimated Time</div>
              <div class="text-white font-medium">{{ estimatedTimeRemaining }}</div>
            </div>
          </div>

          <!-- Error Log -->
          <div v-if="importProgress.errors.length > 0" class="mb-4">
            <div class="text-sm font-medium text-gray-200 mb-2">
              Recent Errors ({{ importProgress.errors.length }})
            </div>
            <div class="bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div 
                v-for="(error, index) in recentErrors" 
                :key="index"
                class="text-xs text-red-400 mb-1"
              >
                {{ error }}
              </div>
            </div>
          </div>

          <!-- Cancel Import Button -->
          <div class="flex justify-end">
            <button 
              @click="cancelImport"
              class="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-colors"
            >
              Cancel Import
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

// Component props
interface Props {
  show: boolean;
  isImporting: boolean;
  importProgress: {
    stage: string;
    message: string;
    processed: number;
    total: number;
    errors: string[];
  };
}

const props = defineProps<Props>();

// Component emits
const emit = defineEmits<{
  close: [];
  'start-import': [config: ImportConfig];
  'cancel-import': [];
}>();

// Types
interface ImportConfig {
  mode: 'sample' | 'full';
  batchSize: number;
}

// Local state
const importConfig = ref<ImportConfig>({
  mode: 'sample',
  batchSize: 100
});

// Computed properties
const progressPercentage = computed(() => {
  if (props.importProgress.total === 0) return 0;
  return (props.importProgress.processed / props.importProgress.total) * 100;
});

const estimatedTimeRemaining = computed(() => {
  if (props.importProgress.processed === 0 || props.importProgress.total === 0) {
    return 'Calculating...';
  }
  
  const remaining = props.importProgress.total - props.importProgress.processed;
  if (remaining <= 0) return 'Almost done...';
  
  // Rough estimate based on current progress
  const avgTimePerCase = 2; // seconds per case (rough estimate)
  const totalSeconds = remaining * avgTimePerCase;
  
  if (totalSeconds < 60) {
    return `${Math.ceil(totalSeconds)}s`;
  } else if (totalSeconds < 3600) {
    return `${Math.ceil(totalSeconds / 60)}m`;
  } else {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.ceil((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
});

const recentErrors = computed(() => {
  return props.importProgress.errors.slice(-5); // Show last 5 errors
});

// Methods
const startImport = () => {
  emit('start-import', { ...importConfig.value });
};

const cancelImport = () => {
  emit('cancel-import');
};
</script>