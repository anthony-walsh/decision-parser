/**
 * Performance Monitor Service for Hot/Cold Storage Architecture
 * 
 * Tracks application performance metrics, monitors operation timings,
 * and provides insights for optimization and user experience.
 */

// AIDEV-NOTE: Performance monitoring configuration with proper typing
export interface PerformanceConfig {
  // Metric collection settings
  MAX_SAMPLES: number;           // Maximum samples to keep in memory
  SAMPLING_INTERVAL: number;     // Background sampling interval (ms)
  BATCH_SIZE: number;            // Samples to process in batch
  
  // Performance thresholds
  SLOW_SEARCH_THRESHOLD: number; // Hot search slower than 2s is concerning
  SLOW_COLD_THRESHOLD: number;   // Cold search slower than 10s is concerning
  HIGH_MEMORY_THRESHOLD: number; // Memory usage above 200MB
  LOW_FPS_THRESHOLD: number;     // FPS below 30 is poor
  
  // Alert configuration
  CONSECUTIVE_SLOW_ALERTS: number; // Alert after 3 consecutive slow operations
  ALERT_COOLDOWN: number;          // 30s cooldown between similar alerts
  
  // Metric retention
  METRIC_RETENTION_HOURS: number; // Keep metrics for 24 hours
  CLEANUP_INTERVAL: number;       // Cleanup old metrics every 5 minutes
}

export const PERFORMANCE_CONFIG: PerformanceConfig = {
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

// AIDEV-NOTE: Performance metric interfaces
export interface BaseMetric {
  id: string;
  timestamp: Date;
}

export interface SearchMetric extends BaseMetric {
  type: 'hot' | 'cold' | 'unified';
  query: string;
  duration: number;
  resultCount: number;
  metadata: {
    sessionSearchCount: number;
    [key: string]: any;
  };
}

export interface StorageMetric extends BaseMetric {
  operation: 'read' | 'write' | 'delete' | 'encrypt' | 'decrypt' | 'cleanup';
  duration: number;
  size: number;
  metadata: {
    [key: string]: any;
  };
}

export interface MemoryMetric extends BaseMetric {
  usage: number;
  peak: number;
}

export interface FrameRateMetric extends BaseMetric {
  frameRate: number;
  target: number;
}

export interface CPUMetric extends BaseMetric {
  usage: number;
  category: 'low' | 'medium' | 'high';
}

export interface NetworkMetric extends BaseMetric {
  url: string;
  method: string;
  duration: number;
  size: number;
  status: number;
}

export interface UserInteractionMetric extends BaseMetric {
  type: string;
  target: string;
  processingTime: number;
}

export interface RenderingMetric extends BaseMetric {
  type: 'navigation' | 'paint' | 'longtask';
  name?: string;
  duration?: number;
  domContentLoaded?: number;
  loadComplete?: number;
  startTime?: number;
}

export interface PerformanceAlert extends BaseMetric {
  type: string;
  message: string;
  metadata: {
    [key: string]: any;
  };
  severity: 'info' | 'warning' | 'critical';
}

export interface CurrentSession {
  startTime: Date;
  searchCount: number;
  hotSearchTime: number;
  coldSearchTime: number;
  memoryPeaks: number[];
  errors: any[];
}

export interface AlertTracking {
  history: PerformanceAlert[];
  lastAlerts: Map<string, number>;
  consecutiveSlowOps: number;
}

export interface MetricsStorage {
  searchOperations: SearchMetric[];
  memoryUsage: MemoryMetric[];
  renderingPerformance: RenderingMetric[];
  networkOperations: NetworkMetric[];
  storageOperations: StorageMetric[];
  userInteractions: UserInteractionMetric[];
  frameRate: FrameRateMetric[];
  cpuUsage: CPUMetric[];
}

export interface PerformanceObservers {
  navigation: PerformanceObserver | null;
  paint: PerformanceObserver | null;
  resource: PerformanceObserver | null;
  longtask: PerformanceObserver | null;
}

export interface PerformanceSummary {
  timeframe: string;
  searchPerformance: {
    totalSearches: number;
    avgHotSearchTime: number;
    avgColdSearchTime: number;
    slowSearches: number;
  };
  memoryUsage: {
    current: number;
    average: number;
    peak: number;
    highUsageEvents: number;
  };
  alerts: {
    total: number;
    critical: number;
    warnings: number;
    byType: Record<string, number>;
  };
  session: {
    startTime: Date;
    searchCount: number;
    totalHotTime: number;
    totalColdTime: number;
    memoryPeak: number;
  };
}

export type PerformanceEventListener = (type: string, data: any) => void;
export type AlertEventListener = (alert: PerformanceAlert) => void;

// AIDEV-NOTE: Extend global interfaces for browser performance APIs
declare global {
  interface Window {
    memoryManager?: any;
  }
}

export class PerformanceMonitor {
  private isInitialized = false;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Performance metrics storage with proper typing
  private metrics: MetricsStorage = {
    searchOperations: [],
    memoryUsage: [],
    renderingPerformance: [],
    networkOperations: [],
    storageOperations: [],
    userInteractions: [],
    frameRate: [],
    cpuUsage: []
  };
  
  // Real-time performance tracking
  private currentSession: CurrentSession = {
    startTime: new Date(),
    searchCount: 0,
    hotSearchTime: 0,
    coldSearchTime: 0,
    memoryPeaks: [],
    errors: []
  };
  
  // Performance alerts and warnings
  private alerts: AlertTracking = {
    history: [],
    lastAlerts: new Map(),
    consecutiveSlowOps: 0
  };
  
  // Event listeners with proper typing
  private performanceListeners = new Set<PerformanceEventListener>();
  private alertListeners = new Set<AlertEventListener>();
  
  // Performance observers with proper typing
  private observers: PerformanceObservers = {
    navigation: null,
    paint: null,
    resource: null,
    longtask: null
  };
  
  constructor() {
    // Auto-initialize
    this.initialize();
  }

  // AIDEV-NOTE: Initialize performance monitoring
  public async initialize(): Promise<void> {
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
  private setupPerformanceObservers(): void {
    try {
      // Navigation timing observer
      if ('PerformanceObserver' in window) {
        this.observers.navigation = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordNavigationMetric(entry as PerformanceNavigationTiming);
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
            this.recordResourceMetric(entry as PerformanceResourceTiming);
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
  private setupUserInteractionTracking(): void {
    const interactionEvents = ['click', 'keydown', 'scroll', 'touchstart'];
    
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, (event: Event) => {
        this.recordUserInteraction(eventType, event);
      }, { passive: true });
    });
  }

  // AIDEV-NOTE: Setup memory monitoring integration
  private setupMemoryMonitoring(): void {
    // This will be integrated with MemoryManager
    if (window.memoryManager) {
      window.memoryManager.onMemoryWarning((data: any) => {
        this.recordMemoryAlert(data);
      });
    }
  }

  // AIDEV-NOTE: Record memory alert
  private recordMemoryAlert(data: any): void {
    this.recordAlert('memory_warning', `Memory warning: ${data.currentMemory}MB`, {
      currentMemory: data.currentMemory,
      threshold: data.threshold
    });
  }

  // AIDEV-NOTE: Start performance monitoring
  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectPerformanceSnapshot();
    }, PERFORMANCE_CONFIG.SAMPLING_INTERVAL);
    
    console.log('Performance monitoring started');
  }

  // AIDEV-NOTE: Stop performance monitoring
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Performance monitoring stopped');
  }

  // AIDEV-NOTE: Start cleanup interval for old metrics
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, PERFORMANCE_CONFIG.CLEANUP_INTERVAL);
  }

  // AIDEV-NOTE: Collect performance snapshot
  private collectPerformanceSnapshot(): void {
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
  public recordSearchOperation(
    type: 'hot' | 'cold' | 'unified', 
    query: string, 
    duration: number, 
    resultCount: number, 
    metadata: Record<string, any> = {}
  ): void {
    const metric: SearchMetric = {
      id: this.generateMetricId(),
      type,
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
  public recordStorageOperation(
    operation: 'read' | 'write' | 'delete' | 'encrypt' | 'decrypt' | 'cleanup', 
    duration: number, 
    size: number, 
    metadata: Record<string, any> = {}
  ): void {
    const metric: StorageMetric = {
      id: this.generateMetricId(),
      operation,
      duration,
      size,
      timestamp: new Date(),
      metadata
    };
    
    this.addMetric('storageOperations', metric);
    this.notifyPerformanceListeners('storage', metric);
  }

  // AIDEV-NOTE: Record memory usage metric
  public recordMemoryMetric(usage: number, timestamp = new Date()): void {
    const metric: MemoryMetric = {
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

  // AIDEV-NOTE: Record frame rate metric
  public recordFrameRate(frameRate: number, timestamp = new Date()): void {
    const metric: FrameRateMetric = {
      id: this.generateMetricId(),
      frameRate,
      timestamp,
      target: 60 // Target FPS for comparison
    };
    
    this.addMetric('frameRate', metric);
    
    // Check for low frame rate alerts
    if (frameRate < 30) {
      this.recordAlert('low_framerate', `Low frame rate: ${frameRate}fps`, {
        frameRate,
        target: 60
      });
    }
  }

  // AIDEV-NOTE: Record CPU usage metric
  public recordCPUUsage(usage: number, timestamp = new Date()): void {
    const metric: CPUMetric = {
      id: this.generateMetricId(),
      usage,
      timestamp,
      category: usage > 80 ? 'high' : usage > 50 ? 'medium' : 'low'
    };
    
    this.addMetric('cpuUsage', metric);
    
    // Check for high CPU usage alerts
    if (usage > 80) {
      this.recordAlert('high_cpu', `High CPU usage: ${usage}%`, {
        usage,
        threshold: 80
      });
    }
  }

  // AIDEV-NOTE: Record network operation performance
  public recordNetworkOperation(
    url: string, 
    method: string, 
    duration: number, 
    size: number, 
    status: number
  ): void {
    const metric: NetworkMetric = {
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
  public recordUserInteraction(type: string, event: Event): void {
    const metric: UserInteractionMetric = {
      id: this.generateMetricId(),
      type,
      timestamp: new Date(),
      target: (event.target as HTMLElement)?.tagName || 'unknown',
      processingTime: performance.now() - (event.timeStamp || 0)
    };
    
    this.addMetric('userInteractions', metric);
  }

  // AIDEV-NOTE: Record navigation performance metric
  private recordNavigationMetric(entry: PerformanceNavigationTiming): void {
    const metric: RenderingMetric = {
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
  private recordPaintMetric(entry: PerformanceEntry): void {
    const metric: RenderingMetric = {
      id: this.generateMetricId(),
      type: 'paint',
      name: entry.name,
      startTime: entry.startTime,
      timestamp: new Date()
    };
    
    this.addMetric('renderingPerformance', metric);
  }

  // AIDEV-NOTE: Record resource loading metric
  private recordResourceMetric(entry: PerformanceResourceTiming): void {
    if (entry.name.includes('cold-storage') || entry.name.includes('.json')) {
      const metric: NetworkMetric = {
        id: this.generateMetricId(),
        url: entry.name,
        method: 'GET', // Most resources are GET requests
        duration: entry.duration,
        size: entry.transferSize || 0,
        status: 200, // Assume success for completed resources
        timestamp: new Date()
      };
      
      this.addMetric('networkOperations', metric);
    }
  }

  // AIDEV-NOTE: Record long task metric
  private recordLongTaskMetric(entry: PerformanceEntry): void {
    const metric: RenderingMetric = {
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
  private checkSearchPerformance(metric: SearchMetric): void {
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
  public recordAlert(type: string, message: string, metadata: Record<string, any> = {}): void {
    const now = Date.now();
    const lastAlert = this.alerts.lastAlerts.get(type);
    
    // Check cooldown
    if (lastAlert && (now - lastAlert) < PERFORMANCE_CONFIG.ALERT_COOLDOWN) {
      return;
    }
    
    const alert: PerformanceAlert = {
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
  private getAlertSeverity(type: string, metadata: Record<string, any>): 'info' | 'warning' | 'critical' {
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
  private getMemoryUsage(): number {
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
  private getFrameRate(): number {
    // This is a simplified frame rate estimation
    // In a real implementation, you'd use requestAnimationFrame
    try {
      return 60; // Placeholder - implement proper FPS tracking
    } catch (error) {
      return -1;
    }
  }

  // AIDEV-NOTE: Estimate CPU usage
  private estimateCPUUsage(): number {
    // Simplified CPU usage estimation
    // Based on recent long task metrics
    const recentTasks = this.metrics.renderingPerformance
      .filter(m => m.type === 'longtask' && 
               (Date.now() - m.timestamp.getTime()) < 5000);
    
    if (recentTasks.length === 0) return 0;
    
    const totalTaskTime = recentTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    return Math.min(100, (totalTaskTime / 5000) * 100); // % of last 5 seconds
  }

  // AIDEV-NOTE: Add metric to storage with size limit
  private addMetric(category: keyof MetricsStorage, metric: BaseMetric): void {
    if (!this.metrics[category]) {
      (this.metrics as any)[category] = [];
    }
    
    (this.metrics[category] as BaseMetric[]).push(metric);
    
    // Enforce size limit
    if (this.metrics[category].length > PERFORMANCE_CONFIG.MAX_SAMPLES) {
      (this.metrics[category] as BaseMetric[]) = (this.metrics[category] as BaseMetric[]).slice(-PERFORMANCE_CONFIG.MAX_SAMPLES);
    }
  }

  // AIDEV-NOTE: Generate unique metric ID
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // AIDEV-NOTE: Get performance summary statistics
  public getPerformanceSummary(hours = 1): PerformanceSummary {
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
  private calculateAverage(metrics: BaseMetric[], property: string): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((total, metric) => total + ((metric as any)[property] || 0), 0);
    return Math.round(sum / metrics.length);
  }

  // AIDEV-NOTE: Group alerts by type
  private groupAlertsByType(alerts: PerformanceAlert[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    alerts.forEach(alert => {
      grouped[alert.type] = (grouped[alert.type] || 0) + 1;
    });
    return grouped;
  }

  // AIDEV-NOTE: Clean up old metrics
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - PERFORMANCE_CONFIG.METRIC_RETENTION_HOURS * 60 * 60 * 1000);
    
    for (const category in this.metrics) {
      const key = category as keyof MetricsStorage;
      const originalLength = this.metrics[key].length;
      (this.metrics[key] as BaseMetric[]) = (this.metrics[key] as BaseMetric[])
        .filter(metric => metric.timestamp >= cutoff);
      
      const removed = originalLength - this.metrics[key].length;
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
  public onPerformanceEvent(listener: PerformanceEventListener): () => void {
    this.performanceListeners.add(listener);
    return () => this.performanceListeners.delete(listener);
  }

  // AIDEV-NOTE: Register alert listener
  public onAlert(listener: AlertEventListener): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  // AIDEV-NOTE: Notify performance event listeners
  private notifyPerformanceListeners(type: string, data: any): void {
    for (const listener of this.performanceListeners) {
      try {
        listener(type, data);
      } catch (error) {
        console.error('Performance listener error:', error);
      }
    }
  }

  // AIDEV-NOTE: Notify alert listeners
  private notifyAlertListeners(alert: PerformanceAlert): void {
    for (const listener of this.alertListeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error('Alert listener error:', error);
      }
    }
  }

  // AIDEV-NOTE: Get raw metrics for analysis
  public getRawMetrics(category: keyof MetricsStorage, limit = 100): BaseMetric[] {
    if (!this.metrics[category]) return [];
    
    return this.metrics[category]
      .slice(-limit)
      .map(metric => ({ ...metric })); // Return copies
  }

  // AIDEV-NOTE: Export performance data
  public exportPerformanceData(): {
    timestamp: Date;
    session: CurrentSession;
    metrics: Partial<MetricsStorage>;
    alerts: PerformanceAlert[];
    summary: PerformanceSummary;
  } {
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
  public destroy(): void {
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