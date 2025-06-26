/**
 * Migration Worker - Background processing for document tier migration
 * 
 * Handles:
 * - Background document migration from hot to cold storage
 * - Batch processing with progress reporting
 * - Document encryption and batch creation
 * - Error handling and recovery for failed migrations
 * 
 * AIDEV-NOTE: Worker handles document migration operations in background
 */

import { EncryptionService } from '../services/EncryptionService';

// Worker state
let encryptionService: EncryptionService;
let isInitialized = false;
let activeMigrations = new Map<string, MigrationTask>();

// Types for worker messages
interface WorkerMessage {
  id?: string;
  type: string;
  payload: any;
}

interface MigrationTask {
  migrationId: string;
  batchId: string;
  documents: DocumentCandidate[];
  startTime: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    processed: number;
    total: number;
    currentDocument?: string;
  };
  results: {
    migratedDocuments: string[];
    failedDocuments: string[];
    errors: string[];
  };
}

interface DocumentCandidate {
  id: string;
  filename: string;
  upload_date: string;
  last_accessed: string | null;
  access_count: number;
  size: number;
  metadata?: any;
  content?: string; // Added during migration process
}

/**
 * Initialize migration worker with encryption service
 */
async function initialize(keyMaterial: ArrayBuffer): Promise<void> {
  try {
    encryptionService = new EncryptionService();
    await encryptionService.initialize(keyMaterial);
    
    isInitialized = true;
    console.log('Migration worker initialized successfully');
    
    postMessage({
      type: 'worker-ready',
      payload: { success: true }
    });
  } catch (error) {
    console.error('Failed to initialize migration worker:', error);
    throw error;
  }
}

/**
 * Process a batch of documents for migration
 */
async function migrateBatch(migrationId: string, batchId: string, documents: DocumentCandidate[]): Promise<any> {
  if (!isInitialized) {
    throw new Error('Migration worker not initialized');
  }

  const task: MigrationTask = {
    migrationId,
    batchId,
    documents,
    startTime: performance.now(),
    status: 'processing',
    progress: {
      processed: 0,
      total: documents.length
    },
    results: {
      migratedDocuments: [],
      failedDocuments: [],
      errors: []
    }
  };

  activeMigrations.set(batchId, task);

  try {
    console.log(`Starting migration batch ${batchId} with ${documents.length} documents`);
    
    // Process documents in smaller chunks to avoid memory issues
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < documents.length; i += chunkSize) {
      chunks.push(documents.slice(i, i + chunkSize));
    }

    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      postMessage({
        type: 'migration-progress',
        payload: {
          migrationId,
          batchId,
          chunkIndex: chunkIndex + 1,
          totalChunks: chunks.length,
          chunkSize: chunk.length,
          processed: task.progress.processed,
          total: task.progress.total
        }
      });

      await processDocumentChunk(task, chunk);
      
      // Yield control between chunks
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Create encrypted batch for cold storage
    if (task.results.migratedDocuments.length > 0) {
      await createColdStorageBatch(task);
    }

    task.status = 'completed';
    const endTime = performance.now();
    const migrationTime = endTime - task.startTime;

    console.log(`Migration batch ${batchId} completed in ${migrationTime.toFixed(2)}ms`);
    console.log(`Migrated: ${task.results.migratedDocuments.length}, Failed: ${task.results.failedDocuments.length}`);

    return {
      migrationId,
      batchId,
      migratedCount: task.results.migratedDocuments.length,
      failedCount: task.results.failedDocuments.length,
      migratedDocuments: task.results.migratedDocuments,
      errors: task.results.errors,
      migrationTime
    };

  } catch (error) {
    task.status = 'failed';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    task.results.errors.push(`Batch migration failed: ${errorMessage}`);
    
    console.error(`Migration batch ${batchId} failed:`, error);
    throw error;
  } finally {
    activeMigrations.delete(batchId);
  }
}

/**
 * Process a chunk of documents
 */
async function processDocumentChunk(task: MigrationTask, chunk: DocumentCandidate[]): Promise<void> {
  for (const document of chunk) {
    try {
      task.progress.currentDocument = document.filename;
      
      // Fetch document content from hot storage
      const documentWithContent = await fetchDocumentContent(document);
      
      // Validate document before migration
      if (!validateDocumentForMigration(documentWithContent)) {
        task.results.failedDocuments.push(document.id);
        task.results.errors.push(`Document ${document.id} failed validation`);
        continue;
      }

      // Add to migration batch (content will be encrypted later)
      task.results.migratedDocuments.push(document.id);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      task.results.failedDocuments.push(document.id);
      task.results.errors.push(`Document ${document.id}: ${errorMessage}`);
      console.error(`Failed to process document ${document.id}:`, error);
    }

    task.progress.processed++;
    
    // Report progress every 5 documents
    if (task.progress.processed % 5 === 0) {
      postMessage({
        type: 'migration-progress',
        payload: {
          migrationId: task.migrationId,
          batchId: task.batchId,
          processed: task.progress.processed,
          total: task.progress.total,
          currentDocument: task.progress.currentDocument
        }
      });
    }
  }
}

/**
 * Fetch document content from hot storage (simulated)
 */
async function fetchDocumentContent(document: DocumentCandidate): Promise<DocumentCandidate> {
  // AIDEV-NOTE: This would normally fetch from hot storage SQLite
  // For now, simulate content fetching
  return {
    ...document,
    content: `Document content for ${document.filename} - ${document.id}`
  };
}

/**
 * Validate document for migration
 */
function validateDocumentForMigration(document: DocumentCandidate): boolean {
  // Check required fields
  if (!document.id || !document.filename || !document.content) {
    return false;
  }

  // Check content size (avoid migrating empty documents)
  if (document.content.length < 10) {
    return false;
  }

  // Additional validation rules can be added here
  return true;
}

/**
 * Create encrypted batch for cold storage
 */
async function createColdStorageBatch(task: MigrationTask): Promise<void> {
  try {
    // Prepare batch data
    const batchData = {
      batchId: task.batchId,
      migrationId: task.migrationId,
      created: new Date().toISOString(),
      documents: task.documents.filter(doc => 
        task.results.migratedDocuments.includes(doc.id)
      ).map(doc => ({
        id: doc.id,
        filename: doc.filename,
        size: doc.size,
        upload_date: doc.upload_date,
        last_accessed: doc.last_accessed,
        access_count: doc.access_count,
        metadata: doc.metadata,
        content: doc.content || `Content for ${doc.filename}`
      })),
      metadata: {
        migrationDate: new Date().toISOString(),
        originalLocation: 'hot-storage',
        migrationReason: 'automatic-lifecycle-management'
      }
    };

    // Encrypt batch
    const encryptedBatch = await encryptionService.encryptBatch(batchData);
    
    // Store encrypted batch (would normally save to cold storage location)
    console.log(`Created encrypted batch ${task.batchId} with ${batchData.documents.length} documents`);
    console.log(`Encrypted batch size: ${encryptedBatch.metadata?.encryptedSize || 'unknown'} bytes`);
    
    // Notify about successful batch creation
    postMessage({
      type: 'batch-created',
      payload: {
        migrationId: task.migrationId,
        batchId: task.batchId,
        documentCount: batchData.documents.length,
        batchSize: encryptedBatch.metadata?.encryptedSize || 0
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    task.results.errors.push(`Failed to create encrypted batch: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get migration statistics
 */
function getMigrationStats(): any {
  const activeTasks = Array.from(activeMigrations.values());
  
  return {
    activeMigrations: activeTasks.length,
    totalProcessed: activeTasks.reduce((sum, task) => sum + task.progress.processed, 0),
    totalDocuments: activeTasks.reduce((sum, task) => sum + task.progress.total, 0),
    tasks: activeTasks.map(task => ({
      migrationId: task.migrationId,
      batchId: task.batchId,
      status: task.status,
      progress: task.progress,
      elapsed: performance.now() - task.startTime
    }))
  };
}

/**
 * Cancel active migration
 */
function cancelMigration(migrationId: string): boolean {
  let cancelled = false;
  
  for (const [batchId, task] of activeMigrations) {
    if (task.migrationId === migrationId) {
      task.status = 'failed';
      task.results.errors.push('Migration cancelled by user');
      activeMigrations.delete(batchId);
      cancelled = true;
    }
  }
  
  return cancelled;
}

/**
 * Cleanup migration resources
 */
function cleanup(): void {
  activeMigrations.clear();
  if (encryptionService) {
    encryptionService.clearKey();
  }
  isInitialized = false;
}

// Worker message handler
self.onmessage = async function(event: MessageEvent<WorkerMessage>) {
  const { id, type, payload } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'initialize':
        await initialize(payload.keyMaterial);
        result = { success: true };
        break;
        
      case 'migrate-batch':
        result = await migrateBatch(
          payload.migrationId,
          payload.batchId,
          payload.documents
        );
        break;
        
      case 'get-migration-stats':
        result = getMigrationStats();
        break;
        
      case 'cancel-migration':
        result = { cancelled: cancelMigration(payload.migrationId) };
        break;
        
      case 'cleanup':
        cleanup();
        result = { success: true };
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    // Send success response
    if (id) {
      self.postMessage({
        id,
        type: 'success',
        payload: result
      });
    }
    
  } catch (error) {
    // Send error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (id) {
      self.postMessage({
        id,
        type: 'error',
        payload: {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    }
    
    // Also send migration error event
    self.postMessage({
      type: 'migration-error',
      payload: {
        message: errorMessage,
        migrationId: payload?.migrationId,
        batchId: payload?.batchId
      }
    });
  }
};

// Handle worker errors
self.onerror = function(event) {
  console.error('Migration worker error:', event);
  const errorEvent = event as ErrorEvent;
  self.postMessage({
    type: 'worker-error',
    payload: {
      message: errorEvent.message || 'Unknown worker error',
      filename: errorEvent.filename || '',
      lineno: errorEvent.lineno || 0
    }
  });
};

// Cleanup on termination
self.onbeforeunload = function() {
  cleanup();
};

console.log('Migration worker loaded and ready');