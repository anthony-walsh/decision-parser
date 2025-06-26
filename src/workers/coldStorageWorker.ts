/**
 * Cold Storage Worker for Encrypted Batches
 * 
 * Handles searching and retrieving archived documents from encrypted
 * JSON batches stored in /public/cold-storage/
 */

// AIDEV-NOTE: Worker types for message handling
interface WorkerMessage {
  type: string;
  id?: string;
  payload: any;
}

interface EncryptedBatch {
  version: string;
  algorithm: string;
  iv: string;
  data: string;
  checksum: string;
  metadata: {
    batchId: string;
    documentCount: number;
    originalSize: number;
    compressedSize: number;
    encryptedSize: number;
  };
}

interface BatchInfo {
  batchId: string;
  url: string;
  documentCount: number;
  dateRange: { start: string; end: string };
  keywords: string[];
  size: string;
}

interface StorageIndex {
  totalDocuments: number;
  batches: BatchInfo[];
}

class ColdStorageWorker {
  private encryptionKey: CryptoKey | null = null;
  private isAuthenticated = false;
  private batchCache = new Map<string, any>();
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_CONCURRENT_BATCHES = 3;
  private currentCacheSize = 0;
  private storageIndex: StorageIndex | null = null;

  constructor() {
    console.log('Cold storage worker initialized');
  }

  public async handleMessage(event: MessageEvent<WorkerMessage>) {
    const { type, id, payload } = event.data;

    try {
      switch (type) {
        case 'auth-init':
          await this.handleAuthInit(payload, id);
          break;

        case 'load-storage-index':
          await this.handleLoadStorageIndex(id);
          break;

        case 'search-cold-storage':
          await this.handleSearchColdStorage(payload, id);
          break;

        case 'get-batch':
          await this.handleGetBatch(payload, id);
          break;

        case 'clear-cache':
          await this.handleClearCache(id);
          break;

        case 'get-cache-stats':
          await this.handleGetCacheStats(id);
          break;

        default:
          this.postMessage({
            type: 'error',
            id,
            payload: { message: `Unknown message type: ${type}` }
          });
      }
    } catch (error) {
      console.error(`Error handling ${type}:`, error);
      this.postMessage({
        type: 'error',
        id,
        payload: { 
          message: `Error handling ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error instanceof Error ? error.name : 'UnknownError'
        }
      });
    }
  }

  private async handleAuthInit(payload: any, id?: string) {
    try {
      if (!payload.keyMaterial) {
        throw new Error('No key material provided');
      }

      // Import encryption key from main thread
      this.encryptionKey = await crypto.subtle.importKey(
        'raw',
        payload.keyMaterial,
        'AES-GCM',
        false,
        ['encrypt', 'decrypt']
      );

      this.isAuthenticated = true;

      this.postMessage({
        type: 'auth-complete',
        id,
        payload: { success: true }
      });

    } catch (error) {
      this.postMessage({
        type: 'auth-error',
        id,
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async handleLoadStorageIndex(id?: string) {
    try {
      const response = await fetch('/cold-storage/storage-index.json');
      
      if (!response.ok) {
        throw new Error(`Failed to load storage index: ${response.status} ${response.statusText}`);
      }

      this.storageIndex = await response.json();
      
      if (!this.storageIndex) {
        throw new Error('Invalid storage index format');
      }

      this.postMessage({
        type: 'storage-index-loaded',
        id,
        payload: { 
          storageIndex: this.storageIndex,
          totalBatches: this.storageIndex.batches.length
        }
      });

    } catch (error) {
      this.postMessage({
        type: 'storage-index-error',
        id,
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async handleGetBatch(payload: any, id?: string) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    const { batchId } = payload;

    try {
      const batchData = await this.getBatchData({ batchId } as BatchInfo);

      this.postMessage({
        type: 'get-batch-complete',
        id,
        payload: { batchData }
      });

    } catch (error) {
      this.postMessage({
        type: 'get-batch-error',
        id,
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async handleSearchColdStorage(payload: any, id?: string) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    if (!this.storageIndex) {
      throw new Error('Storage index not loaded');
    }

    const { query, options = {} } = payload;
    const { limit = 50 } = options;

    try {
      // Find relevant batches based on query and filters
      const relevantBatches = await this.findRelevantBatches(query, options);

      if (relevantBatches.length === 0) {
        this.postMessage({
          type: 'cold-search-complete',
          id,
          payload: { 
            results: [],
            query,
            total: 0,
            batchesSearched: 0
          }
        });
        return;
      }

      // Limit number of batches to search for performance
      const batchesToSearch = relevantBatches.slice(0, 10);
      
      this.postMessage({
        type: 'cold-search-progress',
        id,
        payload: { 
          message: `Searching ${batchesToSearch.length} archive sections...`,
          totalBatches: batchesToSearch.length,
          completedBatches: 0
        }
      });

      const allResults: any[] = [];
      let completedBatches = 0;

      // Process batches in chunks to manage memory
      for (let i = 0; i < batchesToSearch.length; i += this.MAX_CONCURRENT_BATCHES) {
        const batchChunk = batchesToSearch.slice(i, i + this.MAX_CONCURRENT_BATCHES);
        
        // Search chunk of batches
        const chunkResults = await this.searchBatchChunk(batchChunk, query);
        allResults.push(...chunkResults);

        completedBatches += batchChunk.length;

        // Report progress
        this.postMessage({
          type: 'cold-search-progress',
          id,
          payload: { 
            message: `Searched ${completedBatches}/${batchesToSearch.length} archive sections...`,
            totalBatches: batchesToSearch.length,
            completedBatches,
            partialResults: chunkResults
          }
        });

        // Yield control to prevent blocking
        await this.yieldControl();
      }

      // Sort results by relevance and apply limit
      allResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
      const limitedResults = allResults.slice(0, limit);

      this.postMessage({
        type: 'cold-search-complete',
        id,
        payload: { 
          results: limitedResults,
          query,
          total: allResults.length,
          batchesSearched: completedBatches,
          limited: allResults.length > limit
        }
      });

    } catch (error) {
      this.postMessage({
        type: 'cold-search-error',
        id,
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async findRelevantBatches(query: string, options: any): Promise<BatchInfo[]> {
    if (!this.storageIndex) {
      return [];
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const relevantBatches: Array<{ batch: BatchInfo; score: number }> = [];

    for (const batch of this.storageIndex.batches) {
      let score = 0;

      // Check keyword relevance
      const batchKeywords = batch.keywords.map(k => k.toLowerCase());
      for (const term of queryTerms) {
        for (const keyword of batchKeywords) {
          if (keyword.includes(term) || term.includes(keyword)) {
            score += 1;
          }
        }
      }

      // Apply date filter
      if (options.dateFilter) {
        const { start, end } = options.dateFilter;
        const batchStart = new Date(batch.dateRange.start);
        const batchEnd = new Date(batch.dateRange.end);
        const filterStart = new Date(start);
        const filterEnd = new Date(end);

        // Check if batch date range overlaps with filter range
        const overlaps = batchStart <= filterEnd && batchEnd >= filterStart;
        if (!overlaps) {
          continue; // Skip batch if no date overlap
        }
        score += 2; // Bonus for date relevance
      }

      if (score > 0) {
        relevantBatches.push({ batch, score });
      }
    }

    // Sort by relevance score and return batch info
    relevantBatches.sort((a, b) => b.score - a.score);
    return relevantBatches.map(item => item.batch);
  }

  private async searchBatchChunk(batches: BatchInfo[], query: string): Promise<any[]> {
    const chunkResults: any[] = [];

    for (const batch of batches) {
      try {
        // Check memory usage before processing
        await this.checkMemoryUsage();

        // Get batch data (from cache or fetch/decrypt)
        const batchData = await this.getBatchData(batch);
        
        // Search within batch
        const batchResults = await this.searchBatchContent(batchData, query, batch.batchId);
        chunkResults.push(...batchResults);

      } catch (error) {
        console.warn(`Failed to search batch ${batch.batchId}:`, error instanceof Error ? error.message : 'Unknown error');
        // Continue with other batches
      }
    }

    return chunkResults;
  }

  private async getBatchData(batch: BatchInfo): Promise<any> {
    // Check cache first
    if (this.batchCache.has(batch.batchId)) {
      const cached = this.batchCache.get(batch.batchId);
      cached.lastAccessed = Date.now();
      return cached.data;
    }

    // Fetch and decrypt batch
    const encryptedBatch = await this.fetchBatch(batch.url);
    const batchData = await this.decryptBatch(encryptedBatch);

    // Add to cache
    this.addToCache(batch.batchId, batchData);

    return batchData;
  }

  private async fetchBatch(url: string): Promise<EncryptedBatch> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch batch: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async decryptBatch(encryptedBatch: EncryptedBatch): Promise<any> {
    if (!this.encryptionKey) {
      throw new Error('No encryption key available');
    }

    try {
      // Validate batch structure
      this.validateEncryptedBatch(encryptedBatch);

      // Parse encrypted data
      const iv = this.base64ToArrayBuffer(encryptedBatch.iv);
      const encryptedData = this.base64ToArrayBuffer(encryptedBatch.data);

      // Verify checksum
      const calculatedChecksum = await this.calculateChecksum(encryptedData);
      if (calculatedChecksum !== encryptedBatch.checksum) {
        throw new Error('Checksum verification failed');
      }

      // Decrypt
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        this.encryptionKey,
        encryptedData
      );

      // Decompress and parse
      const decompressed = await this.decompressData(decryptedData);
      return JSON.parse(decompressed);

    } catch (error) {
      throw new Error(`Failed to decrypt batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchBatchContent(batchData: any, query: string, batchId: string): Promise<any[]> {
    const results: any[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);

    if (!batchData.documents || !Array.isArray(batchData.documents)) {
      return results;
    }

    for (const document of batchData.documents) {
      const content = document.content || '';
      const contentLower = content.toLowerCase();
      
      let relevance = 0;
      const matches: string[] = [];

      // Simple relevance scoring
      for (const term of queryTerms) {
        const termMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
        relevance += termMatches;
        if (termMatches > 0) {
          matches.push(term);
        }
      }

      if (relevance > 0) {
        // Extract snippet around first match
        const snippet = this.extractSnippet(content, matches[0]);

        results.push({
          id: document.id,
          filename: document.filename,
          metadata: document.metadata || {},
          snippet,
          relevance,
          tier: 'cold',
          isArchived: true,
          batchId
        });
      }
    }

    return results;
  }

  private extractSnippet(content: string, searchTerm: string, contextLength: number = 150): string {
    const index = content.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (index === -1) {
      return content.substring(0, contextLength) + '...';
    }

    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(content.length, index + searchTerm.length + contextLength / 2);
    
    let snippet = content.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    // Highlight search term
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    snippet = snippet.replace(regex, '<mark>$1</mark>');

    return snippet;
  }

  private addToCache(batchId: string, data: any) {
    const dataSize = JSON.stringify(data).length * 2; // Rough UTF-16 size estimate

    // Evict entries if cache would exceed limit
    while (this.currentCacheSize + dataSize > this.MAX_CACHE_SIZE && this.batchCache.size > 0) {
      this.evictOldestCacheEntry();
    }

    this.batchCache.set(batchId, {
      data,
      size: dataSize,
      lastAccessed: Date.now()
    });

    this.currentCacheSize += dataSize;
  }

  private evictOldestCacheEntry() {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.batchCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.batchCache.get(oldestKey);
      this.batchCache.delete(oldestKey);
      this.currentCacheSize -= entry.size;
    }
  }

  private async checkMemoryUsage() {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const memoryLimit = 200 * 1024 * 1024; // 200MB limit

      if (memInfo.usedJSHeapSize > memoryLimit) {
        // Force cache cleanup
        this.batchCache.clear();
        this.currentCacheSize = 0;
        
        // Try to trigger garbage collection
        if ('gc' in globalThis) {
          (globalThis as any).gc();
        }
      }
    }
  }

  private async yieldControl(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 10));
  }

  // Utility methods for encryption/decryption
  private validateEncryptedBatch(batch: EncryptedBatch) {
    const required = ['version', 'algorithm', 'iv', 'data', 'checksum'];
    for (const field of required) {
      if (!(field in batch)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async decompressData(compressedData: ArrayBuffer): Promise<string> {
    if (!globalThis.DecompressionStream) {
      // Fallback: assume uncompressed
      return new TextDecoder().decode(compressedData);
    }

    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      await writer.write(new Uint8Array(compressedData));
      await writer.close();

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalSize += value.byteLength;
      }

      const decompressed = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return new TextDecoder().decode(decompressed);
    } catch (error) {
      return new TextDecoder().decode(compressedData);
    }
  }

  private async handleClearCache(id?: string) {
    this.batchCache.clear();
    this.currentCacheSize = 0;

    this.postMessage({
      type: 'cache-cleared',
      id,
      payload: { success: true }
    });
  }

  private async handleGetCacheStats(id?: string) {
    this.postMessage({
      type: 'cache-stats',
      id,
      payload: {
        cacheSize: this.currentCacheSize,
        cachedBatches: this.batchCache.size,
        maxCacheSize: this.MAX_CACHE_SIZE
      }
    });
  }

  private postMessage(message: any) {
    self.postMessage(message);
  }
}

// Initialize worker
const coldStorageWorker = new ColdStorageWorker();

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  (coldStorageWorker as any).handleMessage(event);
};