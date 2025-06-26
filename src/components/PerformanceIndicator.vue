<template>
  <!-- AIDEV-NOTE: Performance indicator component for real-time system status -->
  <div class="fixed bottom-4 right-4 z-50">
    <!-- Performance Panel Toggle -->
    <button
      @click="togglePanel"
      :class="[
        'mb-2 w-12 h-12 rounded-full shadow-lg transition-all duration-200',
        'flex items-center justify-center text-white text-sm font-medium',
        getStatusColor(),
        isExpanded ? 'scale-110' : 'hover:scale-105'
      ]"
      :title="getStatusText()"
    >
      <svg v-if="!isLoading" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
      </svg>
      <div v-else class="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
    </button>

    <!-- Expanded Performance Panel -->
    <div
      v-if="isExpanded"
      class="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 min-w-80 max-w-96"
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-white font-semibold text-sm">Performance Monitor</h3>
        <button
          @click="togglePanel"
          class="text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Memory Usage -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-gray-300 text-xs">Memory Usage</span>
          <span class="text-gray-300 text-xs">{{ memoryStats.current }}MB</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div
            :class="[
              'h-2 rounded-full transition-all duration-500',
              getMemoryBarColor()
            ]"
            :style="{ width: memoryPercentage + '%' }"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>0MB</span>
          <span>{{ memoryStats.threshold }}MB</span>
        </div>
      </div>

      <!-- Search Performance -->
      <div class="mb-4">
        <h4 class="text-gray-300 text-xs font-medium mb-2">Search Performance</h4>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-gray-700/50 rounded-lg p-2">
            <div class="text-xs text-gray-400">Hot Storage</div>
            <div class="text-sm text-white font-medium">
              {{ searchStats.hotAverage }}ms
            </div>
          </div>
          <div class="bg-gray-700/50 rounded-lg p-2">
            <div class="text-xs text-gray-400">Cold Storage</div>
            <div class="text-sm text-white font-medium">
              {{ searchStats.coldAverage }}ms
            </div>
          </div>
        </div>
      </div>

      <!-- Active Operations -->
      <div v-if="activeOperations.length > 0" class="mb-4">
        <h4 class="text-gray-300 text-xs font-medium mb-2">Active Operations</h4>
        <div class="space-y-1">
          <div
            v-for="operation in activeOperations.slice(0, 3)"
            :key="operation.id"
            class="bg-blue-900/20 border border-blue-800/30 rounded-lg p-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-blue-300 text-xs truncate">{{ operation.description }}</span>
              <div class="animate-spin rounded-full h-3 w-3 border border-blue-400 border-t-transparent"></div>
            </div>
          </div>
          <div v-if="activeOperations.length > 3" class="text-gray-500 text-xs text-center">
            +{{ activeOperations.length - 3 }} more operations
          </div>
        </div>
      </div>

      <!-- Recent Alerts -->
      <div v-if="recentAlerts.length > 0" class="mb-4">
        <h4 class="text-gray-300 text-xs font-medium mb-2">Recent Alerts</h4>
        <div class="space-y-1">
          <div
            v-for="alert in recentAlerts.slice(0, 2)"
            :key="alert.id"
            :class="[
              'rounded-lg p-2 text-xs',
              getAlertColor(alert.severity)
            ]"
          >
            <div class="font-medium">{{ alert.type.replace('_', ' ').toUpperCase() }}</div>
            <div class="opacity-80">{{ alert.message }}</div>
          </div>
        </div>
      </div>

      <!-- Resource Status -->
      <div class="mb-4">
        <h4 class="text-gray-300 text-xs font-medium mb-2">Resource Status</h4>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center space-x-2">
            <div :class="[
              'w-2 h-2 rounded-full',
              resourceStatus.isOnline ? 'bg-green-400' : 'bg-red-400'
            ]"></div>
            <span class="text-xs text-gray-300">
              {{ resourceStatus.isOnline ? 'Online' : 'Offline' }}
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <div :class="[
              'w-2 h-2 rounded-full',
              resourceStatus.wakeLock ? 'bg-blue-400' : 'bg-gray-500'
            ]"></div>
            <span class="text-xs text-gray-300">
              {{ resourceStatus.wakeLock ? 'Wake Lock' : 'No Lock' }}
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <div :class="[
              'w-2 h-2 rounded-full',
              resourceStatus.isVisible ? 'bg-green-400' : 'bg-yellow-400'
            ]"></div>
            <span class="text-xs text-gray-300">
              {{ resourceStatus.isVisible ? 'Visible' : 'Background' }}
            </span>
          </div>
          <div v-if="resourceStatus.battery" class="flex items-center space-x-2">
            <div :class="[
              'w-2 h-2 rounded-full',
              getBatteryColor()
            ]"></div>
            <span class="text-xs text-gray-300">
              {{ Math.round(resourceStatus.battery.level * 100) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex space-x-2">
        <button
          @click="forceCleanup"
          class="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700 transition-colors"
        >
          Force Cleanup
        </button>
        <button
          @click="exportData"
          class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors"
        >
          Export Data
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { memoryManager } from '@/services/MemoryManager.js';
import { performanceMonitor } from '@/services/PerformanceMonitor.js';
import { browserResourceManager } from '@/utils/BrowserResourceManager.js';

// Component state
const isExpanded = ref(false);
const isLoading = ref(false);
const updateInterval = ref<ReturnType<typeof setInterval> | null>(null);

// Performance data
const memoryStats = ref({
  current: 0,
  peak: 0,
  threshold: 200
});

const searchStats = ref({
  hotAverage: 0,
  coldAverage: 0,
  totalSearches: 0
});

const activeOperations = ref<any[]>([]);
const recentAlerts = ref<any[]>([]);
const resourceStatus = ref({
  isOnline: true,
  wakeLock: false,
  isVisible: true,
  battery: null as any
});

// Computed properties
const memoryPercentage = computed(() => {
  const percentage = (memoryStats.value.current / memoryStats.value.threshold) * 100;
  return Math.min(100, Math.max(0, percentage));
});

// AIDEV-NOTE: Component lifecycle
onMounted(() => {
  setupPerformanceMonitoring();
  startUpdateInterval();
});

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value);
  }
});

// AIDEV-NOTE: Setup performance monitoring listeners
function setupPerformanceMonitoring() {
  // Listen for memory warnings
  memoryManager.onMemoryWarning((data: any) => {
    console.log('Performance indicator received memory warning:', data);
  });

  // Listen for performance alerts
  performanceMonitor.onAlert((alert: any) => {
    recentAlerts.value.unshift(alert);
    // Keep only recent alerts
    if (recentAlerts.value.length > 10) {
      recentAlerts.value = recentAlerts.value.slice(0, 10);
    }
  });

  // Listen for resource changes
  browserResourceManager.onVisibilityChange((isVisible: boolean) => {
    resourceStatus.value.isVisible = isVisible;
  });

  browserResourceManager.onConnectionChange((isOnline: boolean) => {
    resourceStatus.value.isOnline = isOnline;
  });
}

// AIDEV-NOTE: Start periodic data updates
function startUpdateInterval() {
  updateInterval.value = setInterval(() => {
    updatePerformanceData();
  }, 2000); // Update every 2 seconds
  
  // Initial update
  updatePerformanceData();
}

// AIDEV-NOTE: Update performance data
function updatePerformanceData() {
  // Update memory stats
  const memStats = memoryManager.getMemoryStats();
  memoryStats.value = {
    current: memStats.current,
    peak: memStats.peak,
    threshold: memStats.thresholds.warning
  };

  // Update search performance
  const perfSummary = performanceMonitor.getPerformanceSummary(0.5); // Last 30 minutes
  searchStats.value = {
    hotAverage: perfSummary.searchPerformance.avgHotSearchTime,
    coldAverage: perfSummary.searchPerformance.avgColdSearchTime,
    totalSearches: perfSummary.searchPerformance.totalSearches
  };

  // Update active operations
  const resourceInfo = browserResourceManager.getResourceStatus();
  activeOperations.value = resourceInfo.operations ? [] : []; // Placeholder - implement operation tracking
  resourceStatus.value.wakeLock = resourceInfo.wakeLock?.isActive || false;
  resourceStatus.value.battery = resourceInfo.battery;

  // Update recent alerts
  const alerts = performanceMonitor.getRawMetrics('alerts', 5);
  recentAlerts.value = alerts.filter(alert => 
    (Date.now() - alert.timestamp.getTime()) < 300000 // Last 5 minutes
  );
}

// AIDEV-NOTE: UI interaction methods
function togglePanel() {
  isExpanded.value = !isExpanded.value;
}

async function forceCleanup() {
  isLoading.value = true;
  try {
    await memoryManager.forceCleanup();
    console.log('Force cleanup completed');
  } catch (error) {
    console.error('Force cleanup failed:', error);
  } finally {
    isLoading.value = false;
  }
}

function exportData() {
  try {
    const data = performanceMonitor.exportPerformanceData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
  }
}

// AIDEV-NOTE: Status color helpers
function getStatusColor() {
  if (memoryStats.value.current > memoryStats.value.threshold) {
    return 'bg-red-500 hover:bg-red-600';
  } else if (memoryStats.value.current > memoryStats.value.threshold * 0.8) {
    return 'bg-yellow-500 hover:bg-yellow-600';
  } else {
    return 'bg-green-500 hover:bg-green-600';
  }
}

function getMemoryBarColor() {
  if (memoryPercentage.value > 90) {
    return 'bg-red-500';
  } else if (memoryPercentage.value > 70) {
    return 'bg-yellow-500';
  } else {
    return 'bg-green-500';
  }
}

function getAlertColor(severity: any) {
  switch (severity) {
    case 'critical':
      return 'bg-red-900/20 border border-red-800/30 text-red-300';
    case 'warning':
      return 'bg-yellow-900/20 border border-yellow-800/30 text-yellow-300';
    default:
      return 'bg-blue-900/20 border border-blue-800/30 text-blue-300';
  }
}

function getBatteryColor() {
  const level = resourceStatus.value.battery?.level || 1;
  if (level < 0.2) return 'bg-red-400';
  if (level < 0.5) return 'bg-yellow-400';
  return 'bg-green-400';
}

function getStatusText() {
  const current = memoryStats.value.current;
  const threshold = memoryStats.value.threshold;
  
  if (current > threshold) {
    return `High memory usage: ${current}MB (Critical)`;
  } else if (current > threshold * 0.8) {
    return `Memory usage: ${current}MB (Warning)`;
  } else {
    return `Memory usage: ${current}MB (Normal)`;
  }
}
</script>