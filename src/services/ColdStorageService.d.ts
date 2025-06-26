/**
 * TypeScript declarations for ColdStorageService
 * 
 * AIDEV-NOTE: Type definitions for enhanced IDE support and type checking
 */

export interface StorageIndex {
  version: string;
  totalDocuments: number;
  totalBatches: number;
  lastUpdated: string;
  batches: BatchInfo[];
  metadata: {
    encryptionAlgorithm: string;
    keyDerivation: string;
    pbkdf2Iterations: number;
    batchSizeLimit: number;
    documentThreshold: number;
    created: string;
    description: string;
  };
}

export interface BatchInfo {
  batchId: string;
  url: string;
  documentCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  keywords: string[];
  size: string;
}

export interface SearchOptions {
  limit?: number;
  dateFilter?: {
    start: string;
    end: string;
  };
  includeArchived?: boolean;
}

import { ColdStorageSearchResult } from '../types';

export interface SearchResponse {
  results: ColdStorageSearchResult[];
  total: number;
  query: string;
  batchesSearched: number;
  limited: boolean;
  error?: string;
}

export interface ProgressCallback {
  (progress: {
    type: 'progress';
    message: string;
    totalBatches: number;
    completedBatches: number;
    partialResults: ColdStorageSearchResult[];
  }): void;
}

export interface CacheStats {
  cacheSize: number;
  cachedBatches: number;
  maxCacheSize: number;
}

export interface StorageInfo {
  totalDocuments: number;
  totalBatches: number;
  isLoaded: boolean;
  batchSizes: Array<{
    id: string;
    documentCount: number;
    size: string;
    dateRange: {
      start: string;
      end: string;
    };
  }>;
}

export interface ServiceState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  hasWorker: boolean;
  hasStorageIndex: boolean;
  totalBatches: number;
  pendingMessages: number;
  activeSearches: number;
}

export class ColdStorageService {
  constructor();
  
  /**
   * Initialize cold storage worker
   */
  initialize(): Promise<void>;
  
  /**
   * Authenticate worker with encryption key
   */
  authenticate(keyMaterial: ArrayBuffer): Promise<void>;
  
  /**
   * Load storage index from server
   */
  loadStorageIndex(): Promise<StorageIndex>;
  
  /**
   * Search cold storage with progressive results
   */
  searchDocuments(
    query: string, 
    options?: SearchOptions, 
    progressCallback?: ProgressCallback
  ): Promise<SearchResponse>;
  
  /**
   * Get specific batch data
   */
  getBatch(batchId: string): Promise<any>;
  
  /**
   * Clear batch cache
   */
  clearCache(): Promise<void>;
  
  /**
   * Get cache statistics
   */
  getCacheStats(): Promise<CacheStats>;
  
  /**
   * Get storage index information
   */
  getStorageInfo(): StorageInfo;
  
  /**
   * Check if cold storage is available
   */
  isAvailable(): boolean;
  
  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
  
  /**
   * Get current service state
   */
  getState(): ServiceState;
}

export declare const coldStorageService: ColdStorageService;