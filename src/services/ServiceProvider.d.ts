/**
 * TypeScript declarations for ServiceProvider
 */

export interface MigrationState {
  authenticationReady: boolean;
  hotStorageReady: boolean;
  coldStorageReady: boolean;
  workersReady: boolean;
}

export interface FeatureFlags {
  useNewAuthentication: boolean;
  useNewHotStorage: boolean;
  useNewColdStorage: boolean;
  enableWorkers: boolean;
}

export interface SystemStatus {
  initialized: boolean;
  migration: {
    authenticationReady: boolean;
    hotStorageReady: boolean;
    coldStorageReady: boolean;
    workersReady: boolean;
    featureFlags: FeatureFlags;
    servicesAvailable: string[];
  };
  services: {
    legacy: {
      database: boolean;
      searchEngine: boolean;
    };
    new: {
      authentication: boolean;
      hotStorage: boolean;
      coldStorage: boolean;
      workers: boolean;
    };
  };
}

export interface StorageAdapter {
  addDocument(document: any): Promise<void>;
  getAllDocuments(): Promise<any[]>;
  searchDocuments(query: string, options?: any): Promise<any[]>;
  deleteDocument(docId: string): Promise<void>;
  clearAllData(): Promise<void>;
}

export class ServiceProvider {
  constructor();
  initialize(): Promise<void>;
  getService(serviceName: string): any;
  hasService(serviceName: string): boolean;
  getMigrationState(): MigrationState;
  enableFeature(featureName: string): void;
  disableFeature(featureName: string): void;
  getStorageAdapter(): StorageAdapter;
  getSystemStatus(): SystemStatus;
}

export const serviceProvider: ServiceProvider;
export default ServiceProvider;