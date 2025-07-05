/**
 * Appeal Import Service - SOLID Refactored Implementation
 * 
 * Now uses the new SOLID-compliant architecture with focused services
 * while maintaining backward compatibility with existing interfaces.
 * 
 * AIDEV-NOTE: Refactored to use SOLID principles with dependency injection
 */

// Re-export the new adapter for backward compatibility
export { appealImportService, AppealImportServiceAdapter as AppealImportService } from './AppealImportServiceAdapter.js';

// Also export types for compatibility
export type { IAppealImportService } from './interfaces.js';

// Export new factory for advanced usage
export { AppealImportFactory } from './AppealImportFactory.js';

// Export interfaces for those who want to use the new architecture directly
export type { 
  IAppealImportOrchestrator,
  AppealCaseData,
  ScrapingConfig,
  ProcessingProgress
} from './scraping/interfaces.js';