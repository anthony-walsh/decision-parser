/**
 * Cold Storage Worker - Encrypted batch processing and search
 * 
 * Handles:
 * - Encrypted batch fetching and decryption
 * - Progressive search across cold storage batches
 * - 100MB batch cache with LRU eviction
 * - Memory management for large document collections
 * 
 * AIDEV-NOTE: Worker handles sensitive decrypted data - memory cleanup is critical
 */

// AIDEV-NOTE: Global error handlers for worker initialization debugging
console.log('[ColdStorageWorker] Starting worker script initialization...');

// Global error handler for uncaught errors
self.addEventListener('error', (event) => {
  console.error('[ColdStorageWorker] Global uncaught error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  });
  
  // Send error to main thread
  self.postMessage({
    type: 'worker-fatal-error',
    payload: {
      message: `Global uncaught error: ${event.message}`,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    }
  });
});

// Global handler for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[ColdStorageWorker] Global unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  });
  
  // Send error to main thread
  self.postMessage({
    type: 'worker-fatal-error',
    payload: {
      message: `Unhandled promise rejection: ${event.reason}`,
      reason: event.reason,
      stack: event.reason?.stack
    }
  });
});

console.log('[ColdStorageWorker] Global error handlers installed');

// AIDEV-NOTE: Module dependency verification
console.log('[ColdStorageWorker] Verifying worker environment dependencies...');

try {
  // Check if Web Crypto API is available
  if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
    throw new Error('Web Crypto API not available in worker context');
  }
  console.log('[ColdStorageWorker] Web Crypto API verified');

  // Check if fetch is available
  if (typeof fetch === 'undefined') {
    throw new Error('Fetch API not available in worker context');
  }
  console.log('[ColdStorageWorker] Fetch API verified');

  // Check if TextDecoder/TextEncoder are available
  if (typeof TextDecoder === 'undefined' || typeof TextEncoder === 'undefined') {
    throw new Error('TextDecoder/TextEncoder not available in worker context');
  }
  console.log('[ColdStorageWorker] Text encoding APIs verified');

  // Check if JSON is available
  if (typeof JSON === 'undefined') {
    throw new Error('JSON not available in worker context');
  }
  console.log('[ColdStorageWorker] JSON API verified');

  // Check if Map and Set are available
  if (typeof Map === 'undefined' || typeof Set === 'undefined') {
    throw new Error('Map/Set not available in worker context');
  }
  console.log('[ColdStorageWorker] Collection APIs verified');

  console.log('[ColdStorageWorker] All required dependencies verified successfully');
} catch (error) {
  console.error('[ColdStorageWorker] Dependency verification failed:', error);
  
  self.postMessage({
    type: 'worker-fatal-error',
    payload: {
      message: `Dependency verification failed: ${error instanceof Error ? error.message : String(error)}`,
      error: 'DependencyError'
    }
  });
  
  throw error;
}

// AIDEV-NOTE: Worker-compatible encryption service (inline implementation)
// Workers can't import from main thread context, so we implement encryption directly
console.log('[ColdStorageWorker] Defining WorkerEncryptionService class...');

class WorkerEncryptionService {
  public algorithm: string;
  public keyLength: number;
  public ivLength: number;
  public pbkdf2Iterations: number;
  public saltLength: number;
  public encryptionKey: CryptoKey | null;
  public userPassword: string | null;
  constructor() {
    console.log('[ColdStorageWorker][EncryptionService] Initializing encryption service...');
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12; // 96 bits for GCM
    this.pbkdf2Iterations = 600000;
    this.saltLength = 32; // 256 bits
    this.encryptionKey = null;
    this.userPassword = null; // Store user password for batch-specific key derivation
    console.log('[ColdStorageWorker][EncryptionService] Encryption service constructor completed');
  }

  async initialize(keyMaterial: ArrayBuffer) {
    console.log('[ColdStorageWorker][EncryptionService] Initializing with key material');
    try {
      this.encryptionKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: this.algorithm },
        false,
        ['encrypt', 'decrypt']
      );
      console.log('[ColdStorageWorker][EncryptionService] Key imported successfully');
    } catch (error) {
      console.error('[ColdStorageWorker][EncryptionService] Key import failed:', error);
      throw new Error('Failed to import encryption key');
    }
  }

  async initializeWithPassword(password: string) {
    console.log('[ColdStorageWorker][EncryptionService] Initializing with password for batch-specific key derivation');
    this.userPassword = password;
    console.log('[ColdStorageWorker][EncryptionService] Password stored for batch key derivation');
  }

  async deriveKeyFromBatchSalt(batchSalt: string): Promise<CryptoKey> {
    if (!this.userPassword) {
      throw new Error('Password not initialized');
    }

    console.log('[ColdStorageWorker][EncryptionService] Deriving key from batch salt');
    
    // Convert base64 salt to Uint8Array
    const saltBuffer = Uint8Array.from(atob(batchSalt), c => c.charCodeAt(0));
    
    // Import password as key material
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(this.userPassword);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive AES-GCM key using batch salt
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: this.pbkdf2Iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
    
    console.log('[ColdStorageWorker][EncryptionService] Key derived from batch salt successfully');
    return key;
  }

  async decrypt(encryptedData: string | number[], iv: string | number[]): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // AIDEV-NOTE: Handle both array format (from test batch) and base64 string format
      let encryptedBuffer: Uint8Array;
      let ivBuffer: Uint8Array;
      
      // Convert encrypted data based on input format
      if (Array.isArray(encryptedData)) {
        console.log('[ColdStorageWorker][EncryptionService] Processing encrypted data as byte array');
        encryptedBuffer = new Uint8Array(encryptedData);
      } else {
        console.log('[ColdStorageWorker][EncryptionService] Processing encrypted data as base64 string');
        encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      }
      
      // Convert IV based on input format
      if (Array.isArray(iv)) {
        console.log('[ColdStorageWorker][EncryptionService] Processing IV as byte array');
        ivBuffer = new Uint8Array(iv);
      } else {
        console.log('[ColdStorageWorker][EncryptionService] Processing IV as base64 string');
        ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      }

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: ivBuffer
        },
        this.encryptionKey,
        encryptedBuffer
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error('[ColdStorageWorker][EncryptionService] Decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  async decryptWithKey(key: CryptoKey, encryptedData: string | number[], iv: string | number[]): Promise<string> {
    try {
      // AIDEV-NOTE: Handle both array format (from test batch) and base64 string format
      let encryptedBuffer: Uint8Array;
      let ivBuffer: Uint8Array;
      
      // Convert encrypted data based on input format
      if (Array.isArray(encryptedData)) {
        console.log('[ColdStorageWorker][EncryptionService] Processing encrypted data as byte array');
        encryptedBuffer = new Uint8Array(encryptedData);
      } else {
        console.log('[ColdStorageWorker][EncryptionService] Processing encrypted data as base64 string');
        encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      }
      
      // Convert IV based on input format
      if (Array.isArray(iv)) {
        console.log('[ColdStorageWorker][EncryptionService] Processing IV as byte array');
        ivBuffer = new Uint8Array(iv);
      } else {
        console.log('[ColdStorageWorker][EncryptionService] Processing IV as base64 string');
        ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      }

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: ivBuffer
        },
        key,
        encryptedBuffer
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error('[ColdStorageWorker][EncryptionService] Decryption with key failed:', error);
      throw new Error('Decryption failed');
    }
  }

  async decryptBatch(encryptedBatch: EncryptedBatch): Promise<any> {
    console.log('[ColdStorageWorker][EncryptionService] Decrypting batch:', encryptedBatch.metadata?.batchId);
    
    if (!this.userPassword) {
      throw new Error('Encryption service not initialized with password');
    }

    try {
      // Check if batch includes salt (new format)
      if (encryptedBatch.salt) {
        console.log('[ColdStorageWorker][EncryptionService] Using batch-embedded salt for key derivation');
        
        // Derive key using batch salt + user password
        const batchKey = await this.deriveKeyFromBatchSalt(encryptedBatch.salt);
        
        // Decrypt with batch-specific key
        const decryptedContent = await this.decryptWithKey(batchKey, encryptedBatch.data, encryptedBatch.iv);
        
        // Parse the decrypted JSON
        const batchData = JSON.parse(decryptedContent);
        console.log('[ColdStorageWorker][EncryptionService] Batch decrypted successfully with batch salt:', {
          batchId: encryptedBatch.metadata?.batchId,
          documentCount: batchData.documents?.length || 0
        });
        
        return batchData;
      } else {
        // Fallback to legacy method (should not be needed in new format)
        throw new Error('Batch missing salt field - incompatible format');
      }
    } catch (error) {
      console.error('[ColdStorageWorker][EncryptionService] Batch decryption failed:', error);
      throw new Error(`Batch decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isInitialized(): boolean {
    return !!this.encryptionKey || !!this.userPassword;
  }
}

// AIDEV-NOTE: Worker types for message handling
console.log('[ColdStorageWorker] Defining worker interfaces...');

interface WorkerMessage {
  type: string;
  id?: string;
  payload: any;
}

interface EncryptedBatch {
  version: string;
  algorithm: string;
  iv: string | number[];
  data: string | number[];
  checksum: string | number[];
  salt?: string; // AIDEV-NOTE: Added salt field for batch-specific encryption
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
  encrypted?: boolean;
}

interface StorageIndex {
  version?: string;
  totalDocuments: number;
  totalBatches?: number;
  lastUpdated?: string;
  batches: BatchInfo[];
  metadata?: {
    encryptionPolicy?: string;
    encryptionAlgorithm?: string;
    keyDerivation?: string;
    batchSizeLimit?: number;
    documentThreshold?: number;
    [key: string]: any;
  };
}

console.log('[ColdStorageWorker] Defining ColdStorageWorker class...');

class ColdStorageWorker {
  private encryptionService: WorkerEncryptionService;
  private isAuthenticated = false;
  private batchCache = new Map<string, any>();
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_CONCURRENT_BATCHES = 3;
  private currentCacheSize = 0;
  private storageIndex: StorageIndex | null = null;

  constructor() {
    console.log('[ColdStorageWorker] Starting ColdStorageWorker constructor...');
    
    try {
      console.log('[ColdStorageWorker] Creating encryption service...');
      this.encryptionService = new WorkerEncryptionService();
      console.log('[ColdStorageWorker] Encryption service created successfully');
      
      console.log('[ColdStorageWorker] Cold storage worker initialized with enhanced encryption service');
      console.log('[ColdStorageWorker] Worker configuration:', {
        maxCacheSize: `${this.MAX_CACHE_SIZE / 1024 / 1024}MB`,
        maxConcurrentBatches: this.MAX_CONCURRENT_BATCHES
      });
      
      console.log('[ColdStorageWorker] ColdStorageWorker constructor completed successfully');
    } catch (error) {
      console.error('[ColdStorageWorker] Error in constructor:', error);
      throw error;
    }
  }

  public async handleMessage(event: MessageEvent<WorkerMessage>) {
    const { type, id, payload } = event.data;
    console.log(`[ColdStorageWorker] Received message:`, { type, id, payloadSize: JSON.stringify(payload || {}).length });

    try {
      switch (type) {
        case 'auth-init':
          console.log(`[ColdStorageWorker] Processing auth-init for ${id}`);
          await this.handleAuthInit(payload, id);
          break;

        case 'load-storage-index':
          console.log(`[ColdStorageWorker] Processing load-storage-index for ${id}`);
          await this.handleLoadStorageIndex(id);
          break;

        case 'search-cold-storage':
          console.log(`[ColdStorageWorker] Processing search-cold-storage for ${id}:`, { query: payload.query });
          await this.handleSearchColdStorage(payload, id);
          break;

        case 'get-batch':
          console.log(`[ColdStorageWorker] Processing get-batch for ${id}:`, { batchId: payload.batchId });
          await this.handleGetBatch(payload, id);
          break;

        case 'clear-cache':
          console.log(`[ColdStorageWorker] Processing clear-cache for ${id}`);
          await this.handleClearCache(id);
          break;

        case 'get-cache-stats':
          console.log(`[ColdStorageWorker] Processing get-cache-stats for ${id}`);
          await this.handleGetCacheStats(id);
          break;

        default:
          console.error(`[ColdStorageWorker] Unknown message type: ${type}`);
          this.postMessage({
            type: 'error',
            id,
            payload: { message: `Unknown message type: ${type}` }
          });
      }
    } catch (error) {
      console.error(`[ColdStorageWorker] Error handling ${type}:`, error);
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
    console.log(`[ColdStorageWorker] Starting authentication initialization...`);
    
    try {
      // Support both old keyMaterial format and new password format
      if (payload.password) {
        console.log('[ColdStorageWorker] Initializing encryption service with password for batch-specific decryption...');
        await this.encryptionService.initializeWithPassword(payload.password);
      } else if (payload.keyMaterial) {
        console.log('[ColdStorageWorker] Initializing encryption service with key material (legacy)...');
        await this.encryptionService.initialize(payload.keyMaterial);
      } else {
        console.error('[ColdStorageWorker] No password or key material provided for authentication');
        throw new Error('No password or key material provided');
      }

      this.isAuthenticated = true;
      console.log('[ColdStorageWorker] Authentication successful, encryption service ready');

      // Send successful response for the specific message ID
      this.postMessage({
        type: 'auth-init-response',
        id,
        payload: { success: true }
      });

      // Also send the general auth-complete notification
      this.postMessage({
        type: 'auth-complete',
        payload: { success: true }
      });

    } catch (error) {
      console.error('[ColdStorageWorker] Authentication failed:', error);
      this.postMessage({
        type: 'auth-init-error',
        id,
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async handleLoadStorageIndex(id?: string) {
    console.log('[ColdStorageWorker] Loading storage index from /cold-storage/storage-index.json...');
    
    try {
      // AIDEV-NOTE: Try multiple paths to handle both dev and production
      const storageIndexUrls = [
        '/decision-parser/cold-storage/storage-index.json', // Development with base path
        '/cold-storage/storage-index.json' // Production or direct path
      ];
      
      let response: Response | null = null;
      let lastError: Error | null = null;
      let storageIndexUrl = '';
      
      // Try each URL until one works
      for (const url of storageIndexUrls) {
        try {
          console.log(`[ColdStorageWorker] Trying storage index URL: ${url}`);
          const fetchResponse = await fetch(url);
          if (fetchResponse.ok) {
            response = fetchResponse;
            storageIndexUrl = url;
            break;
          } else {
            console.log(`[ColdStorageWorker] URL ${url} returned ${fetchResponse.status}`);
          }
        } catch (error) {
          console.log(`[ColdStorageWorker] URL ${url} failed:`, error instanceof Error ? error.message : error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      if (!response || !response.ok) {
        throw lastError || new Error('All storage index URLs failed');
      }
      
      console.log(`[ColdStorageWorker] Successfully found storage index at: ${storageIndexUrl}`);
      console.log(`[ColdStorageWorker] Storage index fetch response:`, { 
        url: storageIndexUrl,
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load storage index: ${response.status} ${response.statusText}`);
      }

      this.storageIndex = await response.json();
      
      console.log('[ColdStorageWorker] ===== STORAGE INDEX DIAGNOSTICS START =====');
      console.log('[ColdStorageWorker] Raw storage index loaded from:', storageIndexUrl);
      console.log('[ColdStorageWorker] Storage index structure analysis:', {
        hasVersion: !!this.storageIndex?.version,
        version: this.storageIndex?.version,
        totalDocuments: this.storageIndex?.totalDocuments,
        totalBatches: this.storageIndex?.totalBatches,
        actualBatchesCount: this.storageIndex?.batches?.length || 0,
        hasMetadata: !!this.storageIndex?.metadata,
        lastUpdated: this.storageIndex?.lastUpdated
      });
      
      if (this.storageIndex?.metadata) {
        console.log('[ColdStorageWorker] Storage index metadata:', {
          encryptionAlgorithm: this.storageIndex.metadata.encryptionAlgorithm,
          keyDerivation: this.storageIndex.metadata.keyDerivation,
          encryptionPolicy: this.storageIndex.metadata.encryptionPolicy,
          batchSizeLimit: this.storageIndex.metadata.batchSizeLimit,
          documentThreshold: this.storageIndex.metadata.documentThreshold
        });
      }
      
      if (!this.storageIndex) {
        console.error('[ColdStorageWorker] ❌ CRITICAL: Storage index is null or undefined');
        throw new Error('Invalid storage index format - null response');
      }
      
      if (!this.storageIndex.batches) {
        console.warn('[ColdStorageWorker] ⚠️  Storage index missing batches array - creating empty array');
        this.storageIndex.batches = [];
      }
      
      console.log('[ColdStorageWorker] Batch array analysis:', {
        batchesCount: this.storageIndex.batches.length,
        isEmpty: this.storageIndex.batches.length === 0,
        sample: this.storageIndex.batches.slice(0, 3).map(b => ({
          batchId: b?.batchId,
          url: b?.url,
          encrypted: b?.encrypted,
          documentCount: b?.documentCount,
          hasKeywords: !!b?.keywords?.length
        }))
      });
      
      if (this.storageIndex.batches.length === 0) {
        console.warn('[ColdStorageWorker] ⚠️  EMPTY STORAGE INDEX: No batches found - this explains zero search results');
        console.log('[ColdStorageWorker] To fix: Add encrypted batch files and update storage index');
        console.log('[ColdStorageWorker] Expected batch structure: { batchId, url, documentCount, keywords, dateRange, encrypted: true }');
      } else {
        console.log('[ColdStorageWorker] Validating batch entries...');
        for (let i = 0; i < this.storageIndex.batches.length; i++) {
          const batch = this.storageIndex.batches[i];
          console.log(`[ColdStorageWorker] Batch ${i + 1}/${this.storageIndex.batches.length} validation:`, {
            batchId: batch?.batchId || 'MISSING',
            hasUrl: !!batch?.url,
            url: batch?.url,
            hasKeywords: !!batch?.keywords?.length,
            keywordCount: batch?.keywords?.length || 0,
            keywords: batch?.keywords,
            documentCount: batch?.documentCount || 0,
            encrypted: batch?.encrypted,
            hasDateRange: !!batch?.dateRange
          });
        }
      }
      
      // AIDEV-NOTE: Validate encrypted-only policy
      console.log('[ColdStorageWorker] Validating encryption policy compliance...');
      this.validateStorageIndexEncryption();
      console.log('[ColdStorageWorker] ✓ Encryption policy validation passed');
      console.log('[ColdStorageWorker] ===== STORAGE INDEX DIAGNOSTICS END =====');

      this.postMessage({
        type: 'storage-index-loaded',
        id,
        payload: { 
          storageIndex: this.storageIndex,
          totalBatches: this.storageIndex.batches.length
        }
      });

    } catch (error) {
      console.error('[ColdStorageWorker] Failed to load storage index:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined
      });
      this.postMessage({
        type: 'storage-index-error',
        id,
        payload: { 
          message: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.name : 'UnknownError'
        }
      });
    }
  }

  private async handleGetBatch(payload: any, id?: string) {
    console.log(`[ColdStorageWorker] Getting batch:`, { batchId: payload.batchId });
    
    if (!this.isAuthenticated) {
      console.error('[ColdStorageWorker] Cannot get batch - authentication required');
      throw new Error('Authentication required for batch access');
    }

    const { batchId } = payload;

    try {
      console.log(`[ColdStorageWorker] Fetching batch data for ${batchId}...`);
      const batchData = await this.getBatchData({ batchId } as BatchInfo);
      console.log(`[ColdStorageWorker] Successfully retrieved batch ${batchId}`);

      this.postMessage({
        type: 'get-batch-complete',
        id,
        payload: { batchData }
      });

    } catch (error) {
      console.error(`[ColdStorageWorker] Failed to get batch ${batchId}:`, error);
      this.postMessage({
        type: 'get-batch-error',
        id,
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async handleSearchColdStorage(payload: any, id?: string) {
    if (!this.storageIndex) {
      throw new Error('Storage index not loaded');
    }
    
    // AIDEV-NOTE: Always require authentication for cold storage (encrypted-only policy)
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for cold storage access');
    }

    const { query, options = {} } = payload;
    const { limit = 50 } = options;

    try {
      console.log(`[ColdStorageWorker] Finding relevant batches for query: ${query}`);
      // Find relevant batches based on query and filters
      const relevantBatches = await this.findRelevantBatches(query, options);
      console.log(`[ColdStorageWorker] Found ${relevantBatches.length} relevant batches`);

      if (relevantBatches.length === 0) {
        console.log('[ColdStorageWorker] No relevant batches found, returning empty results');
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

      // ALWAYS search ALL batches for complete coverage - no limiting for performance
      const batchesToSearch = relevantBatches; // Search all batches, no slicing
      console.log(`[ColdStorageWorker] Will search ALL ${batchesToSearch.length} batches for complete coverage`);
      
      // Categorize batches for two-phase processing
      const highPriorityBatches = batchesToSearch.filter(b => b.hasKeywordMatch);
      const lowPriorityBatches = batchesToSearch.filter(b => !b.hasKeywordMatch);
      
      console.log(`[ColdStorageWorker] Search phases: HIGH priority (${highPriorityBatches.length} batches), LOW priority (${lowPriorityBatches.length} batches)`);
      
      this.postMessage({
        type: 'cold-search-progress',
        id,
        payload: { 
          message: `Searching all ${batchesToSearch.length} archive sections for complete coverage...`,
          totalBatches: batchesToSearch.length,
          completedBatches: 0,
          phases: {
            highPriority: highPriorityBatches.length,
            lowPriority: lowPriorityBatches.length
          }
        }
      });

      const allResults: any[] = [];
      let completedBatches = 0;
      console.log('[ColdStorageWorker] Starting comprehensive two-phase search...');

      // PHASE 1: Search high-priority batches first (keyword matches)
      if (highPriorityBatches.length > 0) {
        console.log(`[ColdStorageWorker] === PHASE 1: Searching ${highPriorityBatches.length} high-priority batches ===`);
        
        this.postMessage({
          type: 'cold-search-progress',
          id,
          payload: { 
            message: `Phase 1: Searching priority batches (${highPriorityBatches.length} of ${batchesToSearch.length})...`,
            totalBatches: batchesToSearch.length,
            completedBatches: 0,
            currentPhase: 'high-priority'
          }
        });

        const highPriorityResults = await this.searchBatchesWithProgress(highPriorityBatches.map(b => b.batch), query, id, 'high-priority');
        allResults.push(...highPriorityResults);
        completedBatches += highPriorityBatches.length;
        
        console.log(`[ColdStorageWorker] Phase 1 completed: ${highPriorityResults.length} results from ${highPriorityBatches.length} batches`);
      }

      // PHASE 2: Search remaining batches for complete coverage (ALWAYS executed)
      if (lowPriorityBatches.length > 0) {
        console.log(`[ColdStorageWorker] === PHASE 2: Searching ${lowPriorityBatches.length} remaining batches for complete coverage ===`);
        
        this.postMessage({
          type: 'cold-search-progress',
          id,
          payload: { 
            message: `Phase 2: Completing comprehensive search (${lowPriorityBatches.length} remaining batches)...`,
            totalBatches: batchesToSearch.length,
            completedBatches,
            currentPhase: 'comprehensive'
          }
        });

        const lowPriorityResults = await this.searchBatchesWithProgress(lowPriorityBatches.map(b => b.batch), query, id, 'comprehensive');
        allResults.push(...lowPriorityResults);
        completedBatches += lowPriorityBatches.length;
        
        console.log(`[ColdStorageWorker] Phase 2 completed: ${lowPriorityResults.length} results from ${lowPriorityBatches.length} batches`);
      }

      console.log(`[ColdStorageWorker] === COMPREHENSIVE SEARCH COMPLETED ===`);
      console.log(`[ColdStorageWorker] Total batches searched: ${completedBatches}/${batchesToSearch.length}`);
      console.log(`[ColdStorageWorker] Total results found: ${allResults.length}`);

      // Sort results by relevance and apply limit
      console.log(`[ColdStorageWorker] Sorting and limiting results:`, {
        totalResults: allResults.length,
        limit,
        willBeLimited: allResults.length > limit
      });
      allResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
      const limitedResults = allResults.slice(0, limit);
      console.log(`[ColdStorageWorker] Final results:`, {
        returned: limitedResults.length,
        total: allResults.length,
        batchesSearched: completedBatches
      });

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
      console.error('[ColdStorageWorker] Cold storage search failed:', error);
      this.postMessage({
        type: 'cold-search-error',
        id,
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async findRelevantBatches(query: string, options: any): Promise<Array<{ batch: BatchInfo; score: number; hasKeywordMatch: boolean }>> {
    console.log(`[ColdStorageWorker] ===== SEARCH DIAGNOSTICS START =====`);
    console.log(`[ColdStorageWorker] Finding relevant batches for query: "${query}"`);
    console.log(`[ColdStorageWorker] Search options:`, JSON.stringify(options, null, 2));
    
    if (!this.storageIndex) {
      console.error('[ColdStorageWorker] ❌ CRITICAL: No storage index available');
      console.log(`[ColdStorageWorker] ===== SEARCH DIAGNOSTICS END =====`);
      return [];
    }

    console.log(`[ColdStorageWorker] Storage index details:`, {
      totalDocuments: this.storageIndex.totalDocuments,
      totalBatches: this.storageIndex.batches?.length || 0,
      metadata: this.storageIndex.metadata,
      batchesArray: this.storageIndex.batches
    });

    if (!this.storageIndex.batches || this.storageIndex.batches.length === 0) {
      console.warn('[ColdStorageWorker] ⚠️  No batches found in storage index - this is why search returns 0 results');
      console.log(`[ColdStorageWorker] Expected storage index structure: { totalDocuments: number, batches: BatchInfo[] }`);
      console.log(`[ColdStorageWorker] Actual batches array:`, this.storageIndex.batches);
      console.log(`[ColdStorageWorker] ===== SEARCH DIAGNOSTICS END =====`);
      return [];
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    console.log(`[ColdStorageWorker] Processed query terms (min 3 chars):`, queryTerms);
    console.log(`[ColdStorageWorker] Processing ${this.storageIndex.batches.length} batches for relevance...`);
    
    const relevantBatches: Array<{ batch: BatchInfo; score: number; hasKeywordMatch: boolean }> = [];

    for (let i = 0; i < this.storageIndex.batches.length; i++) {
      const batch = this.storageIndex.batches[i];
      console.log(`[ColdStorageWorker] Evaluating batch ${i + 1}/${this.storageIndex.batches.length}:`, {
        batchId: batch.batchId,
        url: batch.url,
        documentCount: batch.documentCount,
        keywords: batch.keywords,
        dateRange: batch.dateRange,
        encrypted: batch.encrypted
      });

      let score = 0;
      const scoreBreakdown: string[] = [];

      // Check keyword relevance with higher scoring for matches
      const batchKeywords = batch.keywords?.map(k => k.toLowerCase()) || [];
      console.log(`[ColdStorageWorker] Batch keywords (lowercase):`, batchKeywords);
      
      for (const term of queryTerms) {
        for (const keyword of batchKeywords) {
          if (keyword.includes(term) || term.includes(keyword)) {
            score += 10; // Higher score for keyword matches to prioritize them
            scoreBreakdown.push(`keyword match: "${term}" ↔ "${keyword}" (+10)`);
          }
        }
      }

      // Apply date filter
      if (options.dateFilter) {
        console.log(`[ColdStorageWorker] Applying date filter:`, options.dateFilter);
        const { start, end } = options.dateFilter;
        const batchStart = new Date(batch.dateRange?.start);
        const batchEnd = new Date(batch.dateRange?.end);
        const filterStart = new Date(start);
        const filterEnd = new Date(end);

        console.log(`[ColdStorageWorker] Date ranges - Batch: ${batchStart.toISOString()} to ${batchEnd.toISOString()}, Filter: ${filterStart.toISOString()} to ${filterEnd.toISOString()}`);

        // Check if batch date range overlaps with filter range
        const overlaps = batchStart <= filterEnd && batchEnd >= filterStart;
        console.log(`[ColdStorageWorker] Date overlap result:`, overlaps);
        
        if (overlaps) {
          score += 5; // Higher bonus for date relevance
          scoreBreakdown.push(`date overlap (+5)`);
        } else {
          console.log(`[ColdStorageWorker] Batch ${batch.batchId} has no date overlap but will still be searched`);
        }
      }

      // Ensure ALL batches are included with minimum base score for completeness
      const finalScore = Math.max(score, 1); // Minimum score of 1 ensures all batches are searched
      const hasKeywordMatch = score >= 10; // Track if batch had keyword matches for prioritization
      
      if (finalScore !== score) {
        scoreBreakdown.push(`base score applied (+${finalScore - score})`);
      }
      
      console.log(`[ColdStorageWorker] Batch ${batch.batchId} final score: ${finalScore} (${scoreBreakdown.join(', ') || 'base score only'})`);

      relevantBatches.push({ batch, score: finalScore, hasKeywordMatch });
      console.log(`[ColdStorageWorker] ✓ Batch ${batch.batchId} added to search queue (priority: ${hasKeywordMatch ? 'HIGH' : 'LOW'})`);
    }

    // Sort by relevance score (high-priority first) and return extended batch info
    relevantBatches.sort((a, b) => b.score - a.score);
    
    // Categorize batches for logging
    const highPriorityBatches = relevantBatches.filter(rb => rb.hasKeywordMatch);
    const lowPriorityBatches = relevantBatches.filter(rb => !rb.hasKeywordMatch);
    
    console.log(`[ColdStorageWorker] ===== COMPREHENSIVE SEARCH SUMMARY =====`);
    console.log(`[ColdStorageWorker] Total batches available: ${this.storageIndex.batches.length}`);
    console.log(`[ColdStorageWorker] ALL batches will be searched: ${relevantBatches.length}`);
    console.log(`[ColdStorageWorker] High-priority batches (keyword matches): ${highPriorityBatches.length}`);
    console.log(`[ColdStorageWorker] Low-priority batches (no keyword matches): ${lowPriorityBatches.length}`);
    console.log(`[ColdStorageWorker] Batch processing order:`, relevantBatches.map(rb => ({
      batchId: rb.batch.batchId,
      score: rb.score,
      priority: rb.hasKeywordMatch ? 'HIGH' : 'LOW'
    })));
    console.log(`[ColdStorageWorker] ===== SEARCH DIAGNOSTICS END =====`);
    
    return relevantBatches;
  }

  private async searchBatchChunk(batches: BatchInfo[], query: string): Promise<any[]> {
    console.log(`[ColdStorageWorker] ===== BATCH CHUNK PROCESSING START =====`);
    console.log(`[ColdStorageWorker] Processing chunk of ${batches.length} batches for query: "${query}"`);
    
    const chunkResults: any[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[ColdStorageWorker] Processing batch ${i + 1}/${batches.length}: ${batch.batchId}`);
      
      try {
        // Check memory usage before processing
        await this.checkMemoryUsage();

        console.log(`[ColdStorageWorker] Fetching batch data for: ${batch.batchId}`);
        // Get batch data (from cache or fetch/decrypt)
        const batchData = await this.getBatchData(batch);
        console.log(`[ColdStorageWorker] ✓ Batch data retrieved for: ${batch.batchId}`, {
          hasDocuments: !!batchData?.documents,
          documentCount: batchData?.documents?.length || 0
        });
        
        console.log(`[ColdStorageWorker] Searching content in batch: ${batch.batchId}`);
        // Search within batch
        const batchResults = await this.searchBatchContent(batchData, query, batch.batchId);
        console.log(`[ColdStorageWorker] ✓ Batch search completed for: ${batch.batchId}, found ${batchResults.length} results`);
        
        chunkResults.push(...batchResults);

      } catch (error) {
        console.error(`[ColdStorageWorker] ❌ Failed to search batch ${batch.batchId}:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          batchUrl: batch.url
        });
        // Continue with other batches
      }
    }

    console.log(`[ColdStorageWorker] ===== BATCH CHUNK PROCESSING END =====`);
    console.log(`[ColdStorageWorker] Chunk processing summary:`, {
      batchesProcessed: batches.length,
      totalResults: chunkResults.length,
      resultsPerBatch: batches.map((b) => `${b.batchId}: ${chunkResults.filter(r => r.batchId === b.batchId).length}`)
    });
    
    return chunkResults;
  }

  private async getBatchData(batch: BatchInfo): Promise<any> {
    console.log(`[ColdStorageWorker] ===== BATCH DATA RETRIEVAL START =====`);
    console.log(`[ColdStorageWorker] Getting batch data for: ${batch.batchId}`);
    console.log(`[ColdStorageWorker] Batch details:`, {
      batchId: batch.batchId,
      url: batch.url,
      documentCount: batch.documentCount,
      encrypted: batch.encrypted
    });

    // Check cache first
    if (this.batchCache.has(batch.batchId)) {
      console.log(`[ColdStorageWorker] ✓ Found ${batch.batchId} in cache`);
      const cached = this.batchCache.get(batch.batchId);
      cached.lastAccessed = Date.now();
      console.log(`[ColdStorageWorker] Cache hit - returning cached data for: ${batch.batchId}`);
      console.log(`[ColdStorageWorker] ===== BATCH DATA RETRIEVAL END =====`);
      return cached.data;
    }

    console.log(`[ColdStorageWorker] Cache miss - fetching from URL: ${batch.url}`);
    
    // Fetch batch data
    const fetchStartTime = performance.now();
    const response = await fetch(batch.url);
    const fetchEndTime = performance.now();
    
    console.log(`[ColdStorageWorker] Fetch completed in ${(fetchEndTime - fetchStartTime).toFixed(2)}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });
    
    if (!response.ok) {
      console.error(`[ColdStorageWorker] ❌ Fetch failed for ${batch.batchId}:`, {
        status: response.status,
        statusText: response.statusText,
        url: batch.url
      });
      throw new Error(`Failed to fetch batch: ${response.status} ${response.statusText}`);
    }
    
    console.log(`[ColdStorageWorker] Parsing JSON response...`);
    const rawData = await response.json();
    console.log(`[ColdStorageWorker] Raw data structure:`, {
      hasData: !!rawData.data,
      hasIv: !!rawData.iv,
      hasAlgorithm: !!rawData.algorithm,
      hasVersion: !!rawData.version,
      hasMetadata: !!rawData.metadata,
      hasDocuments: !!rawData.documents,
      keys: Object.keys(rawData)
    });
    
    let batchData;
    
    // Check if batch is encrypted or unencrypted
    // AIDEV-NOTE: Only support encrypted batches (encrypted-only policy)
    if (!this.isAuthenticated) {
      console.error(`[ColdStorageWorker] ❌ Authentication required for batch access: ${batch.batchId}`);
      throw new Error(`Authentication required for batch access: ${batch.batchId}`);
    }
    
    if (rawData.data && rawData.iv && rawData.algorithm) {
      // Encrypted batch - decrypt it
      console.log(`[ColdStorageWorker] ✓ Detected encrypted batch format: ${batch.batchId}`);
      console.log(`[ColdStorageWorker] Encryption details:`, {
        algorithm: rawData.algorithm,
        version: rawData.version,
        hasChecksum: !!rawData.checksum
      });
      console.log(`[ColdStorageWorker] Starting decryption process...`);
      
      const decryptStartTime = performance.now();
      batchData = await this.decryptBatch(rawData);
      const decryptEndTime = performance.now();
      
      console.log(`[ColdStorageWorker] ✓ Decryption completed in ${(decryptEndTime - decryptStartTime).toFixed(2)}ms`);
      console.log(`[ColdStorageWorker] Decrypted data structure:`, {
        hasDocuments: !!batchData?.documents,
        documentCount: batchData?.documents?.length || 0,
        hasMetadata: !!batchData?.metadata
      });
      
    } else if (rawData.documents) {
      // Unencrypted batch - not supported in encrypted-only mode
      console.error(`[ColdStorageWorker] ❌ Unencrypted batch detected: ${batch.batchId} - violates encrypted-only policy`);
      console.log(`[ColdStorageWorker] Raw data indicates unencrypted format:`, {
        hasDocuments: !!rawData.documents,
        documentCount: rawData.documents?.length || 0,
        encryptedField: rawData.metadata?.encrypted
      });
      throw new Error(`Invalid batch format for ${batch.batchId}: only encrypted batches are supported`);
    } else {
      console.error(`[ColdStorageWorker] ❌ Unknown batch format for: ${batch.batchId}`);
      console.log(`[ColdStorageWorker] Expected either encrypted format (data+iv+algorithm) or documents array`);
      throw new Error(`Invalid batch format for ${batch.batchId}: unrecognized data structure`);
    }

    // Add to cache
    console.log(`[ColdStorageWorker] Adding ${batch.batchId} to cache...`);
    this.addToCache(batch.batchId, batchData);
    console.log(`[ColdStorageWorker] ✓ Batch ${batch.batchId} cached successfully`);
    console.log(`[ColdStorageWorker] ===== BATCH DATA RETRIEVAL END =====`);

    return batchData;
  }


  private async decryptBatch(encryptedBatch: EncryptedBatch): Promise<any> {
    if (!this.encryptionService.isInitialized()) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Use EncryptionService to decrypt the batch
      const batchData = await this.encryptionService.decryptBatch(encryptedBatch);
      return batchData;

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

  /**
   * Search batches with progress reporting and phase tracking
   * AIDEV-NOTE: Supports comprehensive search with real-time progress updates
   */
  private async searchBatchesWithProgress(batches: BatchInfo[], query: string, messageId?: string, phase: string = 'search'): Promise<any[]> {
    const allResults: any[] = [];
    let completedBatches = 0;
    
    console.log(`[ColdStorageWorker] Starting ${phase} phase: processing ${batches.length} batches`);

    // Process batches in chunks to manage memory
    for (let i = 0; i < batches.length; i += this.MAX_CONCURRENT_BATCHES) {
      const batchChunk = batches.slice(i, i + this.MAX_CONCURRENT_BATCHES);
      console.log(`[ColdStorageWorker] ${phase} - Processing chunk ${Math.floor(i / this.MAX_CONCURRENT_BATCHES) + 1}:`, {
        phase,
        chunkSize: batchChunk.length,
        batchIds: batchChunk.map(b => b.batchId)
      });
      
      // Search chunk of batches
      const chunkResults = await this.searchBatchChunk(batchChunk, query);
      console.log(`[ColdStorageWorker] ${phase} - Chunk returned ${chunkResults.length} results`);
      allResults.push(...chunkResults);

      completedBatches += batchChunk.length;

      // Report progress with phase information
      if (messageId) {
        this.postMessage({
          type: 'cold-search-progress',
          id: messageId,
          payload: { 
            message: `${phase === 'high-priority' ? 'Phase 1' : 'Phase 2'}: Searched ${completedBatches}/${batches.length} batches...`,
            totalBatches: batches.length,
            completedBatches,
            currentPhase: phase,
            partialResults: chunkResults
          }
        });
      }

      // Yield control to prevent blocking
      await this.yieldControl();
    }

    console.log(`[ColdStorageWorker] ${phase} phase completed: ${allResults.length} results from ${batches.length} batches`);
    return allResults;
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

  /**
   * Validate that all batches in storage index are encrypted (encrypted-only policy)
   * AIDEV-NOTE: Enforces security policy that all cold storage must be encrypted
   */
  private validateStorageIndexEncryption() {
    if (!this.storageIndex || !this.storageIndex.batches) {
      return; // No batches to validate
    }
    
    // Check encryption policy in metadata
    const encryptionPolicy = this.storageIndex.metadata?.encryptionPolicy;
    if (encryptionPolicy !== 'required') {
      console.warn('[ColdStorageWorker] Storage index does not enforce encryption policy');
    }
    
    // Validate each batch
    const unencryptedBatches = this.storageIndex.batches.filter(batch => 
      batch.hasOwnProperty('encrypted') && batch.encrypted === false
    );
    
    if (unencryptedBatches.length > 0) {
      const batchIds = unencryptedBatches.map(b => b.batchId).join(', ');
      throw new Error(`Encrypted-only policy violation: Found unencrypted batches: ${batchIds}`);
    }
    
    console.log('[ColdStorageWorker] Storage index encryption validation passed:', {
      totalBatches: this.storageIndex.batches.length,
      encryptionPolicy: encryptionPolicy
    });
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

  // AIDEV-NOTE: Utility methods delegated to EncryptionService for consistency

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
console.log('[ColdStorageWorker] Initializing worker instance...');

try {
  console.log('[ColdStorageWorker] Creating ColdStorageWorker instance...');
  const coldStorageWorker = new ColdStorageWorker();
  console.log('[ColdStorageWorker] ColdStorageWorker instance created successfully');

  // Handle messages from main thread
  console.log('[ColdStorageWorker] Setting up message handler...');
  self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    console.log('[ColdStorageWorker] Message received from main thread:', {
      type: event.data?.type,
      id: event.data?.id,
      hasPayload: !!event.data?.payload
    });
    
    try {
      coldStorageWorker.handleMessage(event);
    } catch (error) {
      console.error('[ColdStorageWorker] Fatal error in message handler:', error);
      self.postMessage({
        type: 'worker-error',
        payload: { 
          message: `Worker message handler failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error instanceof Error ? error.name : 'UnknownError',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  };
  
  console.log('[ColdStorageWorker] Message handler setup completed');
  console.log('[ColdStorageWorker] Worker initialization completed successfully');
  
  // Send ready signal to main thread
  self.postMessage({
    type: 'worker-ready',
    payload: { 
      message: 'Cold storage worker initialized and ready',
      timestamp: new Date().toISOString()
    }
  });
  
} catch (error) {
  console.error('[ColdStorageWorker] Fatal error during worker initialization:', error);
  
  // Send error to main thread
  self.postMessage({
    type: 'worker-fatal-error',
    payload: {
      message: `Worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined
    }
  });
}