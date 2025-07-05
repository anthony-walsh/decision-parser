/**
 * Appeal Import Service Factory
 * 
 * Creates and wires up all dependencies for the appeal import system
 * following dependency injection principles. Replaces the monolithic
 * AppealDecisionLetterDownloader with composed services.
 * 
 * AIDEV-NOTE: Factory for creating appeal import services with DI
 */

import { AppealImportOrchestrator } from './AppealImportOrchestrator.js';
import { HttpClient } from './scraping/HttpClient.js';
import { PDFProcessor } from './scraping/PDFProcessor.js';
import { WebScraper } from './scraping/WebScraper.js';
import { EnvironmentDetector } from './scraping/EnvironmentDetector.js';
import { SimulationService } from './scraping/SimulationService.js';
import { ProgressTracker } from './scraping/ProgressTracker.js';

import type { 
  IAppealImportOrchestrator,
  ScrapingConfig
} from './scraping/interfaces.js';

export class AppealImportFactory {
  
  /**
   * Create a complete appeal import orchestrator with all dependencies
   */
  static createAppealImportService(config: Partial<ScrapingConfig> = {}): IAppealImportOrchestrator {
    // Create core infrastructure services
    const httpClient = new HttpClient(config.timeoutMs);
    const environmentDetector = new EnvironmentDetector();
    const progressTracker = new ProgressTracker();
    
    // Create domain services
    const pdfProcessor = new PDFProcessor(httpClient);
    const webScraper = new WebScraper(httpClient, environmentDetector);
    const simulationService = new SimulationService();
    
    // Create orchestrator with all dependencies
    const orchestrator = new AppealImportOrchestrator(
      webScraper,
      pdfProcessor,
      environmentDetector,
      simulationService,
      progressTracker,
      config
    );
    
    return orchestrator;
  }

  /**
   * Create appeal import service with custom dependencies (for testing)
   */
  static createWithDependencies(
    webScraper: any,
    pdfProcessor: any,
    environmentDetector: any,
    simulationService: any,
    progressTracker: any,
    config: Partial<ScrapingConfig> = {}
  ): IAppealImportOrchestrator {
    return new AppealImportOrchestrator(
      webScraper,
      pdfProcessor,
      environmentDetector,
      simulationService,
      progressTracker,
      config
    );
  }

  /**
   * Create individual services for custom composition
   */
  static createServices(config: Partial<ScrapingConfig> = {}) {
    const httpClient = new HttpClient(config.timeoutMs);
    const environmentDetector = new EnvironmentDetector();
    const progressTracker = new ProgressTracker();
    const pdfProcessor = new PDFProcessor(httpClient);
    const webScraper = new WebScraper(httpClient, environmentDetector);
    const simulationService = new SimulationService();

    return {
      httpClient,
      environmentDetector,
      progressTracker,
      pdfProcessor,
      webScraper,
      simulationService
    };
  }
}