/**
 * Hot Storage Worker with SQLite FTS5
 * 
 * Handles recent documents (up to 5,000) using SQLite with full-text search.
 * Provides <100ms search response times for immediate user feedback.
 */

// @ts-ignore - sql.js and absurd-sql don't have proper TypeScript definitions
import initSqlJs from 'sql.js';
// @ts-ignore
import { SQLiteFS } from 'absurd-sql';
// @ts-ignore
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';

// AIDEV-NOTE: Worker types for message handling
interface WorkerMessage {
  type: string;
  id?: string;
  payload: any;
}

// Remove unused interfaces - handled by base WorkerMessage

class HotStorageWorker {
  private db: any = null;
  private isInitialized = false;
  // Authentication state removed as not needed in hot storage
  private SQL: any = null;
  
  // AIDEV-NOTE: Precompiled statements cache for <100ms performance
  private statements: { [key: string]: any } = {};

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      // Initialize SQL.js with WASM
      this.SQL = await initSqlJs({
        locateFile: (file: string) => `/sql-wasm/${file}`
      });

      // Set up SQLite filesystem with IndexedDB backend
      const sqlFS = new SQLiteFS(this.SQL.FS, new IndexedDBBackend());
      this.SQL.register_for_idb(sqlFS);

      // Create/open database
      this.db = new this.SQL.Database('/hot-storage.db', { filename: true });

      // Configure SQLite for optimal performance
      await this.configureDatabase();

      // Create tables and indexes
      await this.createSchema();

      this.isInitialized = true;
      this.postMessage({
        type: 'init-complete',
        payload: { success: true }
      });

    } catch (error) {
      console.error('Hot storage worker initialization failed:', error);
      this.postMessage({
        type: 'error',
        payload: { 
          message: `Hot storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error instanceof Error ? error.name : 'UnknownError'
        }
      });
    }
  }

  private async configureDatabase() {
    // AIDEV-NOTE: Enhanced SQLite configuration for <100ms search performance
    const pragmas = [
      'PRAGMA cache_size = -32768',      // 32MB page cache for faster queries
      'PRAGMA journal_mode = WAL',       // Write-ahead logging
      'PRAGMA synchronous = NORMAL',     // Balanced durability/performance
      'PRAGMA mmap_size = 134217728',    // 128MB memory-mapped I/O
      'PRAGMA temp_store = memory',      // Temp tables in memory
      'PRAGMA page_size = 4096',         // Optimal page size for performance
      'PRAGMA read_uncommitted = true',  // Faster reads (acceptable for search)
      'PRAGMA query_only = false',       // Allow writes
      'PRAGMA optimize'                  // Query optimizer
    ];

    for (const pragma of pragmas) {
      this.db.exec(pragma);
    }

    // AIDEV-NOTE: Precompile common statements for performance
    this.precompileStatements();
  }

  private precompileStatements() {
    // AIDEV-NOTE: Precompile frequently used SQL statements for faster execution
    try {
      // Fast search statement for hot path
      this.statements.fastSearch = this.db.prepare(`
        SELECT 
          d.id,
          d.filename,
          d.size,
          d.upload_date,
          d.metadata,
          d.page_count,
          snippet(content_fts, 1, '<mark>', '</mark>', '...', 16) as snippet,
          bm25(content_fts) as relevance
        FROM content_fts
        JOIN documents d ON content_fts.doc_id = d.id
        WHERE content_fts MATCH ?
        ORDER BY relevance
        LIMIT ?
      `);

      // Stats query
      this.statements.getStats = this.db.prepare(`
        SELECT 
          COUNT(*) as documentCount,
          COUNT(*) as indexedCount,
          SUM(d.size) as totalSize
        FROM documents d
      `);

      // Document insertion
      this.statements.insertDocument = this.db.prepare(`
        INSERT OR REPLACE INTO documents 
        (id, filename, size, upload_date, processing_status, metadata, page_count, last_accessed, access_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Search index insertion
      this.statements.insertSearchIndex = this.db.prepare(`
        INSERT OR REPLACE INTO search_index (doc_id, content, metadata)
        VALUES (?, ?, ?)
      `);

      // Update access tracking (optimized)
      this.statements.updateAccess = this.db.prepare(`
        UPDATE documents 
        SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1 
        WHERE id = ?
      `);

    } catch (error) {
      console.error('Failed to precompile statements:', error);
    }
  }

  private async createSchema() {
    const schema = `
      -- Documents table
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        size INTEGER NOT NULL,
        upload_date TEXT NOT NULL,
        processing_status TEXT NOT NULL,
        metadata TEXT, -- JSON blob
        page_count INTEGER,
        last_accessed TEXT DEFAULT CURRENT_TIMESTAMP,
        access_count INTEGER DEFAULT 0
      );

      -- Search index table
      CREATE TABLE IF NOT EXISTS search_index (
        doc_id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT, -- JSON blob for search metadata
        FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      -- FTS5 virtual table for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
        doc_id,
        content,
        metadata,
        tokenize='porter ascii',
        content='search_index',
        content_rowid='doc_id'
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date);
      CREATE INDEX IF NOT EXISTS idx_documents_last_accessed ON documents(last_accessed);
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
      CREATE INDEX IF NOT EXISTS idx_documents_access_count ON documents(access_count);

      -- Triggers to maintain FTS index
      CREATE TRIGGER IF NOT EXISTS search_index_insert AFTER INSERT ON search_index BEGIN
        INSERT INTO content_fts(doc_id, content, metadata) 
        VALUES (new.doc_id, new.content, new.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS search_index_delete AFTER DELETE ON search_index BEGIN
        DELETE FROM content_fts WHERE doc_id = old.doc_id;
      END;

      CREATE TRIGGER IF NOT EXISTS search_index_update AFTER UPDATE ON search_index BEGIN
        DELETE FROM content_fts WHERE doc_id = old.doc_id;
        INSERT INTO content_fts(doc_id, content, metadata) 
        VALUES (new.doc_id, new.content, new.metadata);
      END;
    `;

    this.db.exec(schema);
  }

  public async handleMessage(event: MessageEvent<WorkerMessage>) {
    const { type, id, payload } = event.data;

    try {
      switch (type) {
        case 'auth-init':
          await this.handleAuthInit(payload);
          break;

        case 'store-document':
          await this.handleStoreDocument(payload, id);
          break;

        case 'get-document':
          await this.handleGetDocument(payload, id);
          break;

        case 'search-documents':
          await this.handleSearchDocuments(payload, id);
          break;

        case 'get-stats':
          await this.handleGetStats(id);
          break;

        case 'delete-document':
          await this.handleDeleteDocument(payload, id);
          break;

        case 'update-access':
          await this.handleUpdateAccess(payload, id);
          break;

        case 'get-migration-candidates':
          await this.handleGetMigrationCandidates(payload, id);
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

  private async handleAuthInit(payload: any) {
    try {
      if (payload.keyMaterial) {
        // Store key material for potential future use (if needed)
        // Authentication successful - hot storage doesn't need to track auth state
        this.postMessage({
          type: 'auth-complete',
          payload: { success: true }
        });
      } else {
        throw new Error('No key material provided');
      }
    } catch (error) {
      this.postMessage({
        type: 'auth-error',
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async handleGetDocument(payload: any, id?: string) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const { documentId } = payload;

    const stmt = this.db.prepare(`
      SELECT 
        d.id, d.filename, d.size, d.upload_date, d.processing_status,
        d.metadata, d.page_count, d.last_accessed, d.access_count,
        si.content
      FROM documents d
      LEFT JOIN search_index si ON d.id = si.doc_id
      WHERE d.id = ?
    `);

    const result = stmt.get([documentId]);

    if (result) {
      // Update access count
      const updateStmt = this.db.prepare(`
        UPDATE documents 
        SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1 
        WHERE id = ?
      `);
      updateStmt.run([documentId]);

      this.postMessage({
        type: 'get-document-complete',
        id,
        payload: { 
          document: {
            ...result,
            metadata: JSON.parse(result.metadata || '{}')
          }
        }
      });
    } else {
      this.postMessage({
        type: 'get-document-complete',
        id,
        payload: { document: null }
      });
    }
  }

  private async handleStoreDocument(payload: any, id?: string) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const { document, searchIndex } = payload;

    // AIDEV-NOTE: Use fast transaction for document storage
    this.db.exec('BEGIN IMMEDIATE');

    try {
      // Use precompiled statements for faster insertion
      this.statements.insertDocument.run([
        document.id,
        document.filename,
        document.size,
        document.uploadDate?.toISOString() || new Date().toISOString(),
        document.processingStatus || 'completed',
        JSON.stringify(document.metadata || {}),
        document.metadata?.pageCount || 0,
        new Date().toISOString(),
        1
      ]);

      this.statements.insertSearchIndex.run([
        document.id,
        searchIndex.content || '',
        JSON.stringify(searchIndex.metadata || {})
      ]);

      // Commit transaction
      this.db.exec('COMMIT');

      this.postMessage({
        type: 'store-complete',
        id,
        payload: { success: true, documentId: document.id }
      });

    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private async handleSearchDocuments(payload: any, id?: string) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const { query, options = {} } = payload;
    const { limit = 50 } = options;

    try {
      // AIDEV-NOTE: Use precompiled statement for fast search (<100ms target)
      const startTime = performance.now();
      
      // Optimize query for FTS5 
      const ftsQuery = this.optimizeFTSQuery(query);
      
      // Execute fast search using precompiled statement
      const results = this.statements.fastSearch.all([ftsQuery, limit]);

      // Batch update access counts for performance
      if (results.length > 0) {
        // Use transaction for batch updates
        this.db.exec('BEGIN IMMEDIATE');
        try {
          for (const result of results) {
            this.statements.updateAccess.run([result.id]);
          }
          this.db.exec('COMMIT');
        } catch (updateError) {
          this.db.exec('ROLLBACK');
          // Don't fail search if access tracking fails
          console.warn('Failed to update access counts:', updateError);
        }
      }

      // Parse metadata JSON (optimized)
      const processedResults = this.processSearchResults(results);

      const searchTime = performance.now() - startTime;
      console.log(`Hot storage search completed in ${searchTime.toFixed(2)}ms`);

      this.postMessage({
        type: 'search-complete',
        id,
        payload: { 
          results: processedResults,
          query,
          total: processedResults.length,
          searchTime: Math.round(searchTime),
          source: 'hot-storage'
        }
      });

    } catch (error) {
      // Fallback to simple LIKE search if FTS fails
      console.warn('FTS search failed, falling back to LIKE search:', error);
      await this.handleFallbackSearch(query, options, id);
    }
  }

  private optimizeFTSQuery(query: string): string {
    // AIDEV-NOTE: Optimize FTS5 query for better performance and relevance
    const trimmed = query.trim();
    
    // Handle quoted phrases
    if (trimmed.includes('"')) {
      return trimmed;
    }
    
    // For multi-word queries, use AND operator for precision
    const words = trimmed.split(/\s+/).filter(word => word.length > 2);
    if (words.length > 1) {
      return words.join(' AND ');
    }
    
    // Single word query with prefix matching for partial matches
    return words.length === 1 ? `${words[0]}*` : trimmed;
  }

  private processSearchResults(results: any[]): any[] {
    // AIDEV-NOTE: Optimized result processing for performance
    return results.map((result: any) => {
      let metadata;
      try {
        metadata = JSON.parse(result.metadata || '{}');
      } catch {
        metadata = {};
      }
      
      return {
        document: {
          id: result.id,
          filename: result.filename,
          size: result.size,
          uploadDate: new Date(result.upload_date),
          metadata
        },
        matches: [{
          content: result.snippet || '',
          score: result.relevance || 0
        }],
        overallScore: result.relevance || 0,
        tier: 'hot',
        isRecent: true
      };
    });
  }

  private async handleFallbackSearch(query: string, options: any, id?: string) {
    const { limit = 50, offset = 0 } = options;

    const sql = `
      SELECT 
        d.id,
        d.filename,
        d.size,
        d.upload_date,
        d.metadata,
        d.page_count,
        d.last_accessed,
        substr(si.content, 1, 200) as snippet
      FROM documents d
      JOIN search_index si ON d.id = si.doc_id
      WHERE si.content LIKE ?
      ORDER BY d.last_accessed DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db.prepare(sql);
    const results = stmt.all([`%${query}%`, limit, offset]);

    const processedResults = results.map((result: any) => ({
      ...result,
      metadata: JSON.parse(result.metadata || '{}'),
      tier: 'hot',
      isRecent: true,
      relevance: 0.5 // Default relevance for fallback search
    }));

    this.postMessage({
      type: 'search-complete',
      id,
      payload: { 
        results: processedResults,
        query,
        total: processedResults.length,
        fallback: true
      }
    });
  }

  private async handleGetStats(id?: string) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    // AIDEV-NOTE: Use precompiled statement for fast stats retrieval
    const stats = this.statements.getStats.get();

    this.postMessage({
      type: 'stats-complete',
      id,
      payload: { 
        stats: {
          documentCount: stats.documentCount || 0,
          indexedCount: stats.indexedCount || 0,
          totalSize: stats.totalSize || 0
        }
      }
    });
  }

  private async handleGetMigrationCandidates(payload: any, id?: string) {
    const { maxCandidates = 1000, ageDays = 90, maxAccessCount = 5 } = payload;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ageDays);

    const sql = `
      SELECT 
        id, filename, size, upload_date, last_accessed, access_count,
        metadata, page_count
      FROM documents
      WHERE upload_date < ? 
        AND (access_count IS NULL OR access_count < ?)
      ORDER BY last_accessed ASC, access_count ASC
      LIMIT ?
    `;

    const stmt = this.db.prepare(sql);
    const candidates = stmt.all([
      cutoffDate.toISOString(),
      maxAccessCount,
      maxCandidates
    ]);

    const processedCandidates = candidates.map((candidate: any) => ({
      ...candidate,
      metadata: JSON.parse(candidate.metadata || '{}')
    }));

    this.postMessage({
      type: 'migration-candidates-complete',
      id,
      payload: { candidates: processedCandidates }
    });
  }

  private async handleUpdateAccess(payload: any, id?: string) {
    const { documentId } = payload;

    const stmt = this.db.prepare(`
      UPDATE documents 
      SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1 
      WHERE id = ?
    `);

    stmt.run([documentId]);

    this.postMessage({
      type: 'access-updated',
      id,
      payload: { success: true, documentId }
    });
  }

  private async handleDeleteDocument(payload: any, id?: string) {
    const { documentId } = payload;

    this.db.exec('BEGIN TRANSACTION');

    try {
      // Delete from documents table (cascade will handle search_index and content_fts)
      const stmt = this.db.prepare('DELETE FROM documents WHERE id = ?');
      const result = stmt.run([documentId]);

      this.db.exec('COMMIT');

      this.postMessage({
        type: 'delete-complete',
        id,
        payload: { 
          success: result.changes > 0, 
          documentId,
          deleted: result.changes > 0
        }
      });

    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private postMessage(message: any) {
    self.postMessage(message);
  }
}

// Initialize worker
const hotStorageWorker = new HotStorageWorker();

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  (hotStorageWorker as any).handleMessage(event);
};