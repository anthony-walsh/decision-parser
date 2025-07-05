/**
 * Unit Tests for MemoryManager TypeScript Service
 * 
 * Testing memory management, cleanup, and resource optimization
 * AIDEV-NOTE: Tests for newly migrated TypeScript MemoryManager service
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { MemoryManager, MEMORY_CONFIG } from '../../../src/services/MemoryManager';

// Mock browser APIs
const mockPerformance = {
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
  }
};

const mockNavigator = {
  deviceMemory: 8
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

Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    PerformanceObserver: vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }))
  },
  writable: true
});

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let consoleLogSpy: MockedFunction<any>;
  let consoleWarnSpy: MockedFunction<any>;

  beforeEach(() => {
    // Create fresh instance for each test
    memoryManager = new MemoryManager();
    
    // Setup console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Cleanup
    memoryManager.destroy();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with browser API support', async () => {
      await memoryManager.initialize();
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.performance.isMonitoring).toBe(true);
      expect(stats.performance.hasMemoryAPI).toBe(true);
    });

    it('should handle missing memory API gracefully', async () => {
      // Temporarily remove memory API
      const originalMemory = global.performance.memory;
      delete (global.performance as any).memory;
      delete (global.navigator as any).deviceMemory;
      
      const manager = new MemoryManager();
      await manager.initialize();
      
      const stats = manager.getMemoryStats();
      expect(stats.performance.hasMemoryAPI).toBe(false);
      
      // Restore
      global.performance.memory = originalMemory;
      global.navigator.deviceMemory = 8;
      
      manager.destroy();
    });
  });

  describe('Memory Measurement', () => {
    it('should get current memory usage from performance.memory', () => {
      const usage = memoryManager.getCurrentMemoryUsage();
      expect(usage).toBe(50); // 50MB from mock
    });

    it('should estimate memory usage when performance.memory unavailable', () => {
      // Remove performance.memory
      const originalMemory = global.performance.memory;
      delete (global.performance as any).memory;
      
      const manager = new MemoryManager();
      const usage = manager.getCurrentMemoryUsage();
      
      // Should fallback to estimation (base 50MB + tracked resources)
      expect(usage).toBeGreaterThanOrEqual(50);
      
      // Restore
      global.performance.memory = originalMemory;
      manager.destroy();
    });

    it('should track memory measurements over time', async () => {
      await memoryManager.initialize();
      
      // Trigger multiple measurements
      vi.advanceTimersByTime(6000); // Advance past monitoring interval
      
      const trend = memoryManager.getMemoryTrend(1);
      expect(Array.isArray(trend)).toBe(true);
    });
  });

  describe('Resource Tracking', () => {
    it('should track and untrack resources correctly', () => {
      const resourceId = 'test-resource-1';
      const testData = { content: 'test data' };
      const sizeMB = 5;
      
      // Track resource
      memoryManager.trackResource(resourceId, testData, sizeMB);
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.resources.tracked).toBe(1);
      
      // Access resource
      const retrievedData = memoryManager.accessResource(resourceId);
      expect(retrievedData).toBe(testData);
      
      // Untrack resource
      const untracked = memoryManager.untrackResource(resourceId);
      expect(untracked).toBe(true);
      
      const updatedStats = memoryManager.getMemoryStats();
      expect(updatedStats.resources.tracked).toBe(0);
    });

    it('should track decrypted batches with size limits', () => {
      const batchId1 = 'batch-1';
      const batchId2 = 'batch-2';
      const batchId3 = 'batch-3';
      const batchId4 = 'batch-4';
      
      // Track batches up to the limit
      memoryManager.trackDecryptedBatch(batchId1, { data: '1' }, 10);
      memoryManager.trackDecryptedBatch(batchId2, { data: '2' }, 15);
      memoryManager.trackDecryptedBatch(batchId3, { data: '3' }, 20);
      
      let stats = memoryManager.getMemoryStats();
      expect(stats.resources.decryptedBatches).toBe(3);
      
      // Track one more batch - should trigger cleanup of oldest
      memoryManager.trackDecryptedBatch(batchId4, { data: '4' }, 25);
      
      stats = memoryManager.getMemoryStats();
      expect(stats.resources.decryptedBatches).toBe(MEMORY_CONFIG.MAX_CONCURRENT_BATCHES);
    });

    it('should update access times when accessing resources', () => {
      const resourceId = 'access-test';
      const testData = { content: 'test' };
      
      memoryManager.trackResource(resourceId, testData, 1);
      
      // Access resource twice with time gap
      const firstAccess = memoryManager.accessResource(resourceId);
      expect(firstAccess).toBe(testData);
      
      // Advance time
      vi.advanceTimersByTime(1000);
      
      const secondAccess = memoryManager.accessResource(resourceId);
      expect(secondAccess).toBe(testData);
    });
  });

  describe('Memory Cleanup', () => {
    it('should perform light cleanup when memory threshold reached', async () => {
      await memoryManager.initialize();
      
      // Track multiple resources
      for (let i = 0; i < 10; i++) {
        memoryManager.trackResource(`resource-${i}`, { data: i }, 5);
      }
      
      // Perform light cleanup
      await memoryManager.performLightCleanup();
      
      const stats = memoryManager.getMemoryStats();
      // Should have removed ~25% of resources (light cleanup)
      expect(stats.resources.tracked).toBeLessThan(10);
    });

    it('should perform force cleanup removing all resources', async () => {
      await memoryManager.initialize();
      
      // Track resources and batches
      memoryManager.trackResource('resource-1', { data: 'test' }, 5);
      memoryManager.trackResource('resource-2', { data: 'test' }, 5);
      memoryManager.trackDecryptedBatch('batch-1', { data: 'test' }, 10);
      memoryManager.trackDecryptedBatch('batch-2', { data: 'test' }, 10);
      
      // Force cleanup
      await memoryManager.forceCleanup();
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.resources.tracked).toBe(0);
      expect(stats.resources.decryptedBatches).toBeLessThanOrEqual(1); // Keeps most recent
    });

    it('should trigger cleanup automatically when thresholds exceeded', async () => {
      // Mock high memory usage
      global.performance.memory.usedJSHeapSize = MEMORY_CONFIG.CRITICAL_THRESHOLD * 1024 * 1024 + 1000000;
      
      await memoryManager.initialize();
      
      // Track a resource
      memoryManager.trackResource('test-resource', { data: 'test' }, 5);
      
      // Trigger memory check
      vi.advanceTimersByTime(MEMORY_CONFIG.MONITORING_INTERVAL + 100);
      
      // Should have triggered cleanup due to high memory
      const stats = memoryManager.getMemoryStats();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Critical memory usage'));
    });
  });

  describe('Event Listeners', () => {
    it('should register and notify cleanup listeners', async () => {
      await memoryManager.initialize();
      
      const cleanupListener = vi.fn();
      const unsubscribe = memoryManager.onCleanup(cleanupListener);
      
      // Force cleanup to trigger event
      await memoryManager.forceCleanup();
      
      expect(cleanupListener).toHaveBeenCalledWith({
        type: 'cleanup',
        memoryFreed: expect.any(Number),
        timestamp: expect.any(Date),
        currentMemory: expect.any(Number)
      });
      
      // Test unsubscribe
      unsubscribe();
      cleanupListener.mockClear();
      
      await memoryManager.forceCleanup();
      expect(cleanupListener).not.toHaveBeenCalled();
    });

    it('should register and notify warning listeners', async () => {
      await memoryManager.initialize();
      
      const warningListener = vi.fn();
      memoryManager.onMemoryWarning(warningListener);
      
      // Mock high memory usage to trigger warning
      global.performance.memory.usedJSHeapSize = MEMORY_CONFIG.WARNING_THRESHOLD * 1024 * 1024 + 1000000;
      
      // Trigger memory check
      vi.advanceTimersByTime(MEMORY_CONFIG.MONITORING_INTERVAL + 100);
      
      expect(warningListener).toHaveBeenCalledWith({
        type: 'warning',
        currentMemory: expect.any(Number),
        threshold: MEMORY_CONFIG.WARNING_THRESHOLD,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Memory Statistics', () => {
    it('should provide comprehensive memory statistics', async () => {
      await memoryManager.initialize();
      
      // Add some tracked resources
      memoryManager.trackResource('resource-1', { data: 'test' }, 5);
      memoryManager.trackDecryptedBatch('batch-1', { data: 'test' }, 10);
      
      const stats = memoryManager.getMemoryStats();
      
      expect(stats).toEqual({
        current: expect.any(Number),
        peak: expect.any(Number),
        lastMeasured: expect.any(Date),
        thresholds: {
          warning: MEMORY_CONFIG.WARNING_THRESHOLD,
          critical: MEMORY_CONFIG.CRITICAL_THRESHOLD,
          target: MEMORY_CONFIG.CLEANUP_TARGET
        },
        resources: {
          tracked: 1,
          decryptedBatches: 1,
          activeOperations: 0
        },
        performance: {
          cleanupOperations: expect.any(Number),
          forcedCleanups: expect.any(Number),
          gcForced: expect.any(Number),
          avgCleanupTime: expect.any(Number),
          isMonitoring: true,
          hasMemoryAPI: true
        }
      });
    });

    it('should track memory trends over time', async () => {
      await memoryManager.initialize();
      
      // Simulate multiple measurements
      vi.advanceTimersByTime(MEMORY_CONFIG.MONITORING_INTERVAL);
      vi.advanceTimersByTime(MEMORY_CONFIG.MONITORING_INTERVAL);
      vi.advanceTimersByTime(MEMORY_CONFIG.MONITORING_INTERVAL);
      
      const trend = memoryManager.getMemoryTrend(5);
      expect(Array.isArray(trend)).toBe(true);
      expect(trend.length).toBeGreaterThan(0);
      
      if (trend.length > 0) {
        expect(trend[0]).toEqual({
          value: expect.any(Number),
          timestamp: expect.any(Date)
        });
      }
    });
  });

  describe('Secure Data Wiping', () => {
    it('should securely wipe arrays', () => {
      const testArray = [1, 2, 3, 4, 5];
      memoryManager.trackResource('array-test', testArray, 1);
      
      memoryManager.untrackResource('array-test');
      
      // Array should be cleared
      expect(testArray.length).toBe(0);
    });

    it('should securely wipe objects', () => {
      const testObject = { prop1: 'value1', prop2: 'value2' };
      memoryManager.trackResource('object-test', testObject, 1);
      
      memoryManager.untrackResource('object-test');
      
      // Object properties should be deleted
      expect(Object.keys(testObject).length).toBe(0);
    });

    it('should handle ArrayBuffer wiping', () => {
      const buffer = new ArrayBuffer(1024);
      const view = new Uint8Array(buffer);
      view.fill(255); // Fill with non-zero values
      
      memoryManager.trackResource('buffer-test', buffer, 1);
      memoryManager.untrackResource('buffer-test');
      
      // Buffer should be zeroed
      expect(view.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Configuration and Cleanup', () => {
    it('should respect configuration constants', () => {
      expect(MEMORY_CONFIG.WARNING_THRESHOLD).toBe(200);
      expect(MEMORY_CONFIG.CRITICAL_THRESHOLD).toBe(300);
      expect(MEMORY_CONFIG.CLEANUP_TARGET).toBe(150);
      expect(MEMORY_CONFIG.MAX_CONCURRENT_BATCHES).toBe(3);
    });

    it('should stop monitoring and cleanup on destroy', async () => {
      await memoryManager.initialize();
      
      // Add resources
      memoryManager.trackResource('test', { data: 'test' }, 1);
      
      memoryManager.destroy();
      
      const stats = memoryManager.getMemoryStats();
      expect(stats.performance.isMonitoring).toBe(false);
      expect(stats.resources.tracked).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle listener errors gracefully', async () => {
      await memoryManager.initialize();
      
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      memoryManager.onCleanup(faultyListener);
      
      // Should not throw even with faulty listener
      await expect(memoryManager.forceCleanup()).resolves.not.toThrow();
      
      expect(faultyListener).toHaveBeenCalled();
    });

    it('should handle secure wipe errors gracefully', () => {
      const malformedObject = Object.create(null);
      Object.defineProperty(malformedObject, 'prop', {
        value: 'test',
        configurable: false,
        enumerable: true
      });
      
      // Should not throw even with non-deletable properties
      expect(() => {
        memoryManager.trackResource('malformed', malformedObject, 1);
        memoryManager.untrackResource('malformed');
      }).not.toThrow();
    });
  });
});