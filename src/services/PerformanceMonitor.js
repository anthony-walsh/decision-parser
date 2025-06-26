/**
 * Performance Monitor Service for Hot/Cold Storage Architecture
 * 
 * Tracks application performance metrics, monitors operation timings,
 * and provides insights for optimization and user experience.
 */

// AIDEV-NOTE: Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  // Metric collection settings
  MAX_SAMPLES: 1000,           // Maximum samples to keep in memory
  SAMPLING_INTERVAL: 1000,     // Background sampling interval (ms)
  BATCH_SIZE: 10,              // Samples to process in batch
  
  // Performance thresholds
  SLOW_SEARCH_THRESHOLD: 2000, // Hot search slower than 2s is concerning
  SLOW_COLD_THRESHOLD: 10000,  // Cold search slower than 10s is concerning
  HIGH_MEMORY_THRESHOLD: 200,  // Memory usage above 200MB
  LOW_FPS_THRESHOLD: 30,       // FPS below 30 is poor
  
  // Alert configuration
  CONSECUTIVE_SLOW_ALERTS: 3,  // Alert after 3 consecutive slow operations
  ALERT_COOLDOWN: 30000,       // 30s cooldown between similar alerts
  
  // Metric retention
  METRIC_RETENTION_HOURS: 24,  // Keep metrics for 24 hours
  CLEANUP_INTERVAL: 300000     // Cleanup old metrics every 5 minutes
};

class PerformanceMonitor {
  constructor() {
    this.isInitialized = false;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.cleanupInterval = null;
    
    // Performance metrics storage
    this.metrics = {
      searchOperations: [],
      memoryUsage: [],
      renderingPerformance: [],
      networkOperations: [],
      storageOperations: [],
      userInteractions: []
    };
    
    // Real-time performance tracking
    this.currentSession = {
      startTime: new Date(),
      searchCount: 0,
      hotSearchTime: 0,
      coldSearchTime: 0,
      memoryPeaks: [],
      errors: []
    };
    
    // Performance alerts and warnings
    this.alerts = {
      history: [],
      lastAlerts: new Map(), // Type -> timestamp mapping for cooldown
      consecutiveSlowOps: 0
    };
    
    // Event listeners
    this.performanceListeners = new Set();
    this.alertListeners = new Set();
    
    // Performance observers
    this.observers = {
      navigation: null,
      paint: null,
      resource: null,
      longtask: null
    };
    
    // Auto-initialize
    this.initialize();
  }

  // AIDEV-NOTE: Initialize performance monitoring
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Setup performance observers
      this.setupPerformanceObservers();
      
      // Setup user interaction tracking
      this.setupUserInteractionTracking();
      
      // Setup memory monitoring integration
      this.setupMemoryMonitoring();
      
      // Start monitoring
      this.startMonitoring();
      
      // Start cleanup interval
      this.startCleanupInterval();
      
      this.isInitialized = true;
      console.log('PerformanceMonitor initialized successfully');
      
    } catch (error) {
      console.error('PerformanceMonitor initialization failed:', error);
      throw error;
    }
  }

  // AIDEV-NOTE: Setup browser performance observers
  setupPerformanceObservers() {
    try {
      // Navigation timing observer
      if ('PerformanceObserver' in window) {
        this.observers.navigation = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordNavigationMetric(entry);
          }
        });
        this.observers.navigation.observe({ entryTypes: ['navigation'] });
        
        // Paint timing observer  
        this.observers.paint = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPaintMetric(entry);
          }
        });
        this.observers.paint.observe({ entryTypes: ['paint'] });
        
        // Resource timing observer
        this.observers.resource = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordResourceMetric(entry);
          }
        });
        this.observers.resource.observe({ entryTypes: ['resource'] });
        
        // Long task observer (if available)
        try {
          this.observers.longtask = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.recordLongTaskMetric(entry);
            }
          });
          this.observers.longtask.observe({ entryTypes: ['longtask'] });
        } catch (error) {
          console.log('Long task observer not available');
        }
      }
    } catch (error) {
      console.warn('Performance observer setup failed:', error);
    }
  }

  // AIDEV-NOTE: Setup user interaction performance tracking
  setupUserInteractionTracking() {
    const interactionEvents = ['click', 'keydown', 'scroll', 'touchstart'];
    
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        this.recordUserInteraction(eventType, event);
      }, { passive: true });
    });
  }

  // AIDEV-NOTE: Setup memory monitoring integration
  setupMemoryMonitoring() {
    // This will be integrated with MemoryManager
    if (window.memoryManager) {
      window.memoryManager.onMemoryWarning((data) => {
        this.recordMemoryAlert(data);
      });
    }
  }

  // AIDEV-NOTE: Start performance monitoring
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectPerformanceSnapshot();
    }, PERFORMANCE_CONFIG.SAMPLING_INTERVAL);
    
    console.log('Performance monitoring started');
  }

  // AIDEV-NOTE: Stop performance monitoring
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Performance monitoring stopped');
  }

  // AIDEV-NOTE: Start cleanup interval for old metrics
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, PERFORMANCE_CONFIG.CLEANUP_INTERVAL);
  }

  // AIDEV-NOTE: Collect performance snapshot
  collectPerformanceSnapshot() {
    const timestamp = new Date();
    
    // Memory usage (if available)
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > 0) {
      this.recordMemoryMetric(memoryUsage, timestamp);
    }
    
    // Frame rate (if available)
    const frameRate = this.getFrameRate();
    if (frameRate > 0) {
      this.recordFrameRate(frameRate, timestamp);
    }
    
    // CPU usage estimate
    const cpuUsage = this.estimateCPUUsage();
    if (cpuUsage >= 0) {
      this.recordCPUUsage(cpuUsage, timestamp);
    }
  }

  // AIDEV-NOTE: Record search operation performance
  recordSearchOperation(type, query, duration, resultCount, metadata = {}) {
    const metric = {
      id: this.generateMetricId(),
      type, // 'hot', 'cold', 'unified'
      query,
      duration,
      resultCount,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        sessionSearchCount: ++this.currentSession.searchCount
      }
    };
    
    // Store metric
    this.addMetric('searchOperations', metric);
    
    // Update session totals
    if (type === 'hot') {
      this.currentSession.hotSearchTime += duration;
    } else if (type === 'cold') {
      this.currentSession.coldSearchTime += duration;
    }
    
    // Check for performance issues
    this.checkSearchPerformance(metric);
    
    // Notify listeners
    this.notifyPerformanceListeners('search', metric);
  }

  // AIDEV-NOTE: Record storage operation performance
  recordStorageOperation(operation, duration, size, metadata = {}) {
    const metric = {
      id: this.generateMetricId(),
      operation, // 'read', 'write', 'delete', 'encrypt', 'decrypt'
      duration,
      size,
      timestamp: new Date(),
      metadata
    };
    
    this.addMetric('storageOperations', metric);
    this.notifyPerformanceListeners('storage', metric);
  }

  // AIDEV-NOTE: Record memory usage metric
  recordMemoryMetric(usage, timestamp = new Date()) {
    const metric = {
      id: this.generateMetricId(),
      usage,
      timestamp,
      peak: Math.max(...this.currentSession.memoryPeaks, usage)
    };
    
    this.addMetric('memoryUsage', metric);
    this.currentSession.memoryPeaks.push(usage);
    
    // Check for memory alerts
    if (usage > PERFORMANCE_CONFIG.HIGH_MEMORY_THRESHOLD) {
      this.recordAlert('high_memory', `Memory usage: ${usage}MB`, {
        usage,
        threshold: PERFORMANCE_CONFIG.HIGH_MEMORY_THRESHOLD
      });
    }
  }

  // AIDEV-NOTE: Record network operation performance
  recordNetworkOperation(url, method, duration, size, status) {
    const metric = {
      id: this.generateMetricId(),
      url,
      method,
      duration,
      size,
      status,
      timestamp: new Date()
    };
    
    this.addMetric('networkOperations', metric);
    this.notifyPerformanceListeners('network', metric);
  }

  // AIDEV-NOTE: Record user interaction performance
  recordUserInteraction(type, event) {
    const metric = {
      id: this.generateMetricId(),
      type,
      timestamp: new Date(),
      target: event.target?.tagName || 'unknown',
      processingTime: performance.now() - (event.timeStamp || 0)
    };
    
    this.addMetric('userInteractions', metric);
  }

  // AIDEV-NOTE: Record navigation performance metric
  recordNavigationMetric(entry) {
    const metric = {
      id: this.generateMetricId(),
      type: 'navigation',
      name: entry.name,
      duration: entry.duration,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      loadComplete: entry.loadEventEnd - entry.loadEventStart,
      timestamp: new Date(entry.startTime)
    };
    
    this.addMetric('renderingPerformance', metric);
  }

  // AIDEV-NOTE: Record paint performance metric
  recordPaintMetric(entry) {
    const metric = {
      id: this.generateMetricId(),
      type: 'paint',
      name: entry.name,
      startTime: entry.startTime,
      timestamp: new Date()
    };
    
    this.addMetric('renderingPerformance', metric);
  }

  // AIDEV-NOTE: Record resource loading metric
  recordResourceMetric(entry) {
    if (entry.name.includes('cold-storage') || entry.name.includes('.json')) {
      const metric = {
        id: this.generateMetricId(),
        type: 'resource',
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize || 0,
        timestamp: new Date()
      };
      
      this.addMetric('networkOperations', metric);
    }
  }

  // AIDEV-NOTE: Record long task metric
  recordLongTaskMetric(entry) {
    const metric = {
      id: this.generateMetricId(),
      type: 'longtask',
      duration: entry.duration,
      timestamp: new Date(entry.startTime)
    };
    
    this.addMetric('renderingPerformance', metric);
    
    // Alert for very long tasks
    if (entry.duration > 100) {
      this.recordAlert('long_task', `Long task detected: ${entry.duration.toFixed(2)}ms`, {
        duration: entry.duration
      });
    }
  }

  // AIDEV-NOTE: Check search performance and alert if needed
  checkSearchPerformance(metric) {
    const threshold = metric.type === 'hot' 
      ? PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD
      : PERFORMANCE_CONFIG.SLOW_COLD_THRESHOLD;
    
    if (metric.duration > threshold) {
      this.alerts.consecutiveSlowOps++;
      
      if (this.alerts.consecutiveSlowOps >= PERFORMANCE_CONFIG.CONSECUTIVE_SLOW_ALERTS) {
        this.recordAlert('slow_search', 
          `Slow ${metric.type} search: ${metric.duration}ms`, {
            type: metric.type,
            duration: metric.duration,
            threshold,
            consecutiveCount: this.alerts.consecutiveSlowOps
          });
        
        this.alerts.consecutiveSlowOps = 0; // Reset counter
      }
    } else {
      this.alerts.consecutiveSlowOps = 0; // Reset on good performance
    }
  }

  // AIDEV-NOTE: Record performance alert
  recordAlert(type, message, metadata = {}) {
    const now = Date.now();
    const lastAlert = this.alerts.lastAlerts.get(type);
    
    // Check cooldown
    if (lastAlert && (now - lastAlert) < PERFORMANCE_CONFIG.ALERT_COOLDOWN) {
      return;
    }
    
    const alert = {
      id: this.generateMetricId(),
      type,
      message,
      metadata,
      timestamp: new Date(),
      severity: this.getAlertSeverity(type, metadata)
    };
    
    this.alerts.history.push(alert);
    this.alerts.lastAlerts.set(type, now);
    
    // Notify alert listeners
    this.notifyAlertListeners(alert);
    
    console.warn(`Performance Alert [${type}]:`, message, metadata);
  }

  // AIDEV-NOTE: Get alert severity level
  getAlertSeverity(type, metadata) {
    switch (type) {
      case 'high_memory':
        return metadata.usage > 300 ? 'critical' : 'warning';
      case 'slow_search':
        return metadata.duration > 5000 ? 'critical' : 'warning';
      case 'long_task':
        return metadata.duration > 500 ? 'critical' : 'warning';
      default:
        return 'info';
    }
  }

  // AIDEV-NOTE: Get current memory usage
  getMemoryUsage() {
    try {
      if (performance.memory) {
        return Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      }
      return -1;
    } catch (error) {
      return -1;
    }
  }

  // AIDEV-NOTE: Get current frame rate estimate
  getFrameRate() {
    // This is a simplified frame rate estimation
    // In a real implementation, you'd use requestAnimationFrame
    try {
      return 60; // Placeholder - implement proper FPS tracking
    } catch (error) {
      return -1;
    }
  }

  // AIDEV-NOTE: Estimate CPU usage
  estimateCPUUsage() {
    // Simplified CPU usage estimation
    // Based on recent long task metrics
    const recentTasks = this.metrics.renderingPerformance
      .filter(m => m.type === 'longtask' && 
               (Date.now() - m.timestamp.getTime()) < 5000);
    
    if (recentTasks.length === 0) return 0;
    
    const totalTaskTime = recentTasks.reduce((sum, task) => sum + task.duration, 0);
    return Math.min(100, (totalTaskTime / 5000) * 100); // % of last 5 seconds
  }

  // AIDEV-NOTE: Add metric to storage with size limit
  addMetric(category, metric) {
    if (!this.metrics[category]) {
      this.metrics[category] = [];
    }
    
    this.metrics[category].push(metric);
    
    // Enforce size limit
    if (this.metrics[category].length > PERFORMANCE_CONFIG.MAX_SAMPLES) {
      this.metrics[category] = this.metrics[category].slice(-PERFORMANCE_CONFIG.MAX_SAMPLES);
    }
  }

  // AIDEV-NOTE: Generate unique metric ID
  generateMetricId() {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // AIDEV-NOTE: Get performance summary statistics
  getPerformanceSummary(hours = 1) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Filter recent metrics
    const recentSearches = this.metrics.searchOperations
      .filter(m => m.timestamp >= cutoff);
    
    const recentMemory = this.metrics.memoryUsage
      .filter(m => m.timestamp >= cutoff);
    
    const recentAlerts = this.alerts.history
      .filter(a => a.timestamp >= cutoff);
    
    return {
      timeframe: `${hours} hour(s)`,
      searchPerformance: {
        totalSearches: recentSearches.length,
        avgHotSearchTime: this.calculateAverage(
          recentSearches.filter(s => s.type === 'hot'), 'duration'
        ),
        avgColdSearchTime: this.calculateAverage(
          recentSearches.filter(s => s.type === 'cold'), 'duration'
        ),
        slowSearches: recentSearches.filter(s => 
          s.duration > (s.type === 'hot' ? PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD : PERFORMANCE_CONFIG.SLOW_COLD_THRESHOLD)
        ).length
      },
      memoryUsage: {
        current: this.getMemoryUsage(),
        average: this.calculateAverage(recentMemory, 'usage'),
        peak: Math.max(...recentMemory.map(m => m.usage), 0),
        highUsageEvents: recentMemory.filter(m => 
          m.usage > PERFORMANCE_CONFIG.HIGH_MEMORY_THRESHOLD
        ).length
      },
      alerts: {
        total: recentAlerts.length,
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        warnings: recentAlerts.filter(a => a.severity === 'warning').length,
        byType: this.groupAlertsByType(recentAlerts)
      },
      session: {
        startTime: this.currentSession.startTime,
        searchCount: this.currentSession.searchCount,
        totalHotTime: this.currentSession.hotSearchTime,
        totalColdTime: this.currentSession.coldSearchTime,
        memoryPeak: Math.max(...this.currentSession.memoryPeaks, 0)
      }
    };
  }

  // AIDEV-NOTE: Calculate average for metric array
  calculateAverage(metrics, property) {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((total, metric) => total + metric[property], 0);
    return Math.round(sum / metrics.length);
  }

  // AIDEV-NOTE: Group alerts by type
  groupAlertsByType(alerts) {
    const grouped = {};
    alerts.forEach(alert => {
      grouped[alert.type] = (grouped[alert.type] || 0) + 1;
    });
    return grouped;
  }

  // AIDEV-NOTE: Clean up old metrics
  cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - PERFORMANCE_CONFIG.METRIC_RETENTION_HOURS * 60 * 60 * 1000);
    
    for (const category in this.metrics) {
      const originalLength = this.metrics[category].length;
      this.metrics[category] = this.metrics[category]
        .filter(metric => metric.timestamp >= cutoff);
      
      const removed = originalLength - this.metrics[category].length;
      if (removed > 0) {
        console.log(`Cleaned up ${removed} old ${category} metrics`);
      }
    }
    
    // Clean up old alerts
    const originalAlerts = this.alerts.history.length;
    this.alerts.history = this.alerts.history.filter(alert => alert.timestamp >= cutoff);
    const removedAlerts = originalAlerts - this.alerts.history.length;
    
    if (removedAlerts > 0) {
      console.log(`Cleaned up ${removedAlerts} old alerts`);
    }
  }

  // AIDEV-NOTE: Register performance event listener
  onPerformanceEvent(listener) {
    this.performanceListeners.add(listener);
    return () => this.performanceListeners.delete(listener);
  }

  // AIDEV-NOTE: Register alert listener
  onAlert(listener) {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  // AIDEV-NOTE: Notify performance event listeners
  notifyPerformanceListeners(type, data) {
    for (const listener of this.performanceListeners) {
      try {
        listener(type, data);
      } catch (error) {
        console.error('Performance listener error:', error);
      }
    }
  }

  // AIDEV-NOTE: Notify alert listeners
  notifyAlertListeners(alert) {
    for (const listener of this.alertListeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error('Alert listener error:', error);
      }
    }
  }

  // AIDEV-NOTE: Get raw metrics for analysis
  getRawMetrics(category, limit = 100) {
    if (!this.metrics[category]) return [];
    
    return this.metrics[category]
      .slice(-limit)
      .map(metric => ({ ...metric })); // Return copies
  }

  // AIDEV-NOTE: Export performance data
  exportPerformanceData() {
    return {
      timestamp: new Date(),
      session: this.currentSession,
      metrics: {
        searchOperations: this.metrics.searchOperations.slice(-100),
        memoryUsage: this.metrics.memoryUsage.slice(-100),
        renderingPerformance: this.metrics.renderingPerformance.slice(-50),
        networkOperations: this.metrics.networkOperations.slice(-50)
      },
      alerts: this.alerts.history.slice(-50),
      summary: this.getPerformanceSummary(1)
    };
  }

  // AIDEV-NOTE: Cleanup and shutdown
  destroy() {
    this.stopMonitoring();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Disconnect observers
    Object.values(this.observers).forEach(observer => {
      if (observer) {
        try {
          observer.disconnect();
        } catch (error) {
          console.warn('Observer disconnect error:', error);
        }
      }
    });
    
    // Clear listeners
    this.performanceListeners.clear();
    this.alertListeners.clear();
    
    this.isInitialized = false;
    console.log('PerformanceMonitor destroyed');
  }
}

// AIDEV-NOTE: Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// AIDEV-NOTE: Export class for testing
export { PerformanceMonitor, PERFORMANCE_CONFIG };