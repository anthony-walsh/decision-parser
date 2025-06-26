/**
 * TypeScript declarations for Hot Storage Service
 */

import type { Document, SearchIndex, SearchResult, DateFilter } from '@/types';

export interface HotStorageStats {
  documentCount: number;
  indexedCount: number;
  totalSize: number;
}

export interface SearchOptions {
  limit?: number;
  dateFilter?: DateFilter;
  threshold?: number;
}

export declare class HotStorageService {
  constructor();
  
  /**
   * Initialize hot storage worker
   */
  initialize(): Promise<void>;
  
  /**
   * Add document to hot storage
   */
  addDocument(document: Document, searchIndex: SearchIndex): Promise<void>;
  
  /**
   * Search documents in hot storage
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  /**
   * Get storage statistics
   */
  getStats(): Promise<HotStorageStats>;
  
  /**
   * Refresh/reload the storage
   */
  refresh(): Promise<void>;
  
  /**
   * Clear all documents
   */
  clearAll(): Promise<void>;
  
  /**
   * Check if service is initialized
   */
  readonly isInitialized: boolean;
  
  /**
   * Check if service is authenticated
   */
  readonly isAuthenticated: boolean;
}