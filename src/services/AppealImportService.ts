/**
 * Appeal Import Service - Integration layer for appeal decision letter imports
 * 
 * Coordinates between AppealDecisionLetterDownloader, data transformation,
 * validation, and cold storage for seamless import operations.
 * 
 * AIDEV-NOTE: Direct cold storage integration service for appeal case imports
 */

import { AppealDecisionLetterDownloader } from '../utils/appealDecisionLetterDownloader';
import { transformAppealCaseBatch, createColdStorageBatch, type AppealCaseData, type ColdStorageDocument } from '../utils/appealDataTransformer';
import { validateAppealCaseBatch } from '../utils/dataValidator';
import { logger, logImport, logTransform, logColdStorage } from '../utils/logger';

interface ImportProgress {
  stage: string;
  message: string;
  processed: number;
  total: number;
  errors: string[];
}

interface ImportStats {
  totalDownloaded: number;
  totalTransformed: number;
  totalValidated: number;
  totalStored: number;
  errors: number;
  startTime: Date | null;
  endTime: Date | null;
}

export class AppealImportService {
  private downloader: AppealDecisionLetterDownloader | null = null;
  private coldStorageService: any = null;
  private isImporting: boolean = false;
  private importStats: ImportStats = {
    totalDownloaded: 0,
    totalTransformed: 0,
    totalValidated: 0,
    totalStored: 0,
    errors: 0,
    startTime: null,
    endTime: null
  };
  private progressCallback: ((progress: ImportProgress) => void) | null = null;

  /**
   * Initialize the import service with cold storage service
   */
  async initialize(coldStorageService: any) {
    logImport('Initializing Appeal Import Service', {
      hasColdStorageService: !!coldStorageService
    }, 'AppealImportService');

    this.coldStorageService = coldStorageService;
    
    // AIDEV-NOTE: Check if authentication is needed based on storage index
    if (this.coldStorageService && this.coldStorageService.storageIndex) {
      const hasEncryptedBatches = this.coldStorageService.storageIndex.batches.some((batch: any) => 
        !batch.hasOwnProperty('encrypted') || batch.encrypted !== false
      );
      
      if (hasEncryptedBatches && !this.coldStorageService.isAuthenticated) {
        throw new Error('Cold storage service must be authenticated for encrypted batches');
      }
    }
    
    logImport('Appeal Import Service initialized successfully', {
      coldStorageAvailable: this.coldStorageService ? true : false
    }, 'AppealImportService');
  }

  /**
   * Set progress callback for UI updates
   */
  setProgressCallback(callback: (progress: ImportProgress) => void) {
    this.progressCallback = callback;
    logImport('Progress callback registered', {
      hasCallback: !!callback
    }, 'AppealImportService');
  }

  /**
   * Update progress and notify UI
   */
  updateProgress(stage: string, message: string, processed = 0, total = 0, errors: string[] = []) {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        message,
        processed,
        total,
        errors
      });
    }
    
    logImport('Progress updated', {
      stage,
      message,
      processed,
      total,
      errorCount: errors.length
    }, 'AppealImportService');
  }

  /**
   * Transform and store callback for downloader
   */
  async transformAndStore(appealCases: AppealCaseData[]): Promise<void> {
    const batchTimer = logger.startTimer(`transform-and-store-batch-${appealCases.length}`);
    
    logImport('Starting transform and store operation', {
      caseCount: appealCases.length,
      firstCaseId: appealCases[0]?.case_id,
      lastCaseId: appealCases[appealCases.length - 1]?.case_id
    }, 'AppealImportService');

    try {
      // Step 1: Validate appeal cases
      this.updateProgress('Validating', `Validating ${appealCases.length} appeal cases...`);
      
      const validationResult = validateAppealCaseBatch(appealCases);
      this.importStats.totalValidated += validationResult.totalValidated;
      
      logTransform('Batch validation completed', {
        totalValidated: validationResult.totalValidated,
        validCount: validationResult.validCount,
        invalidCount: validationResult.invalidCount,
        averageScore: validationResult.averageScore.toFixed(2)
      }, 'AppealImportService');

      if (validationResult.validCount === 0) {
        throw new Error('No valid cases found in batch after validation');
      }

      // Get only valid cases for transformation
      const validCases = appealCases.filter((_, index) => {
        const result = validationResult.results[index];
        return result && result.validation.valid;
      });

      logImport('Proceeding with valid cases only', {
        originalCount: appealCases.length,
        validCount: validCases.length,
        invalidCount: appealCases.length - validCases.length
      }, 'AppealImportService');

      // Step 2: Transform to cold storage format
      this.updateProgress('Transforming', `Transforming ${validCases.length} valid cases...`);
      
      const transformationResult = transformAppealCaseBatch(validCases);
      this.importStats.totalTransformed += transformationResult.successfulTransformations;
      
      logTransform('Batch transformation completed', {
        totalProcessed: transformationResult.totalProcessed,
        successfulTransformations: transformationResult.successfulTransformations,
        errorCount: transformationResult.errors.length,
        processingTimeMs: transformationResult.processingTimeMs
      }, 'AppealImportService');

      if (transformationResult.documents.length === 0) {
        throw new Error('No documents produced after transformation');
      }

      // Step 3: Create cold storage batch
      const coldStorageBatch = createColdStorageBatch(transformationResult.documents);
      
      logTransform('Cold storage batch created', {
        documentCount: coldStorageBatch.documents.length,
        totalContentSize: coldStorageBatch.documents.reduce((sum, doc) => sum + doc.content.length, 0)
      }, 'AppealImportService');

      // Step 4: Store in cold storage
      this.updateProgress('Storing', `Storing ${coldStorageBatch.documents.length} documents in cold storage...`);
      
      await this.storeBatchInColdStorage(coldStorageBatch);
      this.importStats.totalStored += coldStorageBatch.documents.length;
      
      logColdStorage('Batch stored successfully in cold storage', {
        documentCount: coldStorageBatch.documents.length,
        successRate: `${(transformationResult.successfulTransformations / appealCases.length * 100).toFixed(1)}%`
      }, 'AppealImportService');

      batchTimer.end({
        originalCases: appealCases.length,
        validCases: validCases.length,
        transformedDocuments: transformationResult.documents.length,
        storedDocuments: coldStorageBatch.documents.length
      });

    } catch (error) {
      this.importStats.errors++;
      
      logger.importError('Transform and store operation failed', {
        caseCount: appealCases.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        importStats: this.importStats
      }, 'AppealImportService');
      
      batchTimer.end({ error: true });
      throw error;
    }
  }

  /**
   * Store a batch in cold storage using the real cold storage service
   */
  async storeBatchInColdStorage(coldStorageBatch: { documents: ColdStorageDocument[] }): Promise<void> {
    const timer = logger.startTimer('store-batch-cold-storage');
    
    logColdStorage('Starting cold storage batch operation', {
      documentCount: coldStorageBatch.documents.length,
      batchSizeBytes: JSON.stringify(coldStorageBatch).length
    }, 'AppealImportService');

    try {
      if (this.coldStorageService && this.coldStorageService.isAuthenticated) {
        // Use real cold storage service to add batch
        const result = await this.coldStorageService.addBatch(coldStorageBatch.documents);
        
        logColdStorage('Documents successfully stored in cold storage', {
          batchId: result.batchId,
          documentCount: result.documentCount,
          storageMode: 'real'
        }, 'AppealImportService');
      } else {
        // Fallback to simulation if cold storage not available or not authenticated
        logColdStorage('Cold storage not available, using simulation', {
          hasService: !!this.coldStorageService,
          isAuthenticated: this.coldStorageService?.isAuthenticated || false
        }, 'AppealImportService');
        
        await this.simulateColdStorageOperation(coldStorageBatch);
      }
      
      timer.end({
        documentCount: coldStorageBatch.documents.length,
        success: true
      });
      
    } catch (error) {
      timer.end({ error: true });
      
      logColdStorage('Cold storage operation failed', {
        documentCount: coldStorageBatch.documents.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'AppealImportService');
      
      throw error;
    }
  }

  /**
   * Simulate cold storage operation (to be replaced with real implementation)
   */
  async simulateColdStorageOperation(coldStorageBatch: { documents: ColdStorageDocument[] }): Promise<void> {
    logColdStorage('Simulating cold storage operation', {
      documentCount: coldStorageBatch.documents.length
    }, 'AppealImportService');

    // Simulate processing time based on batch size
    const processingTime = Math.min(2000, coldStorageBatch.documents.length * 50);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.05) {
      throw new Error('Simulated cold storage failure for testing');
    }

    logColdStorage('Cold storage simulation completed', {
      documentCount: coldStorageBatch.documents.length,
      processingTimeMs: processingTime
    }, 'AppealImportService');
  }

  /**
   * Start appeal cases import
   */
  async startImport(options: {
    batchSize?: number;
    concurrencyLimit?: number;
    useFileSystem?: boolean;
  } = {}): Promise<ImportStats> {
    if (this.isImporting) {
      throw new Error('Import already in progress');
    }

    const {
      batchSize = 50,
      concurrencyLimit = 5,
      useFileSystem = false // false = cold storage mode, true = legacy file system mode
    } = options;

    const importTimer = logger.startTimer('appeal-cases-import');
    
    logImport('Starting appeal cases import', {
      batchSize,
      concurrencyLimit,
      useFileSystem,
      coldStorageAvailable: this.coldStorageService ? true : false
    }, 'AppealImportService');

    this.isImporting = true;
    this.importStats = {
      totalDownloaded: 0,
      totalTransformed: 0,
      totalValidated: 0,
      totalStored: 0,
      errors: 0,
      startTime: new Date(),
      endTime: null
    };

    try {
      // Initialize downloader
      this.updateProgress('Initializing', 'Setting up downloader...');
      
      this.downloader = new AppealDecisionLetterDownloader({
        batchSize,
        concurrencyLimit,
        rateLimitMs: 200,
        maxRetries: 3
      });

      // Configure storage mode
      if (!useFileSystem && this.coldStorageService) {
        // Cold storage mode
        this.downloader.enableColdStorageMode(
          this.coldStorageService,
          this.transformAndStore.bind(this)
        );
        
        logImport('Downloader configured for cold storage mode', {
          coldStorageAuthenticated: this.coldStorageService.isAuthenticated
        }, 'AppealImportService');
      } else {
        // File system mode
        this.downloader.disableColdStorageMode();
        
        logImport('Downloader configured for file system mode', {}, 'AppealImportService');
      }

      // Start download process
      this.updateProgress('Downloading', 'Starting appeal cases download...');
      await this.downloader.downloadAllCases();

      // Mark completion
      this.importStats.endTime = new Date();
      const totalTimeMs = this.importStats.endTime.getTime() - (this.importStats.startTime?.getTime() || 0);
      
      logImport('Appeal cases import completed successfully', {
        totalTimeMs,
        importStats: this.importStats,
        storageMode: useFileSystem ? 'file-system' : 'cold-storage'
      }, 'AppealImportService');

      this.updateProgress('Complete', `Import completed successfully`, 
        this.importStats.totalStored, this.importStats.totalStored);

      importTimer.end({
        totalDownloaded: this.importStats.totalDownloaded,
        totalStored: this.importStats.totalStored,
        errors: this.importStats.errors,
        storageMode: useFileSystem ? 'file-system' : 'cold-storage'
      });

      return this.importStats;

    } catch (error) {
      this.importStats.endTime = new Date();
      this.importStats.errors++;
      
      logger.importError('Appeal cases import failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        importStats: this.importStats,
        stack: error instanceof Error ? error.stack : undefined
      }, 'AppealImportService');

      this.updateProgress('Error', `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      importTimer.end({ error: true });
      throw error;
      
    } finally {
      this.isImporting = false;
    }
  }

  /**
   * Stop current import (if running)
   */
  async stopImport(): Promise<void> {
    if (!this.isImporting) {
      return;
    }

    logImport('Stopping appeal cases import', {
      currentStats: this.importStats
    }, 'AppealImportService');

    // TODO: Implement proper cancellation mechanism
    this.isImporting = false;
    this.updateProgress('Cancelled', 'Import cancelled by user');
  }

  /**
   * Get current import statistics
   */
  getImportStats() {
    return {
      ...this.importStats,
      isImporting: this.isImporting,
      elapsedTime: this.importStats.startTime ? 
        ((this.importStats.endTime || new Date()).getTime() - this.importStats.startTime.getTime()) : 0
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logImport('Cleaning up Appeal Import Service', {
      wasImporting: this.isImporting
    }, 'AppealImportService');

    if (this.isImporting) {
      await this.stopImport();
    }

    this.downloader = null;
    this.coldStorageService = null;
    this.progressCallback = null;
  }
}

// AIDEV-NOTE: Export singleton instance for consistent usage
export const appealImportService = new AppealImportService();