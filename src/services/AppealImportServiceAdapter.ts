/**
 * Appeal Import Service Adapter
 * 
 * Adapts the new SOLID-compliant AppealImportOrchestrator to the existing
 * IAppealImportService interface for backward compatibility.
 * 
 * AIDEV-NOTE: Adapter pattern for backward compatibility
 */

import { AppealImportFactory } from './AppealImportFactory.js';
import type { IAppealImportService } from './interfaces.js';
import type { IAppealImportOrchestrator, ScrapingConfig } from './scraping/interfaces.js';

export class AppealImportServiceAdapter implements IAppealImportService {
  private orchestrator: IAppealImportOrchestrator;

  constructor() {
    this.orchestrator = AppealImportFactory.createAppealImportService();
  }

  get importing(): boolean {
    return this.orchestrator.importing;
  }

  configure(config: { 
    batchSize?: number; 
    sampleMode?: boolean; 
    concurrencyLimit?: number; 
    rateLimitMs?: number 
  }): void {
    // Convert from old config format to new format
    const scrapingConfig: Partial<ScrapingConfig> = {
      batchSize: config.batchSize || 1000,
      concurrencyLimit: config.concurrencyLimit || 10,
      rateLimitMs: config.rateLimitMs || 200
    };

    this.orchestrator.configure(scrapingConfig);
    
    console.log('[AppealImportServiceAdapter] Configured with:', scrapingConfig);
  }

  enableColdStorageMode(callback: (documents: any[]) => Promise<void>): void {
    this.orchestrator.enableColdStorageMode(callback);
  }

  disableColdStorageMode(): void {
    this.orchestrator.disableColdStorageMode();
  }

  async downloadAllCases(): Promise<void> {
    return this.orchestrator.downloadAllCases();
  }

  onProgress(callback: (progress: any) => void): void {
    this.orchestrator.onProgress(callback);
  }

  cancelImport(): void {
    this.orchestrator.cancelImport();
  }

  // Additional methods for direct access to orchestrator (if needed)
  getOrchestrator(): IAppealImportOrchestrator {
    return this.orchestrator;
  }
}

// Create singleton instance for backward compatibility
export const appealImportService = new AppealImportServiceAdapter();