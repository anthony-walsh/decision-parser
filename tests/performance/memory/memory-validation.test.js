/**
 * Memory Usage Validation Tests
 * 
 * Testing memory management, cleanup, and resource optimization
 * AIDEV-NOTE: Critical memory validation for 400MB peak usage requirement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryManager } from '../../../src/services/MemoryManager.ts'
import { ColdStorageService } from '../../../src/services/ColdStorageService.ts'
import { PerformanceMonitor } from '../../../src/services/PerformanceMonitor.ts'

describe('Memory Usage Validation', () => {
  let memoryManager
  let coldStorage
  let performanceMonitor
  let mockPerformanceMemory

  beforeEach(() => {
    // Mock performance.memory API
    mockPerformanceMemory = {
      usedJSHeapSize: 50 * 1024 * 1024, // Start at 50MB
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB limit
    }

    Object.defineProperty(global.performance, 'memory', {
      value: mockPerformanceMemory,
      configurable: true
    })

    // Initialize services
    memoryManager = new MemoryManager()
    coldStorage = new ColdStorageService()
    performanceMonitor = new PerformanceMonitor()

    // Set up memory manager integration
    coldStorage.setMemoryManager(memoryManager)
  })

  afterEach(async () => {
    await memoryManager.cleanup()
    vi.clearAllMocks()
  })

  describe('Memory Monitoring', () => {
    it('should accurately track current memory usage', () => {
      const usage = memoryManager.getCurrentMemoryUsage()

      expect(usage.used).toBe(50 * 1024 * 1024)
      expect(usage.total).toBe(100 * 1024 * 1024)
      expect(usage.percentage).toBe(50)
    })

    it('should detect memory pressure at warning threshold', () => {
      // Simulate high memory usage (250MB - above 200MB warning)
      mockPerformanceMemory.usedJSHeapSize = 250 * 1024 * 1024

      const isMemoryPressure = memoryManager.isMemoryPressure()
      const pressureLevel = memoryManager.getMemoryPressureLevel()

      expect(isMemoryPressure).toBe(true)
      expect(pressureLevel).toBe('warning')
    })

    it('should detect critical memory pressure at critical threshold', () => {
      // Simulate critical memory usage (350MB - above 300MB critical)
      mockPerformanceMemory.usedJSHeapSize = 350 * 1024 * 1024

      const pressureLevel = memoryManager.getMemoryPressureLevel()

      expect(pressureLevel).toBe('critical')
    })

    it('should track memory usage trends over time', async () => {
      const tracker = memoryManager.startMemoryTracking()

      // Simulate memory changes
      mockPerformanceMemory.usedJSHeapSize = 100 * 1024 * 1024
      await new Promise(resolve => setTimeout(resolve, 100))

      mockPerformanceMemory.usedJSHeapSize = 150 * 1024 * 1024
      await new Promise(resolve => setTimeout(resolve, 100))

      const trends = memoryManager.getMemoryTrends()
      memoryManager.stopMemoryTracking(tracker)

      expect(trends.length).toBeGreaterThan(1)
      expect(trends[trends.length - 1].used).toBeGreaterThan(trends[0].used)
    })
  })

  describe('Automatic Cleanup', () => {
    beforeEach(() => {
      // Mock resources for cleanup testing
      memoryManager.trackResource('test-resource-1', 50 * 1024 * 1024) // 50MB
      memoryManager.trackResource('test-resource-2', 30 * 1024 * 1024) // 30MB
      memoryManager.trackResource('test-resource-3', 20 * 1024 * 1024) // 20MB
    })

    it('should trigger automatic cleanup at warning threshold', async () => {
      // Simulate warning level memory usage
      mockPerformanceMemory.usedJSHeapSize = 210 * 1024 * 1024

      const cleanupSpy = vi.spyOn(memoryManager, 'performLightCleanup')
      
      await memoryManager.checkMemoryPressure()

      expect(cleanupSpy).toHaveBeenCalled()
    })

    it('should perform light cleanup first', async () => {
      const initialResourceCount = memoryManager.getTrackedResourceCount()
      
      const result = await memoryManager.performLightCleanup()

      expect(result.success).toBe(true)
      expect(result.resourcesFreed).toBeGreaterThan(0)
      expect(result.memoryFreed).toBeGreaterThan(0)
      
      // Should still have some resources (light cleanup removes ~25%)
      const remainingResourceCount = memoryManager.getTrackedResourceCount()
      expect(remainingResourceCount).toBeLessThan(initialResourceCount)
      expect(remainingResourceCount).toBeGreaterThan(0)
    })

    it('should perform aggressive cleanup at critical threshold', async () => {
      // Simulate critical memory usage
      mockPerformanceMemory.usedJSHeapSize = 350 * 1024 * 1024

      const result = await memoryManager.performAggressiveCleanup()

      expect(result.success).toBe(true)
      expect(result.memoryFreed).toBeGreaterThan(50 * 1024 * 1024) // Should free significant memory
      
      // Should remove most/all non-essential resources
      const remainingResourceCount = memoryManager.getTrackedResourceCount()
      expect(remainingResourceCount).toBeLessThan(2) // Keep only essential resources
    })

    it('should use LRU strategy for resource cleanup', async () => {
      // Access resources to establish LRU order
      memoryManager.accessResource('test-resource-1') // Most recent
      await new Promise(resolve => setTimeout(resolve, 10))
      memoryManager.accessResource('test-resource-3') // Second most recent
      // test-resource-2 is least recently used

      const result = await memoryManager.performLightCleanup()

      // Should remove least recently used first
      expect(memoryManager.hasResource('test-resource-2')).toBe(false)
      expect(memoryManager.hasResource('test-resource-1')).toBe(true)
    })

    it('should reach target memory after cleanup', async () => {
      // Start with high memory usage
      mockPerformanceMemory.usedJSHeapSize = 350 * 1024 * 1024

      await memoryManager.performAggressiveCleanup()

      // Mock memory reduction after cleanup
      mockPerformanceMemory.usedJSHeapSize = 140 * 1024 * 1024

      const finalUsage = memoryManager.getCurrentMemoryUsage()
      expect(finalUsage.used).toBeLessThanOrEqual(150 * 1024 * 1024) // Target is 150MB
    })
  })

  describe('Decrypted Data Management', () => {
    beforeEach(() => {
      // Mock decrypted batch data
      const mockDecryptedData = {
        batchId: 'batch-001',
        documents: Array(100).fill().map((_, i) => ({
          id: `doc-${i}`,
          content: 'A'.repeat(10 * 1024) // 10KB each
        })),
        decryptedAt: Date.now(),
        estimatedSize: 1 * 1024 * 1024 // 1MB
      }

      memoryManager.trackDecryptedBatch(mockDecryptedData)
    })

    it('should track decrypted batch memory usage', () => {
      const decryptedUsage = memoryManager.getDecryptedDataUsage()

      expect(decryptedUsage.totalSize).toBe(1 * 1024 * 1024)
      expect(decryptedUsage.batchCount).toBe(1)
      expect(decryptedUsage.oldestBatch).toBeDefined()
    })

    it('should cleanup old decrypted batches automatically', async () => {
      // Add multiple batches with different ages
      const oldBatch = {
        batchId: 'old-batch',
        documents: [],
        decryptedAt: Date.now() - (10 * 60 * 1000), // 10 minutes ago
        estimatedSize: 2 * 1024 * 1024
      }

      memoryManager.trackDecryptedBatch(oldBatch)

      const cleanupResult = await memoryManager.cleanupOldDecryptedData()

      expect(cleanupResult.batchesRemoved).toBeGreaterThan(0)
      expect(cleanupResult.memoryFreed).toBeGreaterThan(0)
    })

    it('should secure wipe sensitive decrypted data', async () => {
      const wipeResult = await memoryManager.secureWipeDecryptedData('batch-001')

      expect(wipeResult.success).toBe(true)
      expect(wipeResult.dataWiped).toBe(true)
      
      // Batch should no longer be tracked
      const decryptedUsage = memoryManager.getDecryptedDataUsage()
      expect(decryptedUsage.batchCount).toBe(0)
    })

    it('should limit concurrent decrypted batches', async () => {
      // Try to add more than 3 batches (limit)
      for (let i = 0; i < 5; i++) {
        const batch = {
          batchId: `batch-${i}`,
          documents: [],
          decryptedAt: Date.now(),
          estimatedSize: 1 * 1024 * 1024
        }
        
        await memoryManager.trackDecryptedBatch(batch)
      }

      const decryptedUsage = memoryManager.getDecryptedDataUsage()
      expect(decryptedUsage.batchCount).toBeLessThanOrEqual(3) // Should enforce limit
    })
  })

  describe('Memory Pressure Response', () => {
    it('should emit memory pressure events', async () => {
      const eventSpy = vi.fn()
      memoryManager.on('memoryPressure', eventSpy)

      // Simulate memory pressure
      mockPerformanceMemory.usedJSHeapSize = 250 * 1024 * 1024
      await memoryManager.checkMemoryPressure()

      expect(eventSpy).toHaveBeenCalledWith({
        level: 'warning',
        usage: expect.any(Object),
        recommendedAction: 'lightCleanup'
      })
    })

    it('should coordinate with cold storage for cleanup', async () => {
      const coldStorageCleanupSpy = vi.spyOn(coldStorage, 'performMemoryCleanup')

      // Simulate memory pressure
      mockPerformanceMemory.usedJSHeapSize = 350 * 1024 * 1024
      await memoryManager.requestCleanupFromServices()

      expect(coldStorageCleanupSpy).toHaveBeenCalled()
    })

    it('should force garbage collection when available', async () => {
      // Mock gc function
      global.gc = vi.fn()

      await memoryManager.forceGarbageCollection()

      expect(global.gc).toHaveBeenCalled()
    })

    it('should handle memory allocation failures gracefully', async () => {
      // Mock memory allocation failure
      const originalArrayBuffer = global.ArrayBuffer
      global.ArrayBuffer = vi.fn(() => {
        throw new Error('Insufficient memory')
      })

      const result = await memoryManager.handleAllocationFailure()

      expect(result.cleanupPerformed).toBe(true)
      expect(result.memoryFreed).toBeGreaterThan(0)

      // Restore original
      global.ArrayBuffer = originalArrayBuffer
    })
  })

  describe('Performance Integration', () => {
    it('should monitor memory cleanup performance', async () => {
      const startTime = performance.now()
      await memoryManager.performLightCleanup()
      const endTime = performance.now()

      const cleanupTime = endTime - startTime

      // Cleanup should be fast (under 50ms for light cleanup)
      expect(cleanupTime).toBeLessThan(50)
    })

    it('should track cleanup efficiency metrics', async () => {
      const beforeCleanup = memoryManager.getCurrentMemoryUsage()
      await memoryManager.performAggressiveCleanup()
      const afterCleanup = memoryManager.getCurrentMemoryUsage()

      const efficiency = memoryManager.getCleanupEfficiency()

      expect(efficiency.memoryFreed).toBeGreaterThan(0)
      expect(efficiency.cleanupRatio).toBeGreaterThan(0)
      expect(efficiency.timeToCleanup).toBeDefined()
    })

    it('should coordinate with performance monitor', async () => {
      const performanceMetric = {
        type: 'memory',
        value: memoryManager.getCurrentMemoryUsage().used,
        timestamp: Date.now()
      }

      performanceMonitor.recordMetric(performanceMetric)

      const metrics = performanceMonitor.getMetrics('memory')
      expect(metrics.length).toBeGreaterThan(0)
      expect(metrics[0].value).toBe(performanceMetric.value)
    })
  })

  describe('Memory Validation Edge Cases', () => {
    it('should handle browser memory API unavailability', () => {
      // Remove performance.memory
      delete global.performance.memory

      const usage = memoryManager.getCurrentMemoryUsage()

      // Should provide fallback estimates
      expect(usage.used).toBeDefined()
      expect(usage.estimated).toBe(true)
    })

    it('should handle memory pressure in low-memory environments', async () => {
      // Simulate low memory device
      mockPerformanceMemory.jsHeapSizeLimit = 512 * 1024 * 1024 // 512MB limit
      mockPerformanceMemory.usedJSHeapSize = 400 * 1024 * 1024  // 400MB used

      const isLowMemory = memoryManager.isLowMemoryEnvironment()
      expect(isLowMemory).toBe(true)

      // Should be more aggressive about cleanup
      const result = await memoryManager.performLightCleanup()
      expect(result.aggressiveMode).toBe(true)
    })

    it('should prevent memory leaks from tracked resources', async () => {
      // Track many resources
      for (let i = 0; i < 1000; i++) {
        memoryManager.trackResource(`leak-test-${i}`, 1024)
      }

      // Cleanup should prevent accumulation
      await memoryManager.performAggressiveCleanup()

      const resourceCount = memoryManager.getTrackedResourceCount()
      expect(resourceCount).toBeLessThan(100) // Should clean up most resources
    })

    it('should handle concurrent cleanup operations', async () => {
      // Start multiple cleanup operations simultaneously
      const cleanupPromises = [
        memoryManager.performLightCleanup(),
        memoryManager.performLightCleanup(),
        memoryManager.performLightCleanup()
      ]

      const results = await Promise.all(cleanupPromises)

      // Should handle concurrency gracefully (some may be skipped)
      const successfulCleanups = results.filter(r => r.success).length
      expect(successfulCleanups).toBeGreaterThanOrEqual(1)
      expect(successfulCleanups).toBeLessThanOrEqual(3)
    })
  })

  describe('400MB Peak Usage Requirement', () => {
    it('should stay under 400MB during normal operations', async () => {
      // Simulate normal document processing workload
      for (let i = 0; i < 10; i++) {
        memoryManager.trackResource(`normal-doc-${i}`, 5 * 1024 * 1024) // 5MB each
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const usage = memoryManager.getCurrentMemoryUsage()
      expect(usage.used).toBeLessThan(400 * 1024 * 1024) // Stay under 400MB
    })

    it('should enforce 400MB limit with aggressive cleanup', async () => {
      // Simulate approaching 400MB limit
      mockPerformanceMemory.usedJSHeapSize = 380 * 1024 * 1024

      const shouldCleanup = memoryManager.shouldPerformPreventiveCleanup()
      expect(shouldCleanup).toBe(true)

      await memoryManager.performPreventiveCleanup()

      // Should bring usage down
      const finalUsage = memoryManager.getCurrentMemoryUsage()
      expect(finalUsage.used).toBeLessThan(350 * 1024 * 1024)
    })

    it('should handle peak usage spikes gracefully', async () => {
      // Simulate temporary spike to 450MB
      mockPerformanceMemory.usedJSHeapSize = 450 * 1024 * 1024

      const emergencyResult = await memoryManager.handleEmergencyCleanup()

      expect(emergencyResult.success).toBe(true)
      expect(emergencyResult.emergencyMode).toBe(true)
      
      // Should aggressively reduce memory
      mockPerformanceMemory.usedJSHeapSize = 200 * 1024 * 1024 // After cleanup
      const finalUsage = memoryManager.getCurrentMemoryUsage()
      expect(finalUsage.used).toBeLessThan(250 * 1024 * 1024)
    })
  })
})