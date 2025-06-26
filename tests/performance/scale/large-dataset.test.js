/**
 * Large Dataset Scale Testing
 * 
 * Testing system performance with 100,000+ documents across storage tiers
 * AIDEV-NOTE: Critical scale validation for production document volumes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HotStorageService } from '../../../src/services/HotStorageService.js'
import { ColdStorageService } from '../../../src/services/ColdStorageService.js'
import { DocumentTierManager } from '../../../src/services/DocumentTierManager.js'
import { MemoryManager } from '../../../src/services/MemoryManager.js'

describe('Large Dataset Scale Testing', () => {
  let hotStorage
  let coldStorage
  let tierManager
  let memoryManager

  // Test configuration
  const SCALE_TEST_CONFIG = {
    hotStorageLimit: 5000,
    totalDocuments: 100000,
    batchSize: 1000,
    maxMemoryUsage: 400 * 1024 * 1024, // 400MB
    searchTimeoutHot: 100, // ms
    searchTimeoutCold: 2000 // ms
  }

  beforeEach(async () => {
    // Initialize services
    hotStorage = new HotStorageService()
    coldStorage = new ColdStorageService()
    memoryManager = new MemoryManager()
    tierManager = new DocumentTierManager(hotStorage, coldStorage)

    // Configure for scale testing
    await hotStorage.initialize({ maxDocuments: SCALE_TEST_CONFIG.hotStorageLimit })
    await coldStorage.initialize()
    
    // Set up memory management
    tierManager.setMemoryManager(memoryManager)
  })

  afterEach(async () => {
    await hotStorage.cleanup()
    await coldStorage.cleanup()
    await memoryManager.cleanup()
    vi.clearAllMocks()
  })

  describe('100,000+ Document Scale', () => {
    it('should handle 100,000 documents across storage tiers', async () => {
      const totalDocs = SCALE_TEST_CONFIG.totalDocuments
      const batchSize = SCALE_TEST_CONFIG.batchSize
      let processedCount = 0

      console.log(`Starting scale test with ${totalDocs} documents...`)

      const startTime = performance.now()

      // Process documents in batches to avoid memory issues
      for (let batchStart = 0; batchStart < totalDocs; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, totalDocs)
        const batch = []

        // Generate batch of documents
        for (let i = batchStart; i < batchEnd; i++) {
          batch.push(generateScaleTestDocument(i))
        }

        // Add to appropriate storage tier
        if (processedCount < SCALE_TEST_CONFIG.hotStorageLimit) {
          // Add to hot storage
          const hotResults = await hotStorage.addDocumentBatch(batch)
          expect(hotResults.success).toBe(true)
        } else {
          // Add to cold storage
          const coldResults = await coldStorage.createBatch(batch)
          expect(coldResults.success).toBe(true)
        }

        processedCount += batch.length

        // Memory pressure check
        const memoryUsage = memoryManager.getCurrentMemoryUsage()
        if (memoryUsage.used > SCALE_TEST_CONFIG.maxMemoryUsage * 0.8) {
          await memoryManager.performLightCleanup()
        }

        // Progress logging
        if (processedCount % 10000 === 0) {
          console.log(`Processed ${processedCount}/${totalDocs} documents...`)
        }
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      console.log(`Scale test completed in ${totalTime}ms`)

      // Validate final state
      const hotCount = await hotStorage.getDocumentCount()
      const coldBatches = await coldStorage.getBatchCount()
      
      expect(hotCount).toBe(SCALE_TEST_CONFIG.hotStorageLimit)
      expect(coldBatches).toBeGreaterThan(90) // ~95 batches for 95k documents
      expect(processedCount).toBe(totalDocs)

      // Performance validation
      expect(totalTime).toBeLessThan(10 * 60 * 1000) // Should complete within 10 minutes
    }, 15 * 60 * 1000) // 15 minute timeout

    it('should maintain search performance with large dataset', async () => {
      // Set up representative dataset
      await setupMediumScaleDataset() // 10k documents for manageable test time

      const searchQueries = [
        'planning permission',
        'appeal decision',
        'housing development',
        'environmental impact',
        'council objection'
      ]

      for (const query of searchQueries) {
        // Test hot storage search performance
        const hotStartTime = performance.now()
        const hotResults = await hotStorage.searchDocuments(query)
        const hotSearchTime = performance.now() - hotStartTime

        expect(hotSearchTime).toBeLessThan(SCALE_TEST_CONFIG.searchTimeoutHot)
        expect(hotResults.length).toBeGreaterThan(0)

        // Test cold storage search performance
        const coldStartTime = performance.now()
        const coldResults = await coldStorage.searchDocuments(query)
        const coldSearchTime = performance.now() - coldStartTime

        expect(coldSearchTime).toBeLessThan(SCALE_TEST_CONFIG.searchTimeoutCold)
        expect(Array.isArray(coldResults)).toBe(true)
      }
    })

    it('should handle concurrent operations at scale', async () => {
      await setupMediumScaleDataset()

      const concurrentOperations = [
        // Multiple searches
        hotStorage.searchDocuments('planning'),
        hotStorage.searchDocuments('appeal'),
        coldStorage.searchDocuments('development'),
        
        // Document access
        hotStorage.getDocument('doc-1000'),
        hotStorage.getDocument('doc-2000'),
        
        // Batch operations
        coldStorage.getBatch('batch-005'),
        
        // Memory operations
        memoryManager.checkMemoryPressure(),
        
        // Tier management
        tierManager.getMigrationCandidates()
      ]

      const startTime = performance.now()
      const results = await Promise.all(concurrentOperations)
      const totalTime = performance.now() - startTime

      // All operations should complete successfully
      expect(results.every(result => result !== null && result !== undefined)).toBe(true)
      expect(totalTime).toBeLessThan(3000) // All operations within 3 seconds
    })
  })

  describe('Memory Management at Scale', () => {
    it('should maintain memory limits during batch processing', async () => {
      const batchSizes = [100, 500, 1000, 2000]
      
      for (const batchSize of batchSizes) {
        const memoryBefore = memoryManager.getCurrentMemoryUsage()
        
        // Process large batch
        const batch = Array(batchSize).fill().map((_, i) => 
          generateScaleTestDocument(i, { largeContent: true })
        )

        await coldStorage.createBatch(batch)

        const memoryAfter = memoryManager.getCurrentMemoryUsage()
        const memoryIncrease = memoryAfter.used - memoryBefore.used

        // Memory increase should be reasonable and temporary
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase

        // Cleanup should bring memory back down
        await memoryManager.performLightCleanup()
        await new Promise(resolve => setTimeout(resolve, 100)) // Allow cleanup

        const memoryFinal = memoryManager.getCurrentMemoryUsage()
        expect(memoryFinal.used).toBeLessThan(memoryAfter.used)
      }
    })

    it('should handle memory pressure with automatic tier migration', async () => {
      // Fill hot storage to capacity
      const hotDocs = Array(SCALE_TEST_CONFIG.hotStorageLimit).fill().map((_, i) => 
        generateScaleTestDocument(i)
      )
      await hotStorage.addDocumentBatch(hotDocs)

      // Simulate memory pressure
      const mockHighMemory = vi.spyOn(memoryManager, 'getCurrentMemoryUsage').mockReturnValue({
        used: 350 * 1024 * 1024, // 350MB
        total: 400 * 1024 * 1024,
        percentage: 87.5
      })

      // Try to add more documents
      const newDoc = generateScaleTestDocument(SCALE_TEST_CONFIG.hotStorageLimit + 1)
      const result = await tierManager.addDocument(newDoc)

      // Should trigger migration
      expect(result.migrationTriggered).toBe(true)
      expect(result.tier).toBe('cold') // New doc should go to cold storage

      mockHighMemory.mockRestore()
    })

    it('should optimize batch organization for search performance', async () => {
      // Create documents with different themes for batch optimization testing
      const themes = ['planning', 'housing', 'transport', 'environment', 'heritage']
      const docsPerTheme = 1000

      for (const theme of themes) {
        const themeDocs = Array(docsPerTheme).fill().map((_, i) => 
          generateScaleTestDocument(i, { theme })
        )

        const batchResult = await coldStorage.createBatch(themeDocs)
        expect(batchResult.success).toBe(true)
        
        // Batch should be optimized for the theme
        expect(batchResult.metadata.keywords).toContain(theme)
        expect(batchResult.metadata.optimizedFor).toBe('search')
      }

      // Search within theme should be efficient
      const searchStartTime = performance.now()
      const planningResults = await coldStorage.searchDocuments('planning permission')
      const searchTime = performance.now() - searchStartTime

      expect(searchTime).toBeLessThan(1500) // Optimized search should be fast
      expect(planningResults.length).toBeGreaterThan(0)
    })
  })

  describe('Storage Tier Performance', () => {
    it('should maintain hot storage performance with 5,000 documents', async () => {
      // Fill hot storage to capacity
      const docs = Array(SCALE_TEST_CONFIG.hotStorageLimit).fill().map((_, i) => 
        generateScaleTestDocument(i)
      )

      const insertStartTime = performance.now()
      const result = await hotStorage.addDocumentBatch(docs)
      const insertTime = performance.now() - insertStartTime

      expect(result.success).toBe(true)
      expect(insertTime).toBeLessThan(30000) // 30 seconds for 5k documents

      // Search performance should remain good
      const searchStartTime = performance.now()
      const searchResults = await hotStorage.searchDocuments('test document')
      const searchTime = performance.now() - searchStartTime

      expect(searchTime).toBeLessThan(100) // Under 100ms requirement
      expect(searchResults.length).toBeGreaterThan(0)
    })

    it('should handle cold storage batch creation at scale', async () => {
      const largeBatchSizes = [500, 1000, 1500] // Different batch sizes
      
      for (const batchSize of largeBatchSizes) {
        const docs = Array(batchSize).fill().map((_, i) => 
          generateScaleTestDocument(i, { size: 'large' })
        )

        const batchStartTime = performance.now()
        const batchResult = await coldStorage.createBatch(docs)
        const batchTime = performance.now() - batchStartTime

        expect(batchResult.success).toBe(true)
        expect(batchTime).toBeLessThan(10000) // Under 10 seconds per batch
        
        // Batch should be under size limit (15MB)
        expect(batchResult.metadata.size).toBeLessThan(15 * 1024 * 1024)
      }
    })

    it('should maintain search relevance at scale', async () => {
      await setupMediumScaleDataset()

      const testQueries = [
        { query: 'planning permission', expectedMinResults: 50 },
        { query: 'appeal decision', expectedMinResults: 30 },
        { query: 'housing development', expectedMinResults: 40 },
        { query: 'environmental assessment', expectedMinResults: 20 }
      ]

      for (const testCase of testQueries) {
        const hotResults = await hotStorage.searchDocuments(testCase.query)
        const coldResults = await coldStorage.searchDocuments(testCase.query)

        const totalResults = hotResults.length + coldResults.length
        expect(totalResults).toBeGreaterThanOrEqual(testCase.expectedMinResults)

        // Results should be relevant (basic relevance check)
        const relevantHotResults = hotResults.filter(doc => 
          doc.content.toLowerCase().includes(testCase.query.split(' ')[0])
        )
        expect(relevantHotResults.length / hotResults.length).toBeGreaterThan(0.8) // 80% relevance
      }
    })
  })

  describe('Error Handling at Scale', () => {
    it('should handle batch failures gracefully', async () => {
      const largeBatch = Array(2000).fill().map((_, i) => 
        generateScaleTestDocument(i, { size: 'oversized' }) // Intentionally large
      )

      const batchResult = await coldStorage.createBatch(largeBatch)
      
      // Should handle oversized batch appropriately
      if (!batchResult.success) {
        expect(batchResult.error).toContain('size limit')
        expect(batchResult.suggestedSplit).toBeDefined()
      } else {
        // If successful, should be split into multiple batches
        expect(batchResult.batchesSplit).toBeGreaterThan(1)
      }
    })

    it('should recover from storage corruption at scale', async () => {
      await setupMediumScaleDataset()

      // Simulate corruption in hot storage
      const corruptionResult = await hotStorage.simulateCorruption()
      expect(corruptionResult.corrupted).toBe(true)

      // Recovery should work
      const recoveryResult = await hotStorage.recoverFromCorruption()
      expect(recoveryResult.success).toBe(true)
      expect(recoveryResult.documentsRecovered).toBeGreaterThan(0)

      // System should still be functional
      const searchResults = await hotStorage.searchDocuments('test')
      expect(Array.isArray(searchResults)).toBe(true)
    })

    it('should handle network failures during cold storage operations', async () => {
      // Mock network failures
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'))

      const searchResult = await coldStorage.searchDocuments('planning')
      
      // Should handle gracefully
      expect(searchResult).toEqual([])
      
      // Restore fetch
      global.fetch = originalFetch
    })
  })

  // Helper functions
  function generateScaleTestDocument(index, options = {}) {
    const {
      theme = 'general',
      size = 'normal',
      largeContent = false
    } = options

    const themes = {
      planning: 'planning permission application for residential development',
      housing: 'housing development proposal with affordable housing provision',
      transport: 'transport assessment for major development scheme',
      environment: 'environmental impact assessment for industrial facility',
      heritage: 'heritage statement for conservation area development',
      general: 'planning appeal decision document with various considerations'
    }

    const baseContent = themes[theme] || themes.general
    const contentMultiplier = largeContent ? 100 : (size === 'large' ? 10 : 1)
    const content = baseContent.repeat(contentMultiplier)

    return {
      id: `scale-doc-${index}`,
      filename: `document-${index}.pdf`,
      content: content + ` Document ${index} with unique identifier ${Math.random()}`,
      size: content.length,
      uploadDate: new Date(2024, 0, 1 + (index % 365)).toISOString(),
      metadata: {
        pageCount: Math.floor(Math.random() * 20) + 1,
        theme: theme,
        index: index,
        keywords: [theme, 'document', 'test', `doc-${index}`]
      },
      lastAccessed: new Date().toISOString(),
      accessCount: Math.floor(Math.random() * 10)
    }
  }

  async function setupMediumScaleDataset() {
    const hotDocs = Array(1000).fill().map((_, i) => generateScaleTestDocument(i))
    await hotStorage.addDocumentBatch(hotDocs)

    // Create several cold storage batches
    for (let batchIndex = 0; batchIndex < 10; batchIndex++) {
      const coldDocs = Array(500).fill().map((_, i) => 
        generateScaleTestDocument(1000 + (batchIndex * 500) + i)
      )
      await coldStorage.createBatch(coldDocs)
    }
  }
})