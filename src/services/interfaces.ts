/**
 * Service Interfaces for Dependency Injection
 * 
 * Defines contracts for all services to enable proper dependency injection,
 * loose coupling, and easy mocking for tests.
 * 
 * AIDEV-NOTE: Service abstractions for improved testability and architecture
 */

import type { SearchResult } from '@/types';

// Authentication Service Interface
export interface IAuthenticationService {
  readonly isAuthenticated: boolean;
  needsPasswordSetup(): boolean;
  setupPassword(password: string): Promise<void>;
  authenticate(password: string): Promise<boolean>;
  logout(): void;
  getAuthState(): { isAuthenticated: boolean; isInitialized: boolean; hasChallenge: boolean };
  deriveKeyForBatch(password: string, batchSalt: Uint8Array): Promise<CryptoKey>;
}

// Encryption Service Interface
export interface IEncryptionService {
  readonly algorithm: string;
  readonly keyLength: number;
  readonly ivLength: number;
  deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
  encrypt(data: any, key: CryptoKey): Promise<{ encrypted: ArrayBuffer; iv: ArrayBuffer }>;
  decrypt(encryptedData: ArrayBuffer, key: CryptoKey, iv: ArrayBuffer): Promise<any>;
  generateSalt(): Uint8Array;
  compressAndEncrypt(data: any, key: CryptoKey): Promise<{ compressed: boolean; encrypted: ArrayBuffer; iv: ArrayBuffer; checksum: string }>;
  decryptAndDecompress(encryptedData: ArrayBuffer, key: CryptoKey, iv: ArrayBuffer, compressed: boolean): Promise<any>;
}

// Cold Storage Service Interface
export interface IColdStorageService {
  readonly isAuthenticated: boolean;
  readonly isInitialized: boolean;
  initialize(): Promise<void>;
  authenticate(keyMaterial: ArrayBuffer): Promise<void>;
  authenticateWithPassword(password: string): Promise<void>;
  search(query: string, options?: { threshold?: number }): Promise<SearchResult[]>;
  addDocument(document: any): Promise<void>;
  getAllDocuments(): Promise<any[]>;
  deleteDocument(docId: string): Promise<void>;
  clearAll(): Promise<void>;
  getStorageInfo(): Promise<any>;
  loadCacheStats(): Promise<any>;
  clearCache(): Promise<void>;
}

// Memory Manager Interface
export interface IMemoryManager {
  isMemoryPressure(): boolean;
  getMemoryInfo(): any;
  clearCaches(): Promise<void>;
  optimizeMemory(): Promise<void>;
  onMemoryPressure(callback: () => void): void;
}

// Performance Monitor Interface
export interface IPerformanceMonitor {
  startTimer(operation: string): { end: () => number };
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  getMetrics(): any[];
  clearMetrics(): void;
  isPerformanceIssue(): boolean;
}

// Appeal Import Service Interface (updated to match new orchestrator)
export interface IAppealImportService {
  readonly importing: boolean;
  configure(config: { batchSize?: number; sampleMode?: boolean; concurrencyLimit?: number; rateLimitMs?: number }): void;
  enableColdStorageMode(callback: (documents: any[]) => Promise<void>): void;
  disableColdStorageMode(): void;
  downloadAllCases(): Promise<void>;
  onProgress(callback: (progress: any) => void): void;
  cancelImport(): void;
}

// Search History Service Interface
export interface ISearchHistoryService {
  addSearchHistory(query: string, resultCount: number): Promise<void>;
  getSearchHistory(): Promise<Array<{ id: string; query: string; timestamp: Date; resultCount: number }>>;
  clearSearchHistory(): Promise<void>;
  saveSearch(name: string, query: string): Promise<void>;
  getSavedSearches(): Promise<Array<{ id: string; name: string; query: string; createdDate: Date }>>;
  deleteSavedSearch(id: string): Promise<void>;
}

// ServiceProvider interface removed - using DI container directly

// Logger Interface
export interface ILogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
  startTimer(operation: string): { end: (data?: any) => void };
}

// Service Registry Interface - maps service names to their interfaces
export interface ServiceRegistry {
  'authentication': IAuthenticationService;
  'encryption': IEncryptionService;
  'coldStorage': IColdStorageService;
  'memoryManager': IMemoryManager;
  'performanceMonitor': IPerformanceMonitor;
  'appealImport': IAppealImportService;
  'searchHistory': ISearchHistoryService;
  'logger': ILogger;
}

// Type-safe service key type
export type ServiceKey = keyof ServiceRegistry;

// Helper type to get service interface by key
export type ServiceInterface<T extends ServiceKey> = ServiceRegistry[T];