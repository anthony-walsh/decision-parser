/**
 * Hot Storage Service
 * 
 * Main thread interface for hot storage operations using SQLite worker.
 * Handles recent documents with <100ms search response times.
 */

export class HotStorageService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.isAuthenticated = false;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  /**
   * Initialize hot storage worker
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create worker
      this.worker = new Worker('/src/workers/hotStorageWorker.ts', { 
        type: 'module' 
      });

      // Set up message handling
      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Hot storage worker error:', error);
      };

      // Wait for initialization
      await this.waitForInitialization();
      this.isInitialized = true;

    } catch (error) {
      console.error('Failed to initialize hot storage service:', error);
      throw new Error('Hot storage initialization failed');
    }
  }

  /**
   * Authenticate worker with encryption key
   */
  async authenticate(keyMaterial) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      await this.sendMessage('auth-init', { keyMaterial });
      this.isAuthenticated = true;
    } catch (error) {
      console.error('Hot storage authentication failed:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Store document and search index
   */
  async storeDocument(document, searchIndex) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const result = await this.sendMessage('store-document', {
        document,
        searchIndex
      });

      return result;
    } catch (error) {
      console.error('Failed to store document:', error);
      throw new Error(`Document storage failed: ${error.message}`);
    }
  }

  /**
   * Search documents with FTS5
   */
  async searchDocuments(query, options = {}) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const result = await this.sendMessage('search-documents', {
        query,
        options
      });

      return {
        results: result.results || [],
        total: result.total || 0,
        query: result.query,
        fallback: result.fallback || false
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const result = await this.sendMessage('get-stats');
      return result.stats;
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw new Error(`Stats retrieval failed: ${error.message}`);
    }
  }

  /**
   * Update document access tracking
   */
  async updateDocumentAccess(documentId) {
    if (!this.isAuthenticated) {
      return; // Non-critical operation, don't throw
    }

    try {
      await this.sendMessage('update-access', { documentId });
    } catch (error) {
      console.warn('Failed to update document access:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Get migration candidates for hot-to-cold storage
   */
  async getMigrationCandidates(maxCandidates = 1000, ageDays = 90, maxAccessCount = 5) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const result = await this.sendMessage('get-migration-candidates', {
        maxCandidates,
        ageDays,
        maxAccessCount
      });

      return result.candidates || [];
    } catch (error) {
      console.error('Failed to get migration candidates:', error);
      throw new Error(`Migration candidates retrieval failed: ${error.message}`);
    }
  }

  /**
   * Delete document from hot storage
   */
  async deleteDocument(documentId) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const result = await this.sendMessage('delete-document', { documentId });
      return result.deleted;
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw new Error(`Document deletion failed: ${error.message}`);
    }
  }

  /**
   * Check if hot storage is at capacity
   */
  async isAtCapacity(limit = 5000) {
    try {
      const stats = await this.getStats();
      return stats.total_documents >= limit;
    } catch (error) {
      console.warn('Failed to check capacity:', error);
      return false;
    }
  }

  /**
   * Send message to worker and wait for response
   */
  async sendMessage(type, payload = {}) {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const id = `msg_${++this.messageId}`;
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error('Message timeout'));
      }, 30000); // 30 second timeout

      this.pendingMessages.set(id, { resolve, reject, timeout });

      this.worker.postMessage({
        type,
        id,
        payload
      });
    });
  }

  /**
   * Handle messages from worker
   */
  handleWorkerMessage(message) {
    const { type, id, payload } = message;

    if (id && this.pendingMessages.has(id)) {
      const { resolve, reject, timeout } = this.pendingMessages.get(id);
      clearTimeout(timeout);
      this.pendingMessages.delete(id);

      if (type === 'error') {
        reject(new Error(payload.message || 'Unknown worker error'));
      } else {
        resolve(payload);
      }
      return;
    }

    // Handle non-response messages
    switch (type) {
      case 'init-complete':
        this.isInitialized = true;
        break;

      case 'auth-complete':
        this.isAuthenticated = true;
        break;

      case 'error':
        console.error('Hot storage worker error:', payload);
        break;

      default:
        console.log('Unhandled worker message:', message);
    }
  }

  /**
   * Wait for worker initialization
   */
  async waitForInitialization() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Initialization timeout'));
      }, 10000);

      const checkInit = () => {
        if (this.isInitialized) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkInit, 100);
        }
      };

      checkInit();
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    this.isAuthenticated = false;
    this.pendingMessages.clear();
  }

  /**
   * Get current service state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isAuthenticated: this.isAuthenticated,
      hasWorker: !!this.worker,
      pendingMessages: this.pendingMessages.size
    };
  }
}

// Export singleton instance
export const hotStorageService = new HotStorageService();