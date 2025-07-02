/**
 * Storage Tiers Integration Tests
 * 
 * AIDEV-NOTE: Test file disabled during Dexie.js migration - hybrid storage architecture removed
 * TODO: Create new cold storage only integration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// AIDEV-NOTE: Legacy imports disabled - services no longer exist after migration
// import { HotStorageService } from '../../../src/services/HotStorageService.js'
import { ColdStorageService } from '../../../src/services/ColdStorageService.js'
// import { DocumentTierManager } from '../../../src/services/DocumentTierManager.js'
import { EncryptionService } from '../../../src/services/EncryptionService.js'

describe.skip('Storage Tiers Integration - DISABLED DURING MIGRATION', () => {
  let hotStorage
  let coldStorage
  let tierManager
  let encryptionService

  // Mock document for testing
  const mockDocument = {
    id: 'test-doc-1',
    filename: 'test-document.pdf',
    content: 'This is test content for the document with keywords: planning, appeal, council',
    size: 1024,
    uploadDate: new Date('2024-01-15').toISOString(),
    metadata: {
      pageCount: 5,
      title: 'Test Planning Appeal',
      keywords: ['planning', 'appeal', 'council']
    }
  }

  beforeEach(async () => {
    // Initialize services
    hotStorage = new HotStorageService()
    coldStorage = new ColdStorageService()
    encryptionService = new EncryptionService()
    tierManager = new DocumentTierManager(hotStorage, coldStorage)

    // Mock authentication
    vi.spyOn(encryptionService, 'isAuthenticated').mockReturnValue(true)
    vi.spyOn(encryptionService, 'getEncryptionKey').mockReturnValue('mock-key')

    // Mock fetch for cold storage
    global.fetch = vi.fn()
    
    // Initialize storage systems
    await hotStorage.initialize()
    await coldStorage.initialize()
  })

  afterEach(async () => {
    await hotStorage.cleanup()
    await coldStorage.cleanup()
    vi.clearAllMocks()
  })

  describe('Document Storage Flow', () => {
    it('should store new documents in hot storage', async () => {
      const result = await hotStorage.addDocument(mockDocument)

      expect(result.success).toBe(true)
      expect(result.tier).toBe('hot')
      
      // Verify document is searchable in hot storage
      const searchResults = await hotStorage.searchDocuments('planning')
      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].id).toBe(mockDocument.id)
    })

    it('should migrate documents from hot to cold storage', async () => {
      // Add document to hot storage
      await hotStorage.addDocument(mockDocument)
      
      // Mock document age (90+ days old)
      const oldDocument = {
        ...mockDocument,
        uploadDate: new Date('2023-01-01').toISOString(),
        lastAccessed: new Date('2023-01-01').toISOString()
      }
      
      // Mock hot storage to return old document
      vi.spyOn(hotStorage, 'getOldDocuments').mockResolvedValue([oldDocument])
      
      // Mock cold storage batch creation
      vi.spyOn(coldStorage, 'createBatch').mockResolvedValue({
        success: true,
        batchId: 'batch-001'
      })

      const migrationResult = await tierManager.migrateOldDocuments()

      expect(migrationResult.success).toBe(true)
      expect(migrationResult.migratedCount).toBe(1)
      expect(coldStorage.createBatch).toHaveBeenCalled()
    })

    it('should handle hot storage capacity limits', async () => {
      // Mock hot storage at capacity
      vi.spyOn(hotStorage, 'getDocumentCount').mockResolvedValue(5000)
      vi.spyOn(hotStorage, 'isAtCapacity').mockReturnValue(true)

      // Try to add new document
      const result = await tierManager.addDocument(mockDocument)

      expect(result.requiresMigration).toBe(true)
      expect(result.tier).toBe('hot') // Still added to hot, but marked for migration
    })
  })

  describe('Search Across Tiers', () => {
    beforeEach(async () => {
      // Set up documents in both tiers
      await hotStorage.addDocument(mockDocument)
      
      // Mock cold storage with batch containing similar document
      const mockBatch = {
        batchId: 'batch-001',
        documents: [{
          ...mockDocument,
          id: 'cold-doc-1',
          content: 'Cold storage document about planning permission'
        }]
      }
      
      vi.spyOn(coldStorage, 'searchBatches').mockResolvedValue([mockBatch])
    })

    it('should search hot storage first (fast results)', async () => {
      const startTime = performance.now()
      const hotResults = await hotStorage.searchDocuments('planning')
      const hotSearchTime = performance.now() - startTime

      expect(hotResults.length).toBeGreaterThan(0)
      expect(hotSearchTime).toBeLessThan(100) // Should be under 100ms
      expect(hotResults[0].tier).toBe('hot')
    })

    it('should search cold storage with progress tracking', async () => {
      const progressCallback = vi.fn()
      const coldResults = await coldStorage.searchDocuments('planning', { 
        onProgress: progressCallback 
      })

      expect(coldResults.length).toBeGreaterThan(0)
      expect(progressCallback).toHaveBeenCalled()
      expect(coldResults[0].tier).toBe('cold')
    })

    it('should combine hot and cold search results', async () => {
      const unifiedResults = await tierManager.searchAllTiers('planning')

      expect(unifiedResults.hot.length).toBeGreaterThan(0)
      expect(unifiedResults.cold.length).toBeGreaterThan(0)
      expect(unifiedResults.hot[0].tier).toBe('hot')
      expect(unifiedResults.cold[0].tier).toBe('cold')
    })

    it('should handle cold storage search failures gracefully', async () => {
      // Mock cold storage failure
      vi.spyOn(coldStorage, 'searchDocuments').mockRejectedValue(new Error('Network error'))

      const results = await tierManager.searchAllTiers('planning')

      // Should still return hot results
      expect(results.hot.length).toBeGreaterThan(0)
      expect(results.cold).toEqual([])
      expect(results.coldError).toBeDefined()
    })
  })

  describe('Document Tier Management', () => {
    it('should track document access patterns', async () => {
      await hotStorage.addDocument(mockDocument)
      
      // Access document multiple times
      await hotStorage.getDocument(mockDocument.id)
      await hotStorage.getDocument(mockDocument.id)
      await hotStorage.getDocument(mockDocument.id)

      const accessStats = await hotStorage.getDocumentAccessStats(mockDocument.id)
      expect(accessStats.accessCount).toBe(3)
      expect(accessStats.lastAccessed).toBeDefined()
    })

    it('should prioritize frequently accessed documents for hot storage', async () => {
      const frequentDoc = { ...mockDocument, id: 'frequent-doc' }
      const rareDoc = { ...mockDocument, id: 'rare-doc' }

      await hotStorage.addDocument(frequentDoc)
      await hotStorage.addDocument(rareDoc)

      // Simulate frequent access
      for (let i = 0; i < 10; i++) {
        await hotStorage.getDocument(frequentDoc.id)
      }

      const migrationCandidates = await tierManager.getMigrationCandidates()
      
      // Rare document should be candidate for migration, frequent should not
      expect(migrationCandidates.some(doc => doc.id === 'rare-doc')).toBe(true)
      expect(migrationCandidates.some(doc => doc.id === 'frequent-doc')).toBe(false)
    })

    it('should handle document promotion from cold to hot', async () => {
      // Mock document in cold storage that becomes frequently accessed
      const coldDocId = 'cold-doc-promote'
      
      vi.spyOn(coldStorage, 'getDocument').mockResolvedValue({
        ...mockDocument,
        id: coldDocId,
        tier: 'cold'
      })

      // Simulate multiple accesses triggering promotion
      for (let i = 0; i < 5; i++) {
        await tierManager.accessDocument(coldDocId)
      }

      const promotionResult = await tierManager.promoteToHotStorage(coldDocId)
      
      expect(promotionResult.success).toBe(true)
      expect(promotionResult.tier).toBe('hot')
    })
  })

  describe('Batch Management', () => {
    it('should create encrypted batches with proper metadata', async () => {
      const documents = [
        { ...mockDocument, id: 'doc-1' },
        { ...mockDocument, id: 'doc-2' },
        { ...mockDocument, id: 'doc-3' }
      ]

      const batchResult = await coldStorage.createBatch(documents)

      expect(batchResult.success).toBe(true)
      expect(batchResult.batchId).toBeDefined()
      expect(batchResult.metadata.documentCount).toBe(3)
      expect(batchResult.metadata.encrypted).toBe(true)
    })

    it('should validate batch size limits', async () => {
      // Create oversized batch (mock 20MB worth of documents)
      const largeDocs = Array(1000).fill().map((_, i) => ({
        ...mockDocument,
        id: `large-doc-${i}`,
        size: 20 * 1024 // 20KB each
      }))

      const batchResult = await coldStorage.createBatch(largeDocs)

      // Should split into multiple batches or reject
      expect(batchResult.success).toBe(false)
      expect(batchResult.error).toContain('size limit')
    })

    it('should optimize batch organization for search performance', async () => {
      const planningDocs = [
        { ...mockDocument, id: 'planning-1', content: 'Planning permission appeal case 1' },
        { ...mockDocument, id: 'planning-2', content: 'Planning permission appeal case 2' }
      ]

      const housingDocs = [
        { ...mockDocument, id: 'housing-1', content: 'Housing development proposal' },
        { ...mockDocument, id: 'housing-2', content: 'Housing appeal decision' }
      ]

      // Batch creation should group similar documents
      const planningBatch = await coldStorage.createBatch(planningDocs)
      const housingBatch = await coldStorage.createBatch(housingDocs)

      expect(planningBatch.metadata.keywords).toContain('planning')
      expect(housingBatch.metadata.keywords).toContain('housing')
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle SQLite database corruption', async () => {
      // Mock database corruption
      vi.spyOn(hotStorage, '_checkDatabaseIntegrity').mockResolvedValue(false)

      const recoveryResult = await hotStorage.repairDatabase()
      
      expect(recoveryResult.success).toBe(true)
      expect(recoveryResult.recoveredDocuments).toBeGreaterThanOrEqual(0)
    })

    it('should handle encrypted batch corruption', async () => {
      // Mock corrupted batch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          version: '1.0',
          algorithm: 'AES-GCM',
          data: 'corrupted-data',
          checksum: 'invalid-checksum'
        })
      })

      const batchResult = await coldStorage.getBatch('corrupted-batch')
      
      expect(batchResult.success).toBe(false)
      expect(batchResult.error).toContain('checksum')
    })

    it('should handle network failures during cold storage access', async () => {
      // Mock network failure
      global.fetch.mockRejectedValue(new Error('Network error'))

      const searchResult = await coldStorage.searchDocuments('planning')
      
      expect(searchResult).toEqual([])
      // Should log error but not throw
    })

    it('should handle storage quota exceeded', async () => {
      // Mock storage quota exceeded
      const quotaError = new Error('QuotaExceededError')
      quotaError.name = 'QuotaExceededError'
      
      vi.spyOn(hotStorage, 'addDocument').mockRejectedValue(quotaError)

      const result = await tierManager.addDocument(mockDocument)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('storage quota')
      expect(result.fallbackSuggestion).toBeDefined()
    })
  })

  describe('Performance Benchmarks', () => {
    it('should meet hot storage search performance requirements', async () => {
      // Add multiple documents for realistic testing
      const testDocs = Array(100).fill().map((_, i) => ({
        ...mockDocument,
        id: `perf-doc-${i}`,
        content: `Performance test document ${i} with planning keywords`
      }))

      for (const doc of testDocs) {
        await hotStorage.addDocument(doc)
      }

      // Measure search performance
      const startTime = performance.now()
      const results = await hotStorage.searchDocuments('planning')
      const searchTime = performance.now() - startTime

      expect(searchTime).toBeLessThan(100) // Must be under 100ms
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle concurrent operations efficiently', async () => {
      const concurrentOperations = [
        hotStorage.addDocument({ ...mockDocument, id: 'concurrent-1' }),
        hotStorage.addDocument({ ...mockDocument, id: 'concurrent-2' }),
        hotStorage.addDocument({ ...mockDocument, id: 'concurrent-3' }),
        hotStorage.searchDocuments('planning'),
        hotStorage.searchDocuments('appeal')
      ]

      const startTime = performance.now()
      const results = await Promise.all(concurrentOperations)
      const totalTime = performance.now() - startTime

      // All operations should succeed
      results.slice(0, 3).forEach(result => {
        expect(result.success).toBe(true)
      })

      // Search results should be present
      results.slice(3).forEach(searchResult => {
        expect(Array.isArray(searchResult)).toBe(true)
      })

      // Total time should be reasonable for concurrent operations
      expect(totalTime).toBeLessThan(1000) // Under 1 second
    })
  })

  describe('Memory Management Integration', () => {
    it('should respect memory limits during batch operations', async () => {
      // Mock memory pressure
      const mockMemoryManager = {
        getCurrentUsage: vi.fn(() => 250 * 1024 * 1024), // 250MB
        isMemoryPressure: vi.fn(() => true),
        requestCleanup: vi.fn(() => Promise.resolve())
      }

      tierManager.setMemoryManager(mockMemoryManager)

      const batchOperation = await tierManager.processBatchWithMemoryLimit([mockDocument])
      
      expect(mockMemoryManager.requestCleanup).toHaveBeenCalled()
      expect(batchOperation.memoryOptimized).toBe(true)
    })

    it('should clean up decrypted data after operations', async () => {
      const cleanupSpy = vi.spyOn(coldStorage, '_cleanupDecryptedData')
      
      await coldStorage.searchDocuments('planning')
      
      // Cleanup should be called after search
      expect(cleanupSpy).toHaveBeenCalled()
    })
  })
})