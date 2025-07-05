/**
 * Memory Management Service for Hot/Cold Storage Architecture
 * 
 * Monitors memory usage, enforces limits, and provides automatic cleanup
 * for cold storage batch processing and document decryption operations.
 */

// AIDEV-NOTE: Memory usage thresholds and configuration with proper typing
export interface MemoryConfig {
  // Memory thresholds in MB
  WARNING_THRESHOLD: number;     // Show warning at 200MB
  CRITICAL_THRESHOLD: number;    // Force cleanup at 300MB
  CLEANUP_TARGET: number;        // Target memory after cleanup
  
  // Batch processing limits
  MAX_CONCURRENT_BATCHES: number;  // Maximum batches in memory simultaneously
  MAX_DECRYPTED_SIZE: number;     // Maximum MB of decrypted data to keep
  
  // Monitoring intervals
  MONITORING_INTERVAL: number;  // Check memory every 5 seconds
  CLEANUP_DELAY: number;        // Delay between cleanup operations
  
  // Performance monitoring
  GC_FORCE_THRESHOLD: number;    // Force garbage collection at 250MB
  PERFORMANCE_SAMPLE_SIZE: number; // Number of samples for averaging
}

export const MEMORY_CONFIG: MemoryConfig = {
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

export interface MemoryMeasurement {
  value: number;
  timestamp: Date;
}

export interface MemoryStats {
  current: number;
  peak: number;
  lastMeasured: Date;
  measurements: MemoryMeasurement[];
}

export interface TrackedResource {
  data: any;
  estimatedSize: number;
  createdAt: Date;
  lastAccessed: Date;
}

export interface DecryptedBatch {
  data: any;
  size: number;
  createdAt: Date;
  lastAccessed: Date;
}

export interface PerformanceMetrics {
  cleanupOperations: number;
  forcedCleanups: number;
  gcForced: number;
  avgCleanupTime: number;
}

export interface CleanupEvent {
  type: 'cleanup';
  memoryFreed: number;
  timestamp: Date;
  currentMemory: number;
}

export interface WarningEvent {
  type: 'warning';
  currentMemory: number;
  threshold: number;
  timestamp: Date;
}

export type MemoryEventListener<T = CleanupEvent | WarningEvent> = (event: T) => void;

export interface MemoryStatsSummary {
  current: number;
  peak: number;
  lastMeasured: Date;
  
  thresholds: {
    warning: number;
    critical: number;
    target: number;
  };
  
  resources: {
    tracked: number;
    decryptedBatches: number;
    activeOperations: number;
  };
  
  performance: PerformanceMetrics & {
    isMonitoring: boolean;
    hasMemoryAPI: boolean;
  };
}

export interface MemoryTrendPoint {
  value: number;
  timestamp: Date;
}

// AIDEV-NOTE: Extend Window interface for memory API types
declare global {
  interface Window {
    gc?: () => void;
  }
  
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    measureUserAgentSpecificMemory?: () => Promise<any>;
  }
  
  interface Navigator {
    deviceMemory?: number;
  }
}

export class MemoryManager {
  private isInitialized = false;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private hasMemoryAPI = false;
  
  // Memory tracking with proper typing
  private memoryStats: MemoryStats = {
    current: 0,
    peak: 0,
    lastMeasured: new Date(),
    measurements: []
  };
  
  // Tracked resources with proper typing
  private trackedResources = new Map<string, TrackedResource>();
  private decryptedBatches = new Map<string, DecryptedBatch>();
  private activeOperations = new Set<string>();
  
  // Event listeners for cleanup with proper typing
  private cleanupListeners = new Set<MemoryEventListener<CleanupEvent>>();
  private warningListeners = new Set<MemoryEventListener<WarningEvent>>();
  
  // Performance tracking with proper typing
  private performanceMetrics: PerformanceMetrics = {
    cleanupOperations: 0,
    forcedCleanups: 0,
    gcForced: 0,
    avgCleanupTime: 0
  };
  
  constructor() {
    // Auto-initialize
    this.initialize();
  }

  // AIDEV-NOTE: Initialize memory manager with browser compatibility checks
  public async initialize(): Promise<void> {
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
  private checkMemoryAPIAvailability(): boolean {
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
  private setupPerformanceObserver(): void {
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

  // AIDEV-NOTE: Record performance metrics from PerformanceEntry
  private recordPerformanceMetric(entry: PerformanceEntry): void {
    // Handle performance entries related to memory operations
    if (entry.name.includes('memory') || entry.name.includes('cleanup')) {
      console.log('Memory performance metric:', {
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime
      });
    }
  }

  // AIDEV-NOTE: Setup global error handlers for memory-related issues
  private setupErrorHandlers(): void {
    // Listen for memory pressure events (non-standard, browser-specific)
    if ('onmemorypressure' in window) {
      window.addEventListener('memorypressure', () => {
        console.warn('Memory pressure detected, forcing cleanup');
        this.forceCleanup();
      });
    }
    
    // Listen for quota exceeded errors
    window.addEventListener('error', (event: ErrorEvent) => {
      if (event.error && event.error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, cleaning up memory');
        this.forceCleanup();
      }
    });
  }

  // AIDEV-NOTE: Start continuous memory monitoring
  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, MEMORY_CONFIG.MONITORING_INTERVAL);
    
    console.log('Memory monitoring started');
  }

  // AIDEV-NOTE: Stop memory monitoring
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Memory monitoring stopped');
  }

  // AIDEV-NOTE: Get current memory usage in MB
  public getCurrentMemoryUsage(): number {
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
  private estimateMemoryUsage(): number {
    let estimate = 0;
    
    // Base application memory
    estimate += 50; // Base Vue app + libraries
    
    // Count tracked resources
    for (const [_, resource] of this.trackedResources) {
      estimate += resource.estimatedSize || 0;
    }
    
    // Count decrypted batches
    for (const [_, batch] of this.decryptedBatches) {
      estimate += batch.size || 0;
    }
    
    return Math.round(estimate);
  }

  // AIDEV-NOTE: Manual memory estimation based on tracked objects
  private getManualMemoryEstimate(): number {
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
  private async checkMemoryUsage(): Promise<void> {
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
  public trackResource(id: string, resource: any, estimatedSizeMB = 1): void {
    this.trackedResources.set(id, {
      data: resource,
      estimatedSize: estimatedSizeMB,
      createdAt: new Date(),
      lastAccessed: new Date()
    });
    
    console.log(`Tracking resource: ${id} (${estimatedSizeMB}MB)`);
  }

  // AIDEV-NOTE: Track decrypted batch data
  public trackDecryptedBatch(batchId: string, data: any, sizeMB: number): void {
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
  public accessResource(id: string): any {
    const resource = this.trackedResources.get(id);
    if (resource) {
      resource.lastAccessed = new Date();
      return resource.data;
    }
    return null;
  }

  // AIDEV-NOTE: Access decrypted batch and update last accessed time
  public accessDecryptedBatch(batchId: string): any {
    const batch = this.decryptedBatches.get(batchId);
    if (batch) {
      batch.lastAccessed = new Date();
      return batch.data;
    }
    return null;
  }

  // AIDEV-NOTE: Untrack and cleanup specific resource
  public untrackResource(resourceId: string): boolean {
    const resource = this.trackedResources.get(resourceId);
    if (resource) {
      // Clear the data reference
      if (resource.data && typeof resource.data === 'object') {
        this.secureWipeObject(resource.data);
      }
      
      this.trackedResources.delete(resourceId);
      console.log(`Untracked resource: ${resourceId}`);
      return true;
    }
    return false;
  }

  // AIDEV-NOTE: Untrack and cleanup decrypted batch
  public untrackDecryptedBatch(batchId: string): boolean {
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
  private secureWipeObject(obj: any): void {
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
  public async performLightCleanup(): Promise<void> {
    const startTime = performance.now();
    let cleanedMemory = 0;
    
    // Sort resources by last accessed time (oldest first)
    const resources = Array.from(this.trackedResources.entries())
      .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
    
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
  public async forceCleanup(): Promise<void> {
    const startTime = performance.now();
    let cleanedMemory = 0;
    
    // Clear all non-essential tracked resources
    for (const [id, resource] of this.trackedResources) {
      cleanedMemory += resource.estimatedSize || 0;
      this.untrackResource(id);
    }
    
    // Clear all but the most recent decrypted batch
    const batches = Array.from(this.decryptedBatches.entries())
      .sort((a, b) => b[1].lastAccessed.getTime() - a[1].lastAccessed.getTime());
    
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
  private cleanupOldestBatch(): void {
    const batches = Array.from(this.decryptedBatches.entries())
      .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
    
    if (batches.length > 0) {
      const [oldestBatchId] = batches[0];
      this.untrackDecryptedBatch(oldestBatchId);
    }
  }

  // AIDEV-NOTE: Force garbage collection if available
  private forceGarbageCollection(): void {
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
  private updateAverageCleanupTime(duration: number): void {
    const currentAvg = this.performanceMetrics.avgCleanupTime;
    const count = this.performanceMetrics.cleanupOperations;
    
    this.performanceMetrics.avgCleanupTime = 
      (currentAvg * (count - 1) + duration) / count;
  }

  // AIDEV-NOTE: Register listener for cleanup events
  public onCleanup(listener: MemoryEventListener<CleanupEvent>): () => void {
    this.cleanupListeners.add(listener);
    return () => this.cleanupListeners.delete(listener);
  }

  // AIDEV-NOTE: Register listener for memory warnings
  public onMemoryWarning(listener: MemoryEventListener<WarningEvent>): () => void {
    this.warningListeners.add(listener);
    return () => this.warningListeners.delete(listener);
  }

  // AIDEV-NOTE: Notify cleanup event listeners
  private notifyCleanupListeners(memoryFreed: number): void {
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
  private notifyWarningListeners(currentMemory: number): void {
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
  public getMemoryStats(): MemoryStatsSummary {
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
  public getMemoryTrend(minutes = 5): MemoryTrendPoint[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    
    return this.memoryStats.measurements
      .filter(m => m.timestamp >= cutoff)
      .map(m => ({
        value: m.value,
        timestamp: m.timestamp
      }));
  }

  // AIDEV-NOTE: Cleanup and shutdown memory manager
  public destroy(): void {
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