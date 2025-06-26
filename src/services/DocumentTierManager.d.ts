/**
 * TypeScript declarations for DocumentTierManager
 * 
 * AIDEV-NOTE: Type definitions for document lifecycle management
 */

export interface MigrationConfig {
  maxHotStorageDocuments: number;
  migrationAgeThresholdDays: number;
  accessThresholdDays: number;
  batchSize: number;
  migrationInterval: number;
  maxConcurrentMigrations: number;
}

export interface MigrationStats {
  totalMigrated: number;
  totalFailed: number;
  lastMigrationDate: Date | null;
  avgMigrationTime: number;
}

export interface MigrationNeed {
  required: boolean;
  reasons: string[];
  documentCount: number;
  oldDocuments: number;
  inactiveDocuments: number;
}

export interface MigrationResult {
  success: number;
  failed: number;
  errors: string[];
  migratedDocuments?: string[];
}

export interface MigrationStatus {
  isInitialized: boolean;
  migrationInProgress: boolean;
  queueLength: number;
  stats: MigrationStats;
  config: MigrationConfig;
}

export interface MigrationEvent {
  migrationId: string;
  type: 'started' | 'progress' | 'completed' | 'failed';
  data: any;
}

export interface DocumentCandidate {
  id: string;
  filename: string;
  upload_date: string;
  last_accessed: string | null;
  access_count: number;
  size: number;
  metadata?: any;
}

export type MigrationEventType = 
  | 'initialized'
  | 'migration-started'
  | 'migration-progress' 
  | 'migration-completed'
  | 'migration-failed'
  | 'batch-progress'
  | 'migration-error'
  | 'config-updated'
  | 'error';

export type MigrationEventListener = (data: any) => void;

export class DocumentTierManager {
  constructor();
  
  /**
   * Initialize the tier manager
   */
  initialize(): Promise<void>;
  
  /**
   * Check if migration is needed and trigger if necessary
   */
  checkAndTriggerMigration(): Promise<void>;
  
  /**
   * Assess whether migration is needed
   */
  assessMigrationNeed(hotStorageStats: any): Promise<MigrationNeed>;
  
  /**
   * Get documents older than migration threshold
   */
  getOldDocuments(): Promise<DocumentCandidate[]>;
  
  /**
   * Get documents that haven't been accessed recently
   */
  getInactiveDocuments(): Promise<DocumentCandidate[]>;
  
  /**
   * Trigger migration process
   */
  triggerMigration(migrationNeed: MigrationNeed): Promise<void>;
  
  /**
   * Select documents for migration based on age and access patterns
   */
  selectDocumentsForMigration(): Promise<DocumentCandidate[]>;
  
  /**
   * Migrate a batch of documents to cold storage
   */
  migrateBatch(documents: DocumentCandidate[], migrationId: string): Promise<MigrationResult>;
  
  /**
   * Force immediate migration check
   */
  forceMigrationCheck(): Promise<void>;
  
  /**
   * Get migration status
   */
  getMigrationStatus(): MigrationStatus;
  
  /**
   * Update migration configuration
   */
  updateConfig(newConfig: Partial<MigrationConfig>): void;
  
  /**
   * Event system for migration notifications
   */
  on(event: MigrationEventType, listener: MigrationEventListener): void;
  off(event: MigrationEventType, listener: MigrationEventListener): void;
  emit(event: MigrationEventType, data: any): void;
  
  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

export declare const documentTierManager: DocumentTierManager;