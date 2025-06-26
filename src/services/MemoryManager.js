/**
 * Memory Management Service for Hot/Cold Storage Architecture
 * 
 * Monitors memory usage, enforces limits, and provides automatic cleanup
 * for cold storage batch processing and document decryption operations.
 */

// AIDEV-NOTE: Memory usage thresholds and configuration
const MEMORY_CONFIG = {
  // Memory thresholds in MB
  WARNING_THRESHOLD: 200,     // Show warning at 200MB
  CRITICAL_THRESHOLD: 300,    // Force cleanup at 300MB
  CLEANUP_TARGET: 150,        // Target memory after cleanup
  
  // Batch processing limits
  MAX_CONCURRENT_BATCHES: 3,  // Maximum batches in memory simultaneously
  MAX_DECRYPTED_SIZE: 50,     // Maximum MB of decrypted data to keep
  
  // Monitoring intervals
  MONITORING_INTERVAL: 5000,  // Check memory every 5 seconds
  CLEANUP_DELAY: 1000,        // Delay between cleanup operations
  
  // Performance monitoring
  GC_FORCE_THRESHOLD: 250,    // Force garbage collection at 250MB
  PERFORMANCE_SAMPLE_SIZE: 10 // Number of samples for averaging
};

class MemoryManager {
  constructor() {
    this.isInitialized = false;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    // Memory tracking
    this.memoryStats = {
      current: 0,
      peak: 0,
      lastMeasured: new Date(),
      measurements: []
    };
    
    // Tracked resources
    this.trackedResources = new Map();
    this.decryptedBatches = new Map();
    this.activeOperations = new Set();
    
    // Event listeners for cleanup
    this.cleanupListeners = new Set();
    this.warningListeners = new Set();
    
    // Performance tracking
    this.performanceMetrics = {
      cleanupOperations: 0,
      forcedCleanups: 0,
      gcForced: 0,
      avgCleanupTime: 0
    };
    
    // Auto-initialize
    this.initialize();
  }

  // AIDEV-NOTE: Initialize memory manager with browser compatibility checks
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Check for memory API availability
      this.hasMemoryAPI = this.checkMemoryAPIAvailability();
      
      // Setup performance observer if available
      this.setupPerformanceObserver();
      
      // Register global error handlers
      this.setupErrorHandlers();
      
      // Start monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      console.log('MemoryManager initialized successfully', {
        hasMemoryAPI: this.hasMemoryAPI,
        config: MEMORY_CONFIG
      });
      
    } catch (error) {
      console.error('MemoryManager initialization failed:', error);
      throw error;
    }
  }

  // AIDEV-NOTE: Check browser memory API availability
  checkMemoryAPIAvailability() {
    try {
      return !!(
        performance.memory ||
        navigator.deviceMemory ||
        performance.measureUserAgentSpecificMemory
      );
    } catch (error) {
      console.warn('Memory API not available:', error);
      return false;
    }
  }

  // AIDEV-NOTE: Setup performance observer for memory measurements
  setupPerformanceObserver() {
    try {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              this.recordPerformanceMetric(entry);
            }
          }
        });
        
        observer.observe({ entryTypes: ['measure'] });
      }
    } catch (error) {
      console.warn('PerformanceObserver setup failed:', error);
    }
  }

  // AIDEV-NOTE: Setup global error handlers for memory-related issues
  setupErrorHandlers() {
    // Listen for memory pressure events
    if ('onmemory pressure' in window) {
      window.addEventListener('memorypressure', () => {
        console.warn('Memory pressure detected, forcing cleanup');
        this.forceCleanup();
      });
    }
    
    // Listen for quota exceeded errors
    window.addEventListener('error', (event) => {
      if (event.error && event.error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, cleaning up memory');
        this.forceCleanup();
      }
    });
  }

  // AIDEV-NOTE: Start continuous memory monitoring
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, MEMORY_CONFIG.MONITORING_INTERVAL);
    
    console.log('Memory monitoring started');
  }

  // AIDEV-NOTE: Stop memory monitoring
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Memory monitoring stopped');
  }

  // AIDEV-NOTE: Get current memory usage in MB
  getCurrentMemoryUsage() {
    try {
      if (performance.memory) {
        // Chrome/Edge - most accurate
        const used = performance.memory.usedJSHeapSize;
        return Math.round(used / (1024 * 1024));
      } else if (navigator.deviceMemory) {
        // Fallback - estimate based on device memory
        const estimatedUsage = this.estimateMemoryUsage();
        return estimatedUsage;
      } else {
        // Final fallback - track manually
        return this.getManualMemoryEstimate();
      }
    } catch (error) {
      console.warn('Memory measurement failed:', error);
      return 0;
    }
  }

  // AIDEV-NOTE: Estimate memory usage when exact measurement unavailable
  estimateMemoryUsage() {
    let estimate = 0;
    
    // Base application memory
    estimate += 50; // Base Vue app + libraries
    
    // Count tracked resources
    for (const [id, resource] of this.trackedResources) {
      estimate += resource.estimatedSize || 0;
    }
    
    // Count decrypted batches
    for (const [batchId, batch] of this.decryptedBatches) {
      estimate += batch.size || 0;
    }
    
    return Math.round(estimate);
  }

  // AIDEV-NOTE: Manual memory estimation based on tracked objects
  getManualMemoryEstimate() {
    const memorySnapshot = {
      trackedResources: this.trackedResources.size * 0.1, // 100KB per resource estimate
      decryptedBatches: Array.from(this.decryptedBatches.values())
        .reduce((total, batch) => total + (batch.size || 0), 0),
      baseMemory: 50 // Base memory estimate in MB
    };
    
    return Math.round(
      memorySnapshot.baseMemory + 
      memorySnapshot.trackedResources + 
      memorySnapshot.decryptedBatches
    );
  }

  // AIDEV-NOTE: Check memory usage and trigger cleanup if needed
  async checkMemoryUsage() {
    const currentMemory = this.getCurrentMemoryUsage();
    const timestamp = new Date();
    
    // Update memory stats
    this.memoryStats.current = currentMemory;
    this.memoryStats.lastMeasured = timestamp;
    this.memoryStats.measurements.push({
      value: currentMemory,
      timestamp
    });
    
    // Keep only recent measurements
    if (this.memoryStats.measurements.length > 100) {
      this.memoryStats.measurements = this.memoryStats.measurements.slice(-50);
    }
    
    // Update peak usage
    if (currentMemory > this.memoryStats.peak) {
      this.memoryStats.peak = currentMemory;
    }
    
    // Check thresholds and trigger actions
    if (currentMemory >= MEMORY_CONFIG.CRITICAL_THRESHOLD) {
      console.warn(`Critical memory usage: ${currentMemory}MB`);
      await this.forceCleanup();
    } else if (currentMemory >= MEMORY_CONFIG.WARNING_THRESHOLD) {
      console.warn(`High memory usage: ${currentMemory}MB`);
      this.notifyWarningListeners(currentMemory);
      await this.performLightCleanup();
    }
    
    // Force garbage collection if needed
    if (currentMemory >= MEMORY_CONFIG.GC_FORCE_THRESHOLD && window.gc) {
      this.forceGarbageCollection();
    }
  }

  // AIDEV-NOTE: Track a resource for memory management
  trackResource(id, resource, estimatedSizeMB = 1) {
    this.trackedResources.set(id, {
      data: resource,
      estimatedSize: estimatedSizeMB,
      createdAt: new Date(),
      lastAccessed: new Date()
    });
    
    console.log(`Tracking resource: ${id} (${estimatedSizeMB}MB)`);
  }

  // AIDEV-NOTE: Track decrypted batch data
  trackDecryptedBatch(batchId, data, sizeMB) {
    // Enforce maximum concurrent batches
    if (this.decryptedBatches.size >= MEMORY_CONFIG.MAX_CONCURRENT_BATCHES) {
      this.cleanupOldestBatch();
    }
    
    this.decryptedBatches.set(batchId, {
      data,
      size: sizeMB,
      createdAt: new Date(),
      lastAccessed: new Date()
    });
    
    console.log(`Tracking decrypted batch: ${batchId} (${sizeMB}MB)`);
  }

  // AIDEV-NOTE: Access tracked resource and update last accessed time
  accessResource(id) {
    const resource = this.trackedResources.get(id);
    if (resource) {
      resource.lastAccessed = new Date();
      return resource.data;
    }
    return null;
  }

  // AIDEV-NOTE: Access decrypted batch and update last accessed time
  accessDecryptedBatch(batchId) {
    const batch = this.decryptedBatches.get(batchId);
    if (batch) {
      batch.lastAccessed = new Date();
      return batch.data;
    }
    return null;
  }

  // AIDEV-NOTE: Untrack and cleanup specific resource
  untrackResource(id) {
    const resource = this.trackedResources.get(id);
    if (resource) {
      // Clear the data reference
      if (resource.data && typeof resource.data === 'object') {
        this.secureWipeObject(resource.data);
      }
      
      this.trackedResources.delete(id);
      console.log(`Untracked resource: ${id}`);
      return true;
    }
    return false;
  }

  // AIDEV-NOTE: Untrack and cleanup decrypted batch
  untrackDecryptedBatch(batchId) {
    const batch = this.decryptedBatches.get(batchId);
    if (batch) {
      // Secure wipe of decrypted data
      this.secureWipeObject(batch.data);
      
      this.decryptedBatches.delete(batchId);
      console.log(`Untracked decrypted batch: ${batchId}`);
      return true;
    }
    return false;
  }

  // AIDEV-NOTE: Secure wipe of sensitive data
  secureWipeObject(obj) {
    try {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          // Clear array
          obj.length = 0;
        } else if (obj instanceof ArrayBuffer) {
          // Clear ArrayBuffer
          new Uint8Array(obj).fill(0);
        } else if (obj instanceof Uint8Array) {
          // Clear typed array
          obj.fill(0);
        } else {
          // Clear object properties
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              delete obj[key];
            }
          }
        }
      }
    } catch (error) {
      console.warn('Secure wipe failed:', error);
    }
  }

  // AIDEV-NOTE: Light cleanup - remove least recently used resources
  async performLightCleanup() {
    const startTime = performance.now();
    let cleanedMemory = 0;
    
    // Sort resources by last accessed time (oldest first)
    const resources = Array.from(this.trackedResources.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 25% of resources
    const toRemove = Math.max(1, Math.floor(resources.length * 0.25));
    
    for (let i = 0; i < toRemove && i < resources.length; i++) {
      const [id, resource] = resources[i];
      cleanedMemory += resource.estimatedSize || 0;
      this.untrackResource(id);
    }
    
    // Also cleanup oldest decrypted batch if over limit
    if (this.decryptedBatches.size > 1) {
      this.cleanupOldestBatch();
    }
    
    const duration = performance.now() - startTime;
    this.performanceMetrics.cleanupOperations++;
    this.updateAverageCleanupTime(duration);
    
    console.log(`Light cleanup completed: ${cleanedMemory}MB freed in ${duration.toFixed(2)}ms`);
  }

  // AIDEV-NOTE: Force cleanup - aggressive memory reclamation
  async forceCleanup() {
    const startTime = performance.now();
    let cleanedMemory = 0;
    
    // Clear all non-essential tracked resources
    for (const [id, resource] of this.trackedResources) {
      cleanedMemory += resource.estimatedSize || 0;
      this.untrackResource(id);
    }
    
    // Clear all but the most recent decrypted batch
    const batches = Array.from(this.decryptedBatches.entries())
      .sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);
    
    // Keep only the most recently accessed batch
    for (let i = 1; i < batches.length; i++) {
      const [batchId, batch] = batches[i];
      cleanedMemory += batch.size || 0;
      this.untrackDecryptedBatch(batchId);
    }
    
    // Force garbage collection if available
    this.forceGarbageCollection();
    
    // Notify cleanup listeners
    this.notifyCleanupListeners(cleanedMemory);
    
    const duration = performance.now() - startTime;
    this.performanceMetrics.forcedCleanups++;
    this.updateAverageCleanupTime(duration);
    
    console.log(`Force cleanup completed: ${cleanedMemory}MB freed in ${duration.toFixed(2)}ms`);
    
    // Wait a moment then check if we reached target
    setTimeout(() => {
      const currentMemory = this.getCurrentMemoryUsage();
      if (currentMemory > MEMORY_CONFIG.CLEANUP_TARGET) {
        console.warn(`Cleanup target not reached: ${currentMemory}MB (target: ${MEMORY_CONFIG.CLEANUP_TARGET}MB)`);
      }
    }, MEMORY_CONFIG.CLEANUP_DELAY);
  }

  // AIDEV-NOTE: Clean up oldest decrypted batch
  cleanupOldestBatch() {
    const batches = Array.from(this.decryptedBatches.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    if (batches.length > 0) {
      const [oldestBatchId] = batches[0];
      this.untrackDecryptedBatch(oldestBatchId);
    }
  }

  // AIDEV-NOTE: Force garbage collection if available
  forceGarbageCollection() {
    try {
      if (window.gc) {
        window.gc();
        this.performanceMetrics.gcForced++;
        console.log('Forced garbage collection');
      }
    } catch (error) {
      console.warn('Failed to force garbage collection:', error);
    }
  }

  // AIDEV-NOTE: Update average cleanup time metric
  updateAverageCleanupTime(duration) {
    const currentAvg = this.performanceMetrics.avgCleanupTime;
    const count = this.performanceMetrics.cleanupOperations;
    
    this.performanceMetrics.avgCleanupTime = 
      (currentAvg * (count - 1) + duration) / count;
  }

  // AIDEV-NOTE: Register listener for cleanup events
  onCleanup(listener) {
    this.cleanupListeners.add(listener);
    return () => this.cleanupListeners.delete(listener);
  }

  // AIDEV-NOTE: Register listener for memory warnings
  onMemoryWarning(listener) {
    this.warningListeners.add(listener);
    return () => this.warningListeners.delete(listener);
  }

  // AIDEV-NOTE: Notify cleanup event listeners
  notifyCleanupListeners(memoryFreed) {
    for (const listener of this.cleanupListeners) {
      try {
        listener({
          type: 'cleanup',
          memoryFreed,
          timestamp: new Date(),
          currentMemory: this.memoryStats.current
        });
      } catch (error) {
        console.error('Cleanup listener error:', error);
      }
    }
  }

  // AIDEV-NOTE: Notify memory warning listeners
  notifyWarningListeners(currentMemory) {
    for (const listener of this.warningListeners) {
      try {
        listener({
          type: 'warning',
          currentMemory,
          threshold: MEMORY_CONFIG.WARNING_THRESHOLD,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Warning listener error:', error);
      }
    }
  }

  // AIDEV-NOTE: Get comprehensive memory statistics
  getMemoryStats() {
    return {
      current: this.memoryStats.current,
      peak: this.memoryStats.peak,
      lastMeasured: this.memoryStats.lastMeasured,
      
      thresholds: {
        warning: MEMORY_CONFIG.WARNING_THRESHOLD,
        critical: MEMORY_CONFIG.CRITICAL_THRESHOLD,
        target: MEMORY_CONFIG.CLEANUP_TARGET
      },
      
      resources: {
        tracked: this.trackedResources.size,
        decryptedBatches: this.decryptedBatches.size,
        activeOperations: this.activeOperations.size
      },
      
      performance: {
        ...this.performanceMetrics,
        isMonitoring: this.isMonitoring,
        hasMemoryAPI: this.hasMemoryAPI
      }
    };
  }

  // AIDEV-NOTE: Get memory usage trend over time
  getMemoryTrend(minutes = 5) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    
    return this.memoryStats.measurements
      .filter(m => m.timestamp >= cutoff)
      .map(m => ({
        value: m.value,
        timestamp: m.timestamp
      }));
  }

  // AIDEV-NOTE: Cleanup and shutdown memory manager
  destroy() {
    this.stopMonitoring();
    
    // Clear all tracked resources
    this.forceCleanup();
    
    // Clear listeners
    this.cleanupListeners.clear();
    this.warningListeners.clear();
    
    this.isInitialized = false;
    console.log('MemoryManager destroyed');
  }
}

// AIDEV-NOTE: Create singleton instance
export const memoryManager = new MemoryManager();

// AIDEV-NOTE: Export class for testing
export { MemoryManager, MEMORY_CONFIG };