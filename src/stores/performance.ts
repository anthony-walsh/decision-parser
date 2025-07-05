/**
 * Performance Store Module
 * 
 * Manages performance monitoring and resource management state
 * AIDEV-NOTE: Extracted from stores/index.ts for better modularity
 */

import { reactive } from 'vue';
import { memoryManager } from '@/services/MemoryManager';
import { performanceMonitor } from '@/services/PerformanceMonitor';
import { browserResourceManager } from '@/utils/BrowserResourceManager';

// AIDEV-NOTE: Performance state interfaces
export interface PerformanceAlert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  read: boolean;
}

export interface PerformanceOperation {
  id: string;
  type: string;
  description: string;
  startTime: Date;
  progress?: number;
}

export interface PerformanceState {
  memory: {
    current: number;
    peak: number;
    warning: boolean;
    critical: boolean;
    lastCleanup: Date | null;
  };
  alerts: PerformanceAlert[];
  resources: {
    isOnline: boolean;
    isVisible: boolean;
    hasFocus: boolean;
    wakeLockActive: boolean;
    batteryLevel: number | null;
    batteryCharging: boolean | null;
  };
  operations: {
    active: PerformanceOperation[];
    completed: number;
    failed: number;
  };
}

// AIDEV-NOTE: Reactive performance state
export const performanceState = reactive<PerformanceState>({
  memory: {
    current: 0,
    peak: 0,
    warning: false,
    critical: false,
    lastCleanup: null
  },
  alerts: [],
  resources: {
    isOnline: true,
    isVisible: true,
    hasFocus: true,
    wakeLockActive: false,
    batteryLevel: null,
    batteryCharging: null
  },
  operations: {
    active: [],
    completed: 0,
    failed: 0
  }
});

// AIDEV-NOTE: Performance actions
export const usePerformanceStore = () => {
  
  const performanceActions = {
    // Add performance alert
    addAlert(type: string, message: string, severity: 'info' | 'warning' | 'critical' = 'info') {
      const alert: PerformanceAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        type,
        message,
        severity,
        timestamp: new Date(),
        read: false
      };
      
      performanceState.alerts.unshift(alert);
      
      // Limit alerts to last 50
      if (performanceState.alerts.length > 50) {
        performanceState.alerts = performanceState.alerts.slice(0, 50);
      }
      
      console.log(`[PerformanceStore] Alert added: ${type} - ${message}`);
    },

    // Mark alert as read
    markAlertRead(alertId: string) {
      const alert = performanceState.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.read = true;
      }
    },

    // Clear all alerts
    clearAlerts() {
      performanceState.alerts = [];
    },

    // Remove old alerts (older than 24 hours)
    cleanupOldAlerts() {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const originalLength = performanceState.alerts.length;
      
      performanceState.alerts = performanceState.alerts.filter(
        alert => alert.timestamp >= cutoff
      );
      
      const removed = originalLength - performanceState.alerts.length;
      if (removed > 0) {
        console.log(`[PerformanceStore] Cleaned up ${removed} old alerts`);
      }
    },

    // Update memory statistics
    updateMemoryStats() {
      const stats = memoryManager.getMemoryStats();
      
      performanceState.memory.current = stats.current;
      performanceState.memory.peak = Math.max(performanceState.memory.peak, stats.current);
      performanceState.memory.warning = stats.current >= stats.thresholds.warning;
      performanceState.memory.critical = stats.current >= stats.thresholds.critical;
    },

    // Update resource status
    updateResourceStatus() {
      // Update browser resource status
      performanceState.resources.isOnline = navigator.onLine;
      performanceState.resources.isVisible = !document.hidden;
      performanceState.resources.hasFocus = document.hasFocus();
      
      // Update battery status if available
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          performanceState.resources.batteryLevel = Math.round(battery.level * 100);
          performanceState.resources.batteryCharging = battery.charging;
        }).catch(() => {
          // Battery API not supported or available
        });
      }
    },

    // Add active operation
    addOperation(type: string, description: string): string {
      const operation: PerformanceOperation = {
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        type,
        description,
        startTime: new Date(),
        progress: 0
      };
      
      performanceState.operations.active.push(operation);
      return operation.id;
    },

    // Update operation progress
    updateOperationProgress(operationId: string, progress: number) {
      const operation = performanceState.operations.active.find(op => op.id === operationId);
      if (operation) {
        operation.progress = Math.max(0, Math.min(100, progress));
      }
    },

    // Complete operation
    completeOperation(operationId: string, success = true) {
      const index = performanceState.operations.active.findIndex(op => op.id === operationId);
      if (index >= 0) {
        performanceState.operations.active.splice(index, 1);
        
        if (success) {
          performanceState.operations.completed++;
        } else {
          performanceState.operations.failed++;
        }
      }
    },

    // Force memory cleanup
    async forceMemoryCleanup() {
      try {
        await memoryManager.forceCleanup();
        performanceState.memory.lastCleanup = new Date();
        this.addAlert('memory_cleanup', 'Memory cleanup completed successfully', 'info');
      } catch (error) {
        console.error('[PerformanceStore] Memory cleanup failed:', error);
        this.addAlert('memory_cleanup', 'Memory cleanup failed', 'warning');
      }
    },

    // Record cleanup operation
    recordCleanup() {
      performanceState.memory.lastCleanup = new Date();
    },

    // Initialize performance monitoring
    async initializePerformanceMonitoring() {
      try {
        // Setup memory warning listener
        memoryManager.onMemoryWarning((data: any) => {
          this.addAlert('memory_warning', `Memory usage: ${data.currentMemory}MB`, 'warning');
          this.updateMemoryStats();
        });

        // Setup cleanup listener
        memoryManager.onCleanup((data: any) => {
          this.addAlert('memory_cleanup', `Freed ${data.memoryFreed}MB of memory`, 'info');
          this.recordCleanup();
          this.updateMemoryStats();
        });

        // Setup performance alert listener
        performanceMonitor.onAlert((alert: any) => {
          this.addAlert(alert.type, alert.message, alert.severity);
        });

        // Setup resource change listeners
        browserResourceManager.onVisibilityChange((isVisible: boolean) => {
          performanceState.resources.isVisible = isVisible;
          if (!isVisible) {
            this.addAlert('visibility_change', 'Application moved to background', 'info');
          }
        });

        browserResourceManager.onConnectionChange((isOnline: boolean) => {
          performanceState.resources.isOnline = isOnline;
          this.addAlert('connection_change', 
                       isOnline ? 'Connection restored' : 'Connection lost', 
                       isOnline ? 'info' : 'warning');
        });

        // Start periodic updates
        setInterval(() => {
          this.updateMemoryStats();
          this.updateResourceStatus();
          this.cleanupOldAlerts();
        }, 5000); // Update every 5 seconds

        console.log('[PerformanceStore] Performance monitoring initialized');
        
      } catch (error) {
        console.error('[PerformanceStore] Failed to initialize performance monitoring:', error);
        this.addAlert('initialization', 'Performance monitoring initialization failed', 'warning');
      }
    },

    // Get performance summary
    getPerformanceSummary() {
      return {
        memory: {
          current: performanceState.memory.current,
          peak: performanceState.memory.peak,
          status: performanceState.memory.critical ? 'critical' : 
                 performanceState.memory.warning ? 'warning' : 'normal'
        },
        operations: {
          active: performanceState.operations.active.length,
          completed: performanceState.operations.completed,
          failed: performanceState.operations.failed,
          successRate: performanceState.operations.completed / 
                      (performanceState.operations.completed + performanceState.operations.failed) || 0
        },
        alerts: {
          total: performanceState.alerts.length,
          unread: performanceState.alerts.filter(a => !a.read).length,
          critical: performanceState.alerts.filter(a => a.severity === 'critical').length
        },
        resources: {
          isOnline: performanceState.resources.isOnline,
          isVisible: performanceState.resources.isVisible,
          batteryLevel: performanceState.resources.batteryLevel
        },
        timestamp: new Date()
      };
    },

    // Export performance data for analysis
    exportPerformanceData() {
      return {
        state: {
          memory: { ...performanceState.memory },
          alerts: performanceState.alerts.slice(0, 20), // Recent alerts only
          resources: { ...performanceState.resources },
          operations: {
            active: [...performanceState.operations.active],
            completed: performanceState.operations.completed,
            failed: performanceState.operations.failed
          }
        },
        summary: this.getPerformanceSummary(),
        timestamp: new Date().toISOString()
      };
    }
  };

  return {
    // State
    state: performanceState,
    
    // Actions
    ...performanceActions
  };
};