/**
 * Unit Tests for PerformanceMonitor TypeScript Service
 * 
 * Testing performance tracking, metrics collection, and alerting
 * AIDEV-NOTE: Tests for newly migrated TypeScript PerformanceMonitor service
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { PerformanceMonitor, PERFORMANCE_CONFIG } from '../../../src/services/PerformanceMonitor';

// Mock browser APIs
const mockPerformance = {
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
  },
  now: vi.fn(() => Date.now())
};

const mockNavigator = {
  onLine: true
};

const mockDocument = {
  hidden: false,
  hasFocus: vi.fn(() => true),
  addEventListener: vi.fn()
};

// Mock global browser APIs
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
});

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
});

Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    memoryManager: {
      onMemoryWarning: vi.fn(),
      onCleanup: vi.fn()
    },
    PerformanceObserver: vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }))
  },
  writable: true
});

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let consoleLogSpy: MockedFunction<any>;
  let consoleWarnSpy: MockedFunction<any>;

  beforeEach(() => {
    // Create fresh instance for each test
    performanceMonitor = new PerformanceMonitor();
    
    // Setup console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Cleanup
    performanceMonitor.destroy();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with performance observers', async () => {
      await performanceMonitor.initialize();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('PerformanceMonitor initialized successfully');
    });

    it('should handle PerformanceObserver setup gracefully when unavailable', async () => {
      // Remove PerformanceObserver
      const originalObserver = global.window.PerformanceObserver;
      delete (global.window as any).PerformanceObserver;
      
      const monitor = new PerformanceMonitor();
      await monitor.initialize();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('PerformanceMonitor initialized successfully');
      
      // Restore
      global.window.PerformanceObserver = originalObserver;
      monitor.destroy();
    });
  });

  describe('Search Operation Metrics', () => {
    it('should record hot search operations correctly', () => {
      const query = 'test query';
      const duration = 1500;
      const resultCount = 25;
      const metadata = { userId: 'test-user' };
      
      performanceMonitor.recordSearchOperation('hot', query, duration, resultCount, metadata);
      
      const summary = performanceMonitor.getPerformanceSummary(1);
      expect(summary.searchPerformance.totalSearches).toBe(1);
      expect(summary.searchPerformance.avgHotSearchTime).toBe(duration);
      expect(summary.searchPerformance.avgColdSearchTime).toBe(0);
    });

    it('should record cold search operations correctly', () => {
      const query = 'encrypted search';
      const duration = 5000;
      const resultCount = 10;
      
      performanceMonitor.recordSearchOperation('cold', query, duration, resultCount);
      
      const summary = performanceMonitor.getPerformanceSummary(1);
      expect(summary.searchPerformance.totalSearches).toBe(1);
      expect(summary.searchPerformance.avgColdSearchTime).toBe(duration);
      expect(summary.searchPerformance.avgHotSearchTime).toBe(0);
    });

    it('should track slow search operations and create alerts', () => {
      const alertListener = vi.fn();
      performanceMonitor.onAlert(alertListener);
      
      // Record multiple slow searches to trigger consecutive alert
      for (let i = 0; i < PERFORMANCE_CONFIG.CONSECUTIVE_SLOW_ALERTS; i++) {
        performanceMonitor.recordSearchOperation('hot', 'slow query', 
          PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD + 1000, 5);
      }
      
      expect(alertListener).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'slow_search',
        message: expect.stringContaining('Slow hot search'),
        metadata: expect.objectContaining({
          type: 'hot',
          duration: PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD + 1000,
          consecutiveCount: PERFORMANCE_CONFIG.CONSECUTIVE_SLOW_ALERTS
        }),
        timestamp: expect.any(Date),
        severity: 'warning'
      });
    });

    it('should reset consecutive slow operation counter on good performance', () => {
      // Record slow searches
      performanceMonitor.recordSearchOperation('hot', 'slow', 
        PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD + 1000, 5);
      performanceMonitor.recordSearchOperation('hot', 'slow', 
        PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD + 1000, 5);
      
      // Record fast search - should reset counter
      performanceMonitor.recordSearchOperation('hot', 'fast', 500, 10);
      
      // Another slow search should not trigger alert (counter was reset)
      const alertListener = vi.fn();
      performanceMonitor.onAlert(alertListener);
      
      performanceMonitor.recordSearchOperation('hot', 'slow again', 
        PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD + 1000, 5);
      
      expect(alertListener).not.toHaveBeenCalled();
    });
  });

  describe('Memory Metrics', () => {
    it('should record memory usage metrics', () => {
      const usage = 150;
      
      performanceMonitor.recordMemoryMetric(usage);
      
      const summary = performanceMonitor.getPerformanceSummary(1);
      expect(summary.memoryUsage.current).toBeGreaterThanOrEqual(0);
      expect(summary.memoryUsage.average).toBe(usage);
    });

    it('should create alerts for high memory usage', () => {
      const alertListener = vi.fn();
      performanceMonitor.onAlert(alertListener);
      
      const highMemoryUsage = PERFORMANCE_CONFIG.HIGH_MEMORY_THRESHOLD + 50;
      performanceMonitor.recordMemoryMetric(highMemoryUsage);
      
      expect(alertListener).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'high_memory',
        message: `Memory usage: ${highMemoryUsage}MB`,
        metadata: {
          usage: highMemoryUsage,
          threshold: PERFORMANCE_CONFIG.HIGH_MEMORY_THRESHOLD
        },
        timestamp: expect.any(Date),
        severity: 'warning'
      });
    });
  });

  describe('Storage Operation Metrics', () => {
    it('should record storage operations with performance data', () => {
      const operation = 'encrypt';
      const duration = 2000;
      const size = 10;
      const metadata = { batchId: 'batch-123' };
      
      performanceMonitor.recordStorageOperation(operation, duration, size, metadata);
      
      const rawMetrics = performanceMonitor.getRawMetrics('storageOperations', 10);
      expect(rawMetrics).toHaveLength(1);
      expect(rawMetrics[0]).toEqual(expect.objectContaining({
        operation,
        duration,
        size,
        metadata
      }));
    });
  });

  describe('Frame Rate and CPU Metrics', () => {
    it('should record frame rate metrics', () => {
      const frameRate = 45;
      
      performanceMonitor.recordFrameRate(frameRate);
      
      const rawMetrics = performanceMonitor.getRawMetrics('frameRate', 10);
      expect(rawMetrics).toHaveLength(1);
      expect(rawMetrics[0]).toEqual(expect.objectContaining({
        frameRate,
        target: 60
      }));
    });

    it('should create alerts for low frame rates', () => {
      const alertListener = vi.fn();
      performanceMonitor.onAlert(alertListener);
      
      performanceMonitor.recordFrameRate(25); // Below 30fps threshold
      
      expect(alertListener).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'low_framerate',
        message: 'Low frame rate: 25fps',
        metadata: {
          frameRate: 25,
          target: 60
        },
        timestamp: expect.any(Date),
        severity: 'warning'
      });
    });

    it('should record CPU usage metrics', () => {
      const usage = 75;
      
      performanceMonitor.recordCPUUsage(usage);
      
      const rawMetrics = performanceMonitor.getRawMetrics('cpuUsage', 10);
      expect(rawMetrics).toHaveLength(1);
      expect(rawMetrics[0]).toEqual(expect.objectContaining({
        usage,
        category: 'medium'
      }));
    });

    it('should categorize CPU usage correctly', () => {
      performanceMonitor.recordCPUUsage(30); // Low
      performanceMonitor.recordCPUUsage(60); // Medium  
      performanceMonitor.recordCPUUsage(90); // High
      
      const rawMetrics = performanceMonitor.getRawMetrics('cpuUsage', 10);
      expect(rawMetrics[0]).toEqual(expect.objectContaining({ category: 'low' }));
      expect(rawMetrics[1]).toEqual(expect.objectContaining({ category: 'medium' }));
      expect(rawMetrics[2]).toEqual(expect.objectContaining({ category: 'high' }));
    });
  });

  describe('Network Operation Metrics', () => {
    it('should record network operations', () => {
      const url = 'https://api.example.com/data';
      const method = 'GET';
      const duration = 800;
      const size = 1024;
      const status = 200;
      
      performanceMonitor.recordNetworkOperation(url, method, duration, size, status);
      
      const rawMetrics = performanceMonitor.getRawMetrics('networkOperations', 10);
      expect(rawMetrics).toHaveLength(1);
      expect(rawMetrics[0]).toEqual(expect.objectContaining({
        url,
        method,
        duration,
        size,
        status
      }));
    });
  });

  describe('Alert Management', () => {
    it('should record alerts with proper severity levels', () => {
      performanceMonitor.recordAlert('test_alert', 'Test message', {});
      
      const exportData = performanceMonitor.exportPerformanceData();
      expect(exportData.alerts).toHaveLength(1);
      expect(exportData.alerts[0]).toEqual(expect.objectContaining({
        type: 'test_alert',
        message: 'Test message',
        severity: 'info'
      }));
    });

    it('should respect alert cooldown periods', () => {
      const alertType = 'test_cooldown';
      
      // Record first alert
      performanceMonitor.recordAlert(alertType, 'First alert');
      
      // Try to record same type immediately
      performanceMonitor.recordAlert(alertType, 'Second alert');
      
      const exportData = performanceMonitor.exportPerformanceData();
      expect(exportData.alerts.filter(a => a.type === alertType)).toHaveLength(1);
    });

    it('should determine alert severity correctly', () => {
      // Test different alert types and their severity logic
      performanceMonitor.recordAlert('high_memory', 'High memory test', { usage: 350 });
      performanceMonitor.recordAlert('slow_search', 'Slow search test', { duration: 6000 });
      performanceMonitor.recordAlert('long_task', 'Long task test', { duration: 600 });
      
      const exportData = performanceMonitor.exportPerformanceData();
      
      const memoryAlert = exportData.alerts.find(a => a.type === 'high_memory');
      const searchAlert = exportData.alerts.find(a => a.type === 'slow_search');
      const taskAlert = exportData.alerts.find(a => a.type === 'long_task');
      
      expect(memoryAlert?.severity).toBe('critical'); // Over 300MB
      expect(searchAlert?.severity).toBe('critical'); // Over 5000ms
      expect(taskAlert?.severity).toBe('critical'); // Over 500ms
    });

    it('should notify alert listeners', () => {
      const alertListener = vi.fn();
      const unsubscribe = performanceMonitor.onAlert(alertListener);
      
      performanceMonitor.recordAlert('test_listener', 'Test listener message');
      
      expect(alertListener).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'test_listener',
        message: 'Test listener message',
        metadata: {},
        timestamp: expect.any(Date),
        severity: 'info'
      });
      
      // Test unsubscribe
      unsubscribe();
      alertListener.mockClear();
      
      performanceMonitor.recordAlert('test_listener2', 'Another test');
      expect(alertListener).not.toHaveBeenCalled();
    });
  });

  describe('Performance Summary', () => {
    it('should provide comprehensive performance summary', () => {
      // Record various metrics
      performanceMonitor.recordSearchOperation('hot', 'test1', 1000, 10);
      performanceMonitor.recordSearchOperation('cold', 'test2', 3000, 5);
      performanceMonitor.recordMemoryMetric(120);
      performanceMonitor.recordAlert('test_alert', 'Test alert', {});
      
      const summary = performanceMonitor.getPerformanceSummary(1);
      
      expect(summary).toEqual({
        timeframe: '1 hour(s)',
        searchPerformance: {
          totalSearches: 2,
          avgHotSearchTime: 1000,
          avgColdSearchTime: 3000,
          slowSearches: 0
        },
        memoryUsage: {
          current: expect.any(Number),
          average: 120,
          peak: 120,
          highUsageEvents: 0
        },
        alerts: {
          total: 1,
          critical: 0,
          warnings: 0,
          byType: { 'test_alert': 1 }
        },
        session: {
          startTime: expect.any(Date),
          searchCount: 2,
          totalHotTime: 1000,
          totalColdTime: 3000,
          memoryPeak: 120
        }
      });
    });

    it('should filter metrics by time window correctly', () => {
      // Record old metric (simulate past time)
      const oldTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      vi.setSystemTime(oldTime);
      performanceMonitor.recordSearchOperation('hot', 'old search', 1000, 5);
      
      // Record recent metric
      vi.setSystemTime(Date.now()); // Current time
      performanceMonitor.recordSearchOperation('hot', 'recent search', 1500, 8);
      
      const summary = performanceMonitor.getPerformanceSummary(1); // Last 1 hour
      expect(summary.searchPerformance.totalSearches).toBe(1); // Only recent search
      expect(summary.searchPerformance.avgHotSearchTime).toBe(1500);
    });
  });

  describe('Data Export and Cleanup', () => {
    it('should export performance data correctly', () => {
      performanceMonitor.recordSearchOperation('hot', 'export test', 1200, 15);
      performanceMonitor.recordMemoryMetric(100);
      
      const exportData = performanceMonitor.exportPerformanceData();
      
      expect(exportData).toEqual({
        timestamp: expect.any(Date),
        session: expect.objectContaining({
          startTime: expect.any(Date),
          searchCount: 1
        }),
        metrics: {
          searchOperations: expect.arrayContaining([
            expect.objectContaining({
              type: 'hot',
              query: 'export test',
              duration: 1200,
              resultCount: 15
            })
          ]),
          memoryUsage: expect.arrayContaining([
            expect.objectContaining({
              usage: 100
            })
          ]),
          renderingPerformance: expect.any(Array),
          networkOperations: expect.any(Array)
        },
        alerts: expect.any(Array),
        summary: expect.any(Object)
      });
    });

    it('should cleanup old metrics automatically', () => {
      // Create metrics with old timestamps
      const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      vi.setSystemTime(oldTime);
      
      performanceMonitor.recordSearchOperation('hot', 'old search', 1000, 5);
      performanceMonitor.recordAlert('old_alert', 'Old alert');
      
      // Return to current time and add recent metrics
      vi.setSystemTime(Date.now());
      performanceMonitor.recordSearchOperation('hot', 'new search', 1500, 8);
      
      // Trigger cleanup (simulate cleanup interval)
      vi.advanceTimersByTime(PERFORMANCE_CONFIG.CLEANUP_INTERVAL + 100);
      
      const exportData = performanceMonitor.exportPerformanceData();
      
      // Should only have recent data
      expect(exportData.metrics.searchOperations.length).toBe(1);
      expect(exportData.metrics.searchOperations[0].query).toBe('new search');
    });
  });

  describe('Configuration and Constants', () => {
    it('should use correct configuration values', () => {
      expect(PERFORMANCE_CONFIG.MAX_SAMPLES).toBe(1000);
      expect(PERFORMANCE_CONFIG.SLOW_SEARCH_THRESHOLD).toBe(2000);
      expect(PERFORMANCE_CONFIG.SLOW_COLD_THRESHOLD).toBe(10000);
      expect(PERFORMANCE_CONFIG.HIGH_MEMORY_THRESHOLD).toBe(200);
      expect(PERFORMANCE_CONFIG.CONSECUTIVE_SLOW_ALERTS).toBe(3);
      expect(PERFORMANCE_CONFIG.ALERT_COOLDOWN).toBe(30000);
    });

    it('should enforce sample size limits', () => {
      // Add more samples than the limit
      for (let i = 0; i < PERFORMANCE_CONFIG.MAX_SAMPLES + 100; i++) {
        performanceMonitor.recordSearchOperation('hot', `search-${i}`, 1000, 5);
      }
      
      const rawMetrics = performanceMonitor.getRawMetrics('searchOperations', PERFORMANCE_CONFIG.MAX_SAMPLES + 100);
      expect(rawMetrics.length).toBeLessThanOrEqual(PERFORMANCE_CONFIG.MAX_SAMPLES);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle performance listener errors gracefully', () => {
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      performanceMonitor.onPerformanceEvent(faultyListener);
      
      // Should not throw even with faulty listener
      expect(() => {
        performanceMonitor.recordSearchOperation('hot', 'test', 1000, 5);
      }).not.toThrow();
      
      expect(faultyListener).toHaveBeenCalled();
    });

    it('should handle missing browser APIs gracefully', () => {
      // Remove performance.memory
      const originalMemory = global.performance.memory;
      delete (global.performance as any).memory;
      
      const monitor = new PerformanceMonitor();
      
      // Should not throw when recording metrics without memory API
      expect(() => {
        monitor.recordMemoryMetric(100);
      }).not.toThrow();
      
      // Restore
      global.performance.memory = originalMemory;
      monitor.destroy();
    });

    it('should handle edge case calculations correctly', () => {
      // Test with zero values
      performanceMonitor.recordSearchOperation('hot', '', 0, 0);
      
      const summary = performanceMonitor.getPerformanceSummary(1);
      expect(summary.searchPerformance.avgHotSearchTime).toBe(0);
      expect(summary.searchPerformance.totalSearches).toBe(1);
    });
  });
});