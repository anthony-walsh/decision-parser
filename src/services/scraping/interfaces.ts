/**
 * Interfaces for Appeal Scraping Services
 * 
 * Defines contracts for web scraping, PDF processing, and data transformation
 * following SOLID principles for better separation of concerns.
 * 
 * AIDEV-NOTE: Service interfaces for appeal scraping with SOLID design
 */

// Core data types
export interface AppealCaseData {
  doc_link_span: string;
  content: string;
  case_type: string;
  case_id: string;
  start_date: string;
  lpa_name: string;
  questionnaire_due: string;
  statement_due: string;
  case_officer: string;
  interested_party_comments_due: string;
  procedure: string;
  final_comments_due: string;
  status: string;
  inquiry_evidence_due: string;
  decision_outcome: string;
  event_date: string;
  link_status: string;
  decision_date: string;
  linked_case_count: number;
}

export interface ProcessingProgress {
  totalCases: number;
  processedCases: number;
  failedCases: number;
  currentBatch: number;
  totalBatches: number;
  currentCase?: string;
}

export interface FailedCase {
  caseId: string;
  url: string;
  error: string;
  timestamp: string;
  retryCount: number;
}

export interface ScrapingConfig {
  concurrencyLimit: number;
  rateLimitMs: number;
  maxRetries: number;
  batchSize: number;
  timeoutMs: number;
}

// Web scraping interface
export interface IWebScraper {
  scrapeAppealCase(caseId: string): Promise<Partial<AppealCaseData>>;
  isProduction(): boolean;
}

// PDF processing interface
export interface IPDFProcessor {
  extractTextFromUrl(url: string): Promise<string>;
  extractTextFromBuffer(buffer: ArrayBuffer): Promise<string>;
  initialize(): Promise<void>;
}

// HTTP client interface
export interface IHttpClient {
  get(url: string, options?: any): Promise<any>;
  download(url: string): Promise<ArrayBuffer>;
  setHeaders(headers: Record<string, string>): void;
}

// Data transformation interface
export interface IDataTransformer {
  transformCase(rawData: Partial<AppealCaseData>, pdfContent: string): AppealCaseData;
  validateCaseData(caseData: AppealCaseData): boolean;
}

// Environment detection interface
export interface IEnvironmentDetector {
  isLocalDevelopment(): boolean;
  isProduction(): boolean;
}

// Simulation service interface (for development)
export interface ISimulationService {
  generateSimulatedCase(caseId: string, url: string): AppealCaseData;
}

// Progress tracking interface
export interface IProgressTracker {
  updateProgress(processed: number, failed: number, current?: string): void;
  setCurrentBatch(batchNumber: number): void;
  incrementProcessed(): void;
  incrementFailed(): void;
  setCurrentCase(caseId: string): void;
  getCurrentProgress(): ProcessingProgress;
  configure(totalCases: number, totalBatches: number): void;
  onProgress(callback: (progress: ProcessingProgress) => void): void;
  logProgress(): void;
}

// Error handling interface
export interface IErrorHandler {
  recordFailure(caseId: string, url: string, error: Error, retryCount: number): void;
  getFailedCases(): FailedCase[];
  clearFailures(): void;
}

// Batch processing interface
export interface IBatchProcessor {
  processBatch(caseIds: string[]): Promise<AppealCaseData[]>;
  processCasesWithConcurrency(caseIds: string[]): Promise<AppealCaseData[]>;
}

// Storage interface
export interface IAppealStorageAdapter {
  saveBatch(batchData: AppealCaseData[], batchNumber: number): Promise<void>;
  saveFailedCasesLog(failedCases: FailedCase[]): Promise<void>;
  setColdStorageMode(enabled: boolean, callback?: (data: AppealCaseData[]) => Promise<void>): void;
}

// Case reference provider interface
export interface ICaseReferenceProvider {
  getCaseReferences(): Promise<string[]>;
}

// Main orchestrator interface
export interface IAppealImportOrchestrator {
  readonly importing: boolean;
  configure(config: Partial<ScrapingConfig>): void;
  enableColdStorageMode(callback: (documents: AppealCaseData[]) => Promise<void>): void;
  disableColdStorageMode(): void;
  downloadAllCases(): Promise<void>;
  onProgress(callback: (progress: ProcessingProgress) => void): void;
  cancelImport(): void;
}