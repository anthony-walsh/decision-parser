/**
 * Service Provider - Integration Layer for Gradual Migration
 * 
 * This service provider allows the application to gradually migrate from 
 * Dexie.js to the new hybrid storage architecture while maintaining compatibility.
 * 
 * AIDEV-NOTE: Migration strategy service provider for seamless transition
 */

import { AuthenticationService } from './AuthenticationService.js';
// AIDEV-NOTE: Removed legacy Dexie database import - migration completed

// Feature flags for gradual migration
// AIDEV-NOTE: Simplified feature flags - removed hot storage complexity
const FEATURE_FLAGS = {
  useNewAuthentication: false,
  useNewColdStorage: true,
  enableWorkers: false
};

/**
 * Service Provider for managing service instances and migration state
 */
class ServiceProvider {
  constructor() {
    this.services = new Map();
    this.isInitialized = false;
    this.migrationState = {
      authenticationReady: false,
      coldStorageReady: false,
      workersReady: false
    };
  }

  /**
   * Initialize all services based on feature flags
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('[ServiceProvider] Initializing services...');

    try {
      // AIDEV-NOTE: Legacy database initialization removed - cold storage only

      // AIDEV-NOTE: Simplified service initialization - removed hot storage
      console.log('[ServiceProvider] Initializing services with feature flags:', FEATURE_FLAGS);
      
      // Conditionally initialize new services based on feature flags
      if (FEATURE_FLAGS.useNewAuthentication) {
        console.log('[ServiceProvider] Initializing authentication service...');
        await this.initializeAuthentication();
      }

      if (FEATURE_FLAGS.useNewColdStorage) {
        console.log('[ServiceProvider] Initializing cold storage service...');
        await this.initializeColdStorage();
      }

      if (FEATURE_FLAGS.enableWorkers) {
        console.log('[ServiceProvider] Initializing workers...');
        await this.initializeWorkers();
      }

      this.isInitialized = true;
      console.log('[ServiceProvider] Initialization complete');

    } catch (error) {
      console.error('[ServiceProvider] Initialization failed:', error);
      throw error;
    }
  }

  // AIDEV-NOTE: Legacy database initialization removed - migration to cold storage completed

  /**
   * Initialize authentication service
   */
  async initializeAuthentication() {
    try {
      // Import and use the singleton authService instance
      const { authService } = await import('./AuthenticationService.js');
      
      // Check if authentication is already set up
      const authState = authService.getAuthState();
      this.migrationState.authenticationReady = authState.hasChallenge;
      
      this.services.set('authentication', authService);
      console.log('[ServiceProvider] Authentication service initialized, challenge exists:', authState.hasChallenge);
    } catch (error) {
      console.error('[ServiceProvider] Authentication initialization failed:', error);
      this.migrationState.authenticationReady = false;
    }
  }


  /**
   * Initialize cold storage service
   */
  async initializeColdStorage() {
    try {
      const { coldStorageService } = await import('./ColdStorageService.js');
      await coldStorageService.initialize();
      
      // AIDEV-NOTE: Always initialize authentication service for cold storage
      if (!this.services.has('authentication')) {
        console.log('[ServiceProvider] Initializing authentication service for cold storage...');
        await this.initializeAuthentication();
      }
      
      // AIDEV-NOTE: Authenticate cold storage if user is already authenticated
      const authService = this.services.get('authentication');
      if (authService && authService.isAuthenticated) {
        console.log('[ServiceProvider] Authenticating cold storage with existing credentials...');
        try {
          const password = await authService.getUserPassword();
          await coldStorageService.authenticateWithPassword(password);
          console.log('[ServiceProvider] Cold storage password authentication successful');
        } catch (authError) {
          console.warn('[ServiceProvider] Cold storage password authentication failed:', authError.message);
          // Continue without authentication - cold storage will work in limited mode
        }
      } else {
        console.log('[ServiceProvider] User not authenticated, cold storage will need manual authentication later');
      }
      
      this.services.set('coldStorage', coldStorageService);
      this.migrationState.coldStorageReady = true;
      console.log('[ServiceProvider] Cold storage service initialized');
    } catch (error) {
      console.error('[ServiceProvider] Cold storage initialization failed:', error);
      this.migrationState.coldStorageReady = false;
    }
  }

  /**
   * Initialize worker services
   */
  async initializeWorkers() {
    try {
      const { createWorkerFromPath, WORKER_PATHS } = await import('@/workers/index.ts');
      
      // AIDEV-NOTE: Simplified worker creation - removed hot storage worker
      console.log('[ServiceProvider] Creating workers:', Object.keys(WORKER_PATHS));
      const workers = {
        coldStorage: createWorkerFromPath(WORKER_PATHS.coldStorage, 'coldStorageWorker'),
        pdfProcessor: createWorkerFromPath(WORKER_PATHS.pdfProcessor, 'pdfProcessor')
      };

      this.services.set('workers', workers);
      this.migrationState.workersReady = true;
      console.log('[ServiceProvider] Workers initialized');
    } catch (error) {
      console.error('[ServiceProvider] Workers initialization failed:', error);
      this.migrationState.workersReady = false;
    }
  }

  /**
   * Get a service instance
   */
  getService(serviceName) {
    if (!this.isInitialized) {
      throw new Error('[ServiceProvider] Services not initialized. Call initialize() first.');
    }
    
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`[ServiceProvider] Service '${serviceName}' not found or not enabled.`);
    }
    
    return service;
  }

  /**
   * Check if a service is available
   */
  hasService(serviceName) {
    return this.services.has(serviceName);
  }

  /**
   * Get current migration state
   */
  getMigrationState() {
    return {
      ...this.migrationState,
      featureFlags: { ...FEATURE_FLAGS },
      servicesAvailable: Array.from(this.services.keys())
    };
  }

  /**
   * Enable a feature flag (for gradual migration)
   */
  enableFeature(featureName) {
    if (FEATURE_FLAGS.hasOwnProperty(featureName)) {
      FEATURE_FLAGS[featureName] = true;
      console.log(`[ServiceProvider] Feature '${featureName}' enabled`);
    } else {
      console.warn(`[ServiceProvider] Unknown feature flag: ${featureName}`);
    }
  }

  /**
   * Disable a feature flag
   */
  disableFeature(featureName) {
    if (FEATURE_FLAGS.hasOwnProperty(featureName)) {
      FEATURE_FLAGS[featureName] = false;
      console.log(`[ServiceProvider] Feature '${featureName}' disabled`);
    } else {
      console.warn(`[ServiceProvider] Unknown feature flag: ${featureName}`);
    }
  }

  /**
   * Storage adapter - routes requests to appropriate storage system
   */
  getStorageAdapter() {
    return {
      // AIDEV-NOTE: Simplified document operations - route to cold storage or legacy
      async addDocument(document) {
        console.log('[ServiceProvider][StorageAdapter] Adding document:', document.id || 'unknown');
        
        if (this.hasService('coldStorage') && FEATURE_FLAGS.useNewColdStorage) {
          console.log('[ServiceProvider][StorageAdapter] Using cold storage for document add');
          const coldStorage = this.getService('coldStorage');
          return await coldStorage.addDocument(document);
        } else {
          throw new Error('Cold storage not available. Document addition requires cold storage.');
        }
      },

      async getAllDocuments() {
        console.log('[ServiceProvider][StorageAdapter] Getting all documents');
        
        if (this.hasService('coldStorage') && FEATURE_FLAGS.useNewColdStorage) {
          console.log('[ServiceProvider][StorageAdapter] Using cold storage for getAllDocuments');
          const coldStorage = this.getService('coldStorage');
          return await coldStorage.getAllDocuments();
        } else {
          console.log('[ServiceProvider][StorageAdapter] Cold storage not available, returning empty array');
          return [];
        }
      },

      async searchDocuments(query, options = {}) {
        console.log('[ServiceProvider][StorageAdapter] Searching documents for query:', query);
        const results = [];

        // AIDEV-NOTE: Legacy search removed - cold storage only architecture

        // Search cold storage if available and authenticated
        if (this.hasService('coldStorage') && FEATURE_FLAGS.useNewColdStorage) {
          try {
            console.log('[ServiceProvider][StorageAdapter] Searching cold storage...');
            const coldStorage = this.getService('coldStorage');
            const coldResults = await coldStorage.searchDocuments(query, options);
            console.log('[ServiceProvider][StorageAdapter] Cold storage search returned:', coldResults.results?.length || 0, 'results');
            results.push(...coldResults.results);
          } catch (error) {
            console.warn('[ServiceProvider] Cold storage search failed, continuing with legacy only:', error);
          }
        } else {
          console.log('[ServiceProvider][StorageAdapter] Cold storage not available or not enabled');
        }

        console.log('[ServiceProvider][StorageAdapter] Total search results:', results.length);
        return results;
      },

      async deleteDocument(docId) {
        console.log('[ServiceProvider][StorageAdapter] Deleting document:', docId);
        
        // AIDEV-NOTE: Legacy storage deletion removed - cold storage only

        // Delete from cold storage if available
        if (this.hasService('coldStorage') && FEATURE_FLAGS.useNewColdStorage) {
          try {
            console.log('[ServiceProvider][StorageAdapter] Deleting from cold storage...');
            const coldStorage = this.getService('coldStorage');
            await coldStorage.deleteDocument(docId);
          } catch (error) {
            console.warn('[ServiceProvider] Cold storage delete failed:', error);
          }
        }
        
        console.log('[ServiceProvider][StorageAdapter] Document deletion completed');
      },

      async clearAllData() {
        console.log('[ServiceProvider][StorageAdapter] Clearing all data from all storages...');
        
        // AIDEV-NOTE: Legacy storage clearing removed - cold storage only

        // Clear cold storage if available
        if (this.hasService('coldStorage') && FEATURE_FLAGS.useNewColdStorage) {
          try {
            console.log('[ServiceProvider][StorageAdapter] Clearing cold storage...');
            const coldStorage = this.getService('coldStorage');
            await coldStorage.clearAll();
          } catch (error) {
            console.warn('[ServiceProvider] Cold storage clear failed:', error);
          }
        }
        
        console.log('[ServiceProvider][StorageAdapter] Clear all data completed');
      }
    };
  }

  // AIDEV-NOTE: Legacy search method removed - migration to cold storage completed

  /**
   * Get comprehensive status of all systems
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      migration: this.getMigrationState(),
      services: {
        // AIDEV-NOTE: Legacy services removed - cold storage only architecture
        coldStorage: this.hasService('coldStorage'),
        authentication: this.hasService('authentication'),
        workers: this.hasService('workers')
      }
    };
  }
}

// Create singleton instance
export const serviceProvider = new ServiceProvider();

// Export for module usage
export default serviceProvider;