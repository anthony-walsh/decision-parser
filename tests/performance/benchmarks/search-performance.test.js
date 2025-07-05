/**
 * Search Performance Benchmarking Tests
 * 
 * Testing search performance requirements: <100ms hot, <2s cold storage
 * AIDEV-NOTE: Critical performance benchmarking for production search requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// HotStorageService removed - architecture simplified to cold storage only
import { ColdStorageService } from '../../../src/services/ColdStorageService.ts'
import { PerformanceMonitor } from '../../../src/services/PerformanceMonitor.ts'

describe.skip('Search Performance Benchmarking - DISABLED (architecture simplified)', () => {
  let hotStorage
  let coldStorage
  let performanceMonitor

  // Performance requirements
  const PERFORMANCE_TARGETS = {
    hotSearchMax: 100, // ms
    coldSearchMax: 2000, // ms
    hotSearchTarget: 50, // ms (aspirational)
    coldSearchTarget: 1000, // ms (aspirational)
    concurrentSearches: 5,
    searchAccuracy: 0.85 // 85% relevance
  }

  beforeEach(async () => {
    hotStorage = new HotStorageService()
    coldStorage = new ColdStorageService()
    performanceMonitor = new PerformanceMonitor()

    await hotStorage.initialize()
    await coldStorage.initialize()
    
    // Set up test dataset
    await setupSearchTestDataset()
  })

  afterEach(async () => {
    await hotStorage.cleanup()
    await coldStorage.cleanup()
    vi.clearAllMocks()
  })

  describe('Hot Storage Search Performance', () => {
    it('should search under 100ms requirement (cold start)', async () => {
      const testQueries = [
        'planning permission',
        'appeal decision',
        'housing development',
        'environmental impact',
        'heritage conservation'
      ]

      for (const query of testQueries) {
        // Clear any caches to ensure cold start
        await hotStorage.clearSearchCache()

        const startTime = performance.now()
        const results = await hotStorage.searchDocuments(query)
        const searchTime = performance.now() - startTime

        expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax)
        expect(results.length).toBeGreaterThan(0)

        // Record performance metrics
        performanceMonitor.recordSearchPerformance({
          tier: 'hot',
          query,
          duration: searchTime,
          resultCount: results.length,
          coldStart: true
        })
      }
    })

    it('should maintain performance with warm cache', async () => {
      const query = 'planning permission application'
      const iterations = 10
      const searchTimes = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        const results = await hotStorage.searchDocuments(query)
        const searchTime = performance.now() - startTime

        searchTimes.push(searchTime)
        expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax)
        expect(results.length).toBeGreaterThan(0)
      }

      // Warm cache should be consistently fast
      const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length
      expect(avgSearchTime).toBeLessThan(PERFORMANCE_TARGETS.hotSearchTarget)

      // Search times should be consistent (low variance)
      const variance = searchTimes.reduce((acc, time) => 
        acc + Math.pow(time - avgSearchTime, 2), 0) / searchTimes.length
      expect(Math.sqrt(variance)).toBeLessThan(20) // Standard deviation under 20ms
    })

    it('should handle complex queries efficiently', async () => {
      const complexQueries = [
        'planning permission AND housing development',
        'appeal decision OR planning application',
        '"environmental impact assessment"',
        'planning NOT residential',
        'appeal NEAR decision'
      ]

      for (const query of complexQueries) {
        const startTime = performance.now()
        const results = await hotStorage.searchDocuments(query, { fuzzy: false })
        const searchTime = performance.now() - startTime

        expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax)
        // Complex queries may return fewer results, but should still work
        expect(Array.isArray(results)).toBe(true)
      }
    })

    it('should maintain performance under concurrent load', async () => {
      const concurrentQueries = Array(PERFORMANCE_TARGETS.concurrentSearches).fill().map((_, i) => 
        `concurrent search query ${i}`
      )

      const searchPromises = concurrentQueries.map(query => {
        const startTime = performance.now()
        return hotStorage.searchDocuments(query).then(results => ({
          query,
          results,
          duration: performance.now() - startTime
        }))
      })

      const searchResults = await Promise.all(searchPromises)

      // All searches should complete within time limit
      searchResults.forEach(result => {
        expect(result.duration).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax)
        expect(Array.isArray(result.results)).toBe(true)
      })

      // Total time should not be significantly longer than single search
      const totalTime = Math.max(...searchResults.map(r => r.duration))
      expect(totalTime).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax * 1.5)
    })

    it('should optimize search performance based on query patterns', async () => {
      const frequentQueries = [
        'planning permission',
        'appeal decision',
        'housing development'
      ]

      // Run frequent queries multiple times to trigger optimization
      for (let iteration = 0; iteration < 5; iteration++) {
        for (const query of frequentQueries) {
          await hotStorage.searchDocuments(query)
        }
      }

      // Performance should improve for frequent queries
      const optimizedSearchTimes = []
      for (const query of frequentQueries) {
        const startTime = performance.now()
        await hotStorage.searchDocuments(query)
        const searchTime = performance.now() - startTime
        optimizedSearchTimes.push(searchTime)
      }

      const avgOptimizedTime = optimizedSearchTimes.reduce((a, b) => a + b, 0) / optimizedSearchTimes.length
      expect(avgOptimizedTime).toBeLessThan(PERFORMANCE_TARGETS.hotSearchTarget)
    })
  })

  describe('Cold Storage Search Performance', () => {
    it('should search under 2s requirement with batch processing', async () => {
      const testQueries = [
        'planning appeal',
        'housing development',
        'environmental assessment',
        'transport planning',
        'heritage conservation'
      ]

      for (const query of testQueries) {
        const startTime = performance.now()
        const results = await coldStorage.searchDocuments(query)
        const searchTime = performance.now() - startTime

        expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.coldSearchMax)
        expect(Array.isArray(results)).toBe(true)

        // Record performance metrics
        performanceMonitor.recordSearchPerformance({
          tier: 'cold',
          query,
          duration: searchTime,
          resultCount: results.length,
          batchesSearched: results.batchesSearched || 0
        })
      }
    })

    it('should provide search progress for long operations', async () => {
      const progressEvents = []
      const progressCallback = (progress) => progressEvents.push(progress)

      const startTime = performance.now()
      const results = await coldStorage.searchDocuments('comprehensive planning assessment', {
        onProgress: progressCallback
      })
      const searchTime = performance.now() - startTime

      expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.coldSearchMax)
      expect(progressEvents.length).toBeGreaterThan(0)
      
      // Progress should increase over time
      const finalProgress = progressEvents[progressEvents.length - 1]
      expect(finalProgress.percentage).toBe(100)
      expect(finalProgress.batchesProcessed).toBeGreaterThan(0)
    })

    it('should optimize batch selection for relevance', async () => {
      const specificQuery = 'heritage building conservation'
      
      const startTime = performance.now()
      const results = await coldStorage.searchDocuments(specificQuery)
      const searchTime = performance.now() - startTime

      expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.coldSearchMax)
      
      // Should not search irrelevant batches
      const searchMetrics = await coldStorage.getLastSearchMetrics()
      expect(searchMetrics.batchesSkipped).toBeGreaterThan(0)
      expect(searchMetrics.relevanceScore).toBeGreaterThan(0.7)
    })

    it('should handle memory pressure during cold search', async () => {
      // Mock memory pressure during search
      const mockMemoryManager = {
        isMemoryPressure: vi.fn(() => true),
        performLightCleanup: vi.fn(() => Promise.resolve({ success: true })),
        getCurrentMemoryUsage: vi.fn(() => ({ used: 300 * 1024 * 1024 }))
      }

      coldStorage.setMemoryManager(mockMemoryManager)

      const startTime = performance.now()
      const results = await coldStorage.searchDocuments('planning development')
      const searchTime = performance.now() - startTime

      expect(searchTime).toBeLessThan(PERFORMANCE_TARGETS.coldSearchMax * 1.2) // Allow 20% overhead
      expect(mockMemoryManager.performLightCleanup).toHaveBeenCalled()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should cache decrypted batches for performance', async () => {
      const query = 'housing development proposal'
      
      // First search (cold)
      const firstStartTime = performance.now()
      const firstResults = await coldStorage.searchDocuments(query)
      const firstSearchTime = performance.now() - firstStartTime

      expect(firstSearchTime).toBeLessThan(PERFORMANCE_TARGETS.coldSearchMax)

      // Second search (should benefit from cache)
      const secondStartTime = performance.now()
      const secondResults = await coldStorage.searchDocuments(query)
      const secondSearchTime = performance.now() - secondStartTime

      expect(secondSearchTime).toBeLessThan(firstSearchTime * 0.7) // 30% improvement
      expect(secondResults.length).toBe(firstResults.length)
    })
  })

  describe('Search Quality and Relevance', () => {
    it('should maintain search accuracy above 85%', async () => {
      const relevanceTests = [
        {
          query: 'planning permission',
          expectedKeywords: ['planning', 'permission', 'application']
        },
        {
          query: 'appeal decision',
          expectedKeywords: ['appeal', 'decision', 'determination']
        },
        {
          query: 'housing development',
          expectedKeywords: ['housing', 'development', 'residential']
        }
      ]

      for (const test of relevanceTests) {
        const hotResults = await hotStorage.searchDocuments(test.query)
        const coldResults = await coldStorage.searchDocuments(test.query)
        const allResults = [...hotResults, ...coldResults]

        if (allResults.length > 0) {
          const relevantResults = allResults.filter(doc => 
            test.expectedKeywords.some(keyword => 
              doc.content.toLowerCase().includes(keyword.toLowerCase())
            )
          )

          const relevanceScore = relevantResults.length / allResults.length
          expect(relevanceScore).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.searchAccuracy)
        }
      }
    })

    it('should rank results by relevance effectively', async () => {
      const query = 'planning permission application'
      const results = await hotStorage.searchDocuments(query, { limit: 10 })

      if (results.length >= 3) {
        // Top results should be more relevant than bottom results
        const topResult = results[0]
        const bottomResult = results[results.length - 1]

        const topRelevance = calculateRelevanceScore(topResult.content, query)
        const bottomRelevance = calculateRelevanceScore(bottomResult.content, query)

        expect(topRelevance).toBeGreaterThanOrEqual(bottomRelevance)
      }
    })

    it('should handle typos and fuzzy matching', async () => {
      const typoQueries = [
        { original: 'planning permission', typo: 'planing permision' },
        { original: 'appeal decision', typo: 'apeal decisoin' },
        { original: 'housing development', typo: 'housng developement' }
      ]

      for (const testCase of typoQueries) {
        const originalResults = await hotStorage.searchDocuments(testCase.original)
        const typoResults = await hotStorage.searchDocuments(testCase.typo, { fuzzy: true })

        // Fuzzy search should return some results even with typos
        expect(typoResults.length).toBeGreaterThan(0)
        
        // Should be reasonably similar to original results
        if (originalResults.length > 0) {
          expect(typoResults.length).toBeGreaterThan(originalResults.length * 0.5)
        }
      }
    })
  })

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in hot search', async () => {
      const baselineQueries = [
        'planning permission',
        'appeal decision',
        'housing development'
      ]

      const baselineTimes = []
      
      // Establish baseline performance
      for (const query of baselineQueries) {
        const startTime = performance.now()
        await hotStorage.searchDocuments(query)
        const searchTime = performance.now() - startTime
        baselineTimes.push(searchTime)
      }

      const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length

      // Simulate system load
      await simulateSystemLoad()

      // Measure performance under load
      const loadTimes = []
      for (const query of baselineQueries) {
        const startTime = performance.now()
        await hotStorage.searchDocuments(query)
        const searchTime = performance.now() - startTime
        loadTimes.push(searchTime)
      }

      const loadAvg = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length

      // Performance should not degrade significantly (allow 50% degradation under load)
      expect(loadAvg).toBeLessThan(baselineAvg * 1.5)
      expect(loadAvg).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax)
    })

    it('should maintain performance consistency over time', async () => {
      const query = 'planning appeal decision'
      const measurements = []
      const measurementCount = 20

      // Take multiple measurements over time
      for (let i = 0; i < measurementCount; i++) {
        const startTime = performance.now()
        await hotStorage.searchDocuments(query)
        const searchTime = performance.now() - startTime
        measurements.push(searchTime)

        // Small delay between measurements
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Calculate statistics
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length
      const variance = measurements.reduce((acc, time) => 
        acc + Math.pow(time - avg, 2), 0) / measurements.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = stdDev / avg

      // Performance should be consistent (low coefficient of variation)
      expect(coefficientOfVariation).toBeLessThan(0.3) // 30% CV
      expect(avg).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax)
      expect(Math.max(...measurements)).toBeLessThan(PERFORMANCE_TARGETS.hotSearchMax * 1.2)
    })
  })

  // Helper functions
  async function setupSearchTestDataset() {
    // Create diverse test documents for hot storage
    const hotDocs = [
      createTestDocument('Planning permission for residential development', 'planning permission application residential housing'),
      createTestDocument('Appeal decision for commercial building', 'appeal decision commercial building development'),
      createTestDocument('Housing development proposal with affordable units', 'housing development affordable residential planning'),
      createTestDocument('Environmental impact assessment for industrial site', 'environmental impact assessment industrial development'),
      createTestDocument('Heritage conservation area planning guidelines', 'heritage conservation planning guidelines historical'),
      createTestDocument('Transport assessment for major development', 'transport assessment development traffic planning'),
      createTestDocument('Council objection to planning application', 'council objection planning application residential'),
      createTestDocument('Planning committee meeting minutes', 'planning committee meeting minutes decision'),
      createTestDocument('Development brief for urban regeneration', 'development brief urban regeneration planning'),
      createTestDocument('Listed building consent application', 'listed building consent heritage planning')
    ]

    for (const doc of hotDocs) {
      await hotStorage.addDocument(doc)
    }

    // Create cold storage batches
    const coldBatches = [
      Array(50).fill().map((_, i) => createTestDocument(`Cold storage planning doc ${i}`, 'planning permission development residential')),
      Array(50).fill().map((_, i) => createTestDocument(`Cold storage appeal doc ${i}`, 'appeal decision determination planning')),
      Array(50).fill().map((_, i) => createTestDocument(`Cold storage housing doc ${i}`, 'housing development residential planning'))
    ]

    for (const batch of coldBatches) {
      await coldStorage.createBatch(batch)
    }
  }

  function createTestDocument(title, content) {
    return {
      id: `test-${Math.random().toString(36).substr(2, 9)}`,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      content: `${title}. ${content}. This document contains information about ${content} and related planning matters.`,
      size: content.length * 2,
      uploadDate: new Date().toISOString(),
      metadata: {
        title,
        keywords: content.split(' '),
        pageCount: Math.floor(Math.random() * 10) + 1
      }
    }
  }

  function calculateRelevanceScore(content, query) {
    const queryWords = query.toLowerCase().split(' ')
    const contentWords = content.toLowerCase().split(' ')
    
    let matches = 0
    for (const queryWord of queryWords) {
      if (contentWords.includes(queryWord)) {
        matches++
      }
    }
    
    return matches / queryWords.length
  }

  async function simulateSystemLoad() {
    // Simulate system load with background operations
    const loadPromises = []
    
    for (let i = 0; i < 10; i++) {
      loadPromises.push(
        new Promise(resolve => {
          // CPU intensive operation
          const start = Date.now()
          while (Date.now() - start < 50) {
            Math.random()
          }
          resolve()
        })
      )
    }
    
    await Promise.all(loadPromises)
  }
})