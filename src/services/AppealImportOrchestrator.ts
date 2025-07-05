/**
 * Appeal Import Orchestrator
 * 
 * Main coordinator that orchestrates the appeal import process using
 * focused services. Follows SOLID principles with dependency injection.
 * 
 * AIDEV-NOTE: Refactored appeal import following SOLID principles
 */

import type { 
  IAppealImportOrchestrator,
  IWebScraper,
  IPDFProcessor,
  IEnvironmentDetector,
  ISimulationService,
  IProgressTracker,
  AppealCaseData,
  ScrapingConfig,
  ProcessingProgress,
  FailedCase
} from './scraping/interfaces.js';

export class AppealImportOrchestrator implements IAppealImportOrchestrator {
  private config: ScrapingConfig;
  private webScraper: IWebScraper;
  private pdfProcessor: IPDFProcessor;
  private environmentDetector: IEnvironmentDetector;
  private simulationService: ISimulationService;
  private progressTracker: IProgressTracker;
  
  private isImporting: boolean = false;
  private shouldCancel: boolean = false;
  private coldStorageCallback: ((documents: AppealCaseData[]) => Promise<void>) | null = null;
  private failedCases: FailedCase[] = [];

  constructor(
    webScraper: IWebScraper,
    pdfProcessor: IPDFProcessor,
    environmentDetector: IEnvironmentDetector,
    simulationService: ISimulationService,
    progressTracker: IProgressTracker,
    config: Partial<ScrapingConfig> = {}
  ) {
    this.webScraper = webScraper;
    this.pdfProcessor = pdfProcessor;
    this.environmentDetector = environmentDetector;
    this.simulationService = simulationService;
    this.progressTracker = progressTracker;
    
    this.config = {
      concurrencyLimit: 10,
      rateLimitMs: 200,
      maxRetries: 3,
      batchSize: 1000,
      timeoutMs: 30000,
      ...config
    };
  }

  configure(config: Partial<ScrapingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  enableColdStorageMode(callback: (documents: AppealCaseData[]) => Promise<void>): void {
    this.coldStorageCallback = callback;
    console.log('[AppealImportOrchestrator] Cold storage mode enabled');
  }

  disableColdStorageMode(): void {
    this.coldStorageCallback = null;
    console.log('[AppealImportOrchestrator] Cold storage mode disabled');
  }

  onProgress(callback: (progress: ProcessingProgress) => void): void {
    this.progressTracker.onProgress(callback);
  }

  cancelImport(): void {
    this.shouldCancel = true;
    console.log('[AppealImportOrchestrator] Import cancellation requested');
  }

  get importing(): boolean {
    return this.isImporting;
  }

  async downloadAllCases(): Promise<void> {
    if (this.isImporting) {
      throw new Error('Import already in progress');
    }

    this.isImporting = true;
    this.shouldCancel = false;
    this.failedCases = [];

    try {
      console.log('🚀 Starting Appeal Import Orchestrator...');
      
      // Log environment mode
      const isLocal = this.environmentDetector.isLocalDevelopment();
      console.log(`🌍 Environment: ${isLocal ? 'Local Development (Simulation Mode)' : 'Production (Web Scraping Mode)'}`);
      
      if (isLocal) {
        console.log('📝 Using simulated data to avoid CORS issues during development');
      } else {
        console.log('🌐 Using real web scraping for production data collection');
      }

      // Initialize PDF processor
      await this.pdfProcessor.initialize();
      console.log('✅ PDF processor initialized');

      // Get case references
      const caseIds = await this.getCaseReferences();
      console.log(`📋 Loaded ${caseIds.length} case references`);

      // Configure progress tracker
      const totalBatches = Math.ceil(caseIds.length / this.config.batchSize);
      this.progressTracker.configure(caseIds.length, totalBatches);

      console.log(`🎯 Processing ${caseIds.length} cases in ${totalBatches} batches of ${this.config.batchSize}`);
      console.log(`⚙️  Concurrency: ${this.config.concurrencyLimit}, Rate limit: ${this.config.rateLimitMs}ms`);

      // Process cases in batches
      for (let i = 0; i < caseIds.length; i += this.config.batchSize) {
        if (this.shouldCancel) {
          console.log('🛑 Import cancelled by user');
          break;
        }

        const batchNumber = Math.floor(i / this.config.batchSize) + 1;
        this.progressTracker.setCurrentBatch(batchNumber);

        const batchCaseIds = caseIds.slice(i, i + this.config.batchSize);
        console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batchCaseIds.length} cases)`);

        const batchResults = await this.processBatch(batchCaseIds);

        if (batchResults.length > 0) {
          await this.saveBatch(batchResults, batchNumber);
        }
      }

      // Save failed cases log
      await this.saveFailedCasesLog();

      // Final summary
      const progress = this.progressTracker.getCurrentProgress();
      console.log('\n🎉 Import complete!');
      console.log(`✅ Successfully processed: ${progress.processedCases} cases`);
      console.log(`❌ Failed: ${progress.failedCases} cases`);

      if (this.coldStorageCallback) {
        console.log(`💾 Storage mode: Cold storage (encrypted archive)`);
      } else {
        console.log(`📁 Storage mode: Browser downloads`);
      }

    } catch (error) {
      console.error('💥 Fatal error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      this.isImporting = false;
    }
  }

  private async getCaseReferences(): Promise<string[]> {
    try {
      // Fetch CSV file from public directory
      const response = await fetch('/decision-parser/caseReferences.csv');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch case references: ${response.status} ${response.statusText}`);
      }
      
      const csvContent = await response.text();
      
      // Parse CSV content - each line is a case ID
      const caseIds = csvContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => !isNaN(Number(line))) // Ensure it's a valid number
        .slice(0, this.config.batchSize); // Respect configured batch size
      
      console.log(`[AppealImportOrchestrator] Loaded ${caseIds.length} case references from CSV file`);
      return caseIds;
    } catch (error) {
      throw new Error(`Failed to load case references: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processBatch(caseIds: string[]): Promise<AppealCaseData[]> {
    const results: AppealCaseData[] = [];

    for (let i = 0; i < caseIds.length; i += this.config.concurrencyLimit) {
      if (this.shouldCancel) break;

      const batch = caseIds.slice(i, i + this.config.concurrencyLimit);

      const batchPromises = batch.map(async (caseId) => {
        this.progressTracker.setCurrentCase(caseId);
        this.progressTracker.logProgress();

        try {
          const caseData = await this.processCase(caseId);
          this.progressTracker.incrementProcessed();
          return caseData;
        } catch (error) {
          this.progressTracker.incrementFailed();

          const failedCase: FailedCase = {
            caseId,
            url: `https://acp.planninginspectorate.gov.uk/ViewCase.aspx?CaseID=${caseId}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            retryCount: this.config.maxRetries
          };

          this.failedCases.push(failedCase);
          console.error(`  Failed to process case ${caseId}: ${failedCase.error}`);

          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is AppealCaseData => result !== null));

      this.progressTracker.logProgress();
    }

    return results;
  }

  private async processCase(caseId: string, retryCount = 0): Promise<AppealCaseData> {
    const url = `https://acp.planninginspectorate.gov.uk/ViewCase.aspx?CaseID=${caseId}`;

    try {
      // Add rate limiting
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs));

      // Environment-aware processing
      if (this.environmentDetector.isLocalDevelopment()) {
        return this.simulationService.generateSimulatedCase(caseId, url);
      } else {
        return await this.processProductionCase(caseId, url);
      }

    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        console.log(`  Retrying case ${caseId} (attempt ${retryCount + 1}/${this.config.maxRetries})`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs * Math.pow(2, retryCount)));
        return this.processCase(caseId, retryCount + 1);
      }

      throw error;
    }
  }

  private async processProductionCase(caseId: string, _url: string): Promise<AppealCaseData> {
    // Scrape case metadata
    const caseData = await this.webScraper.scrapeAppealCase(caseId);
    
    // Extract PDF content if available
    let pdfContent = '';
    const pdfUrl = (caseData as any).pdfUrl;
    
    if (pdfUrl) {
      try {
        pdfContent = await this.pdfProcessor.extractTextFromUrl(pdfUrl);
      } catch (pdfError) {
        console.warn(`Failed to extract PDF for case ${caseId}: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
        pdfContent = `PDF extraction failed for case ${caseId}`;
      }
    }

    return {
      ...caseData,
      content: pdfContent || `Case data for ${caseId} - No PDF content available`,
    } as AppealCaseData;
  }

  private async saveBatch(batchData: AppealCaseData[], batchNumber: number): Promise<void> {
    if (this.coldStorageCallback) {
      // Cold storage mode
      console.log(`[AppealImportOrchestrator] Processing batch ${batchNumber} for cold storage with ${batchData.length} cases`);

      try {
        await this.coldStorageCallback(batchData);
        console.log(`✅ Processed batch ${batchNumber} through cold storage with ${batchData.length} cases`);
      } catch (error) {
        console.error(`❌ Failed to process batch ${batchNumber} through cold storage:`, error);
        throw error;
      }
    } else {
      // File system mode - browser fallback
      await this.downloadBatchAsFile(batchData, batchNumber);
    }
  }

  private async downloadBatchAsFile(batchData: AppealCaseData[], batchNumber: number): Promise<void> {
    const filename = `documents-batch-${batchNumber.toString().padStart(3, '0')}.json`;
    const dataStr = JSON.stringify(batchData, null, 2);

    // Create downloadable blob
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create temporary download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';

    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up object URL
    URL.revokeObjectURL(url);

    console.log(`✅ Downloaded batch ${batchNumber} with ${batchData.length} cases as ${filename}`);
  }

  private async saveFailedCasesLog(): Promise<void> {
    if (this.failedCases.length === 0) return;

    if (this.coldStorageCallback) {
      // Cold storage mode - just log to console
      console.log(`📝 [COLD-STORAGE] ${this.failedCases.length} failed cases during import:`);
      this.failedCases.forEach(fc => {
        console.log(`  - ${fc.timestamp} | Case: ${fc.caseId} | Error: ${fc.error} | Retries: ${fc.retryCount}`);
      });
    } else {
      // File system mode - download log file
      const logContent = this.failedCases
        .map(fc => `${fc.timestamp} | Case: ${fc.caseId} | URL: ${fc.url} | Error: ${fc.error} | Retries: ${fc.retryCount}`)
        .join('\n');

      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = 'failed-cases.log';
      downloadLink.style.display = 'none';

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      URL.revokeObjectURL(url);

      console.log(`📝 Downloaded failed cases log with ${this.failedCases.length} entries`);
    }
  }
}