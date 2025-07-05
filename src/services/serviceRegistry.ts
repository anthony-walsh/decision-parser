/**
 * Service Registry - DI Container Configuration
 * 
 * Configures all services in the dependency injection container with proper
 * dependencies and lifecycle management.
 * 
 * AIDEV-NOTE: Centralized service registration for DI container
 */

import { container } from './DIContainer';
import { AuthenticationService } from './AuthenticationService';
import { EncryptionService } from './EncryptionService';
import { searchHistoryService } from '@/utils/searchHistoryService';
import { logger } from '@/utils/logger';

// ServiceProvider removed - using DI container only

// Dynamic imports for services that might not always be available
async function getColdStorageService() {
  try {
    console.log('[ServiceRegistry] Loading ColdStorageService...');
    const { coldStorageService } = await import('@/services/ColdStorageService');
    console.log('[ServiceRegistry] ColdStorageService loaded successfully');
    return coldStorageService;
  } catch (error) {
    console.warn('[ServiceRegistry] Cold storage service not available:', error);
    console.warn('[ServiceRegistry] This is non-critical - app will continue without cold storage');
    return null;
  }
}

async function getMemoryManager() {
  try {
    console.log('[ServiceRegistry] Loading MemoryManager...');
    const { memoryManager } = await import('./MemoryManager');
    console.log('[ServiceRegistry] MemoryManager loaded successfully');
    return memoryManager;
  } catch (error) {
    console.warn('[ServiceRegistry] Memory manager not available:', error);
    console.warn('[ServiceRegistry] This is non-critical - app will continue without memory management');
    return null;
  }
}

async function getPerformanceMonitor() {
  try {
    console.log('[ServiceRegistry] Loading PerformanceMonitor...');
    const { performanceMonitor } = await import('./PerformanceMonitor');
    console.log('[ServiceRegistry] PerformanceMonitor loaded successfully');
    return performanceMonitor;
  } catch (error) {
    console.warn('[ServiceRegistry] Performance monitor not available:', error);
    console.warn('[ServiceRegistry] This is non-critical - app will continue without performance monitoring');
    return null;
  }
}

async function getAppealImportService() {
  try {
    console.log('[ServiceRegistry] Loading AppealImportService...');
    const { appealImportService } = await import('./AppealImportService');
    console.log('[ServiceRegistry] AppealImportService loaded successfully');
    return appealImportService;
  } catch (error) {
    console.warn('[ServiceRegistry] Appeal import service not available:', error);
    console.warn('[ServiceRegistry] This is non-critical - app will continue without appeal import');
    return null;
  }
}

/**
 * Register all services in the DI container
 */
export async function registerServices(): Promise<void> {
  console.log('[ServiceRegistry] Registering services in DI container...');

  const registrationResults = {
    core: { success: 0, failed: 0, errors: [] as string[] },
    optional: { success: 0, failed: 0, errors: [] as string[] }
  };

  try {
    // Core services (always available) - these must succeed
    console.log('[ServiceRegistry] Registering core services...');
    
    try {
      // Authentication Service - singleton instance
      container.registerSingleton('authentication', new AuthenticationService());
      console.log('[ServiceRegistry] ✓ Authentication service registered');
      registrationResults.core.success++;
    } catch (error) {
      const msg = `Authentication service failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.core.failed++;
      registrationResults.core.errors.push(msg);
      console.error('[ServiceRegistry] ✗', msg);
    }
    
    try {
      // Encryption Service - singleton instance  
      container.registerSingleton('encryption', new EncryptionService());
      console.log('[ServiceRegistry] ✓ Encryption service registered');
      registrationResults.core.success++;
    } catch (error) {
      const msg = `Encryption service failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.core.failed++;
      registrationResults.core.errors.push(msg);
      console.error('[ServiceRegistry] ✗', msg);
    }
    
    try {
      // Search History Service - existing singleton
      container.registerSingleton('searchHistory', searchHistoryService);
      console.log('[ServiceRegistry] ✓ Search history service registered');
      registrationResults.core.success++;
    } catch (error) {
      const msg = `Search history service failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.core.failed++;
      registrationResults.core.errors.push(msg);
      console.error('[ServiceRegistry] ✗', msg);
    }
    
    try {
      // Logger - existing singleton
      container.registerSingleton('logger', logger);
      console.log('[ServiceRegistry] ✓ Logger service registered');
      registrationResults.core.success++;
    } catch (error) {
      const msg = `Logger service failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.core.failed++;
      registrationResults.core.errors.push(msg);
      console.error('[ServiceRegistry] ✗', msg);
    }

    // Optional services (dynamic imports) - failures are acceptable
    console.log('[ServiceRegistry] Registering optional services...');
    
    // Cold Storage Service
    try {
      const coldStorage = await getColdStorageService();
      if (coldStorage) {
        // AIDEV-NOTE: Debug logging to verify singleton instance consistency
        console.log('[ServiceRegistry] Cold storage service instance:', coldStorage.constructor.name);
        
        // Initialize the service before registering
        await coldStorage.initialize();
        container.registerSingleton('coldStorage', coldStorage);
        console.log('[ServiceRegistry] ✓ Cold storage service registered and initialized');
        registrationResults.optional.success++;
      } else {
        console.log('[ServiceRegistry] ~ Cold storage service skipped (not available)');
      }
    } catch (error) {
      const msg = `Cold storage service failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.optional.failed++;
      registrationResults.optional.errors.push(msg);
      console.warn('[ServiceRegistry] ✗', msg);
    }
    
    // Memory Manager
    try {
      const memoryManager = await getMemoryManager();
      if (memoryManager) {
        container.registerSingleton('memoryManager', memoryManager);
        console.log('[ServiceRegistry] ✓ Memory manager registered');
        registrationResults.optional.success++;
      } else {
        console.log('[ServiceRegistry] ~ Memory manager skipped (not available)');
      }
    } catch (error) {
      const msg = `Memory manager failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.optional.failed++;
      registrationResults.optional.errors.push(msg);
      console.warn('[ServiceRegistry] ✗', msg);
    }
    
    // Performance Monitor
    try {
      const performanceMonitor = await getPerformanceMonitor();
      if (performanceMonitor) {
        container.registerSingleton('performanceMonitor', performanceMonitor);
        console.log('[ServiceRegistry] ✓ Performance monitor registered');
        registrationResults.optional.success++;
      } else {
        console.log('[ServiceRegistry] ~ Performance monitor skipped (not available)');
      }
    } catch (error) {
      const msg = `Performance monitor failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.optional.failed++;
      registrationResults.optional.errors.push(msg);
      console.warn('[ServiceRegistry] ✗', msg);
    }
    
    // Appeal Import Service
    try {
      const appealImport = await getAppealImportService();
      if (appealImport) {
        container.registerSingleton('appealImport', appealImport);
        console.log('[ServiceRegistry] ✓ Appeal import service registered');
        registrationResults.optional.success++;
      } else {
        console.log('[ServiceRegistry] ~ Appeal import service skipped (not available)');
      }
    } catch (error) {
      const msg = `Appeal import service failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      registrationResults.optional.failed++;
      registrationResults.optional.errors.push(msg);
      console.warn('[ServiceRegistry] ✗', msg);
    }

    // Log registration summary
    console.log('[ServiceRegistry] Service registration summary:');
    console.log(`[ServiceRegistry] Core services: ${registrationResults.core.success}/${registrationResults.core.success + registrationResults.core.failed} successful`);
    console.log(`[ServiceRegistry] Optional services: ${registrationResults.optional.success}/${registrationResults.optional.success + registrationResults.optional.failed} successful`);
    console.log('[ServiceRegistry] Available services:', container.getServiceNames());

    // Check if critical core services failed
    if (registrationResults.core.failed > 0) {
      const errorMsg = `Critical core services failed: ${registrationResults.core.errors.join(', ')}`;
      console.error('[ServiceRegistry]', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('[ServiceRegistry] Service registration completed successfully');

  } catch (error) {
    console.error('[ServiceRegistry] Service registration failed:', error);
    throw error;
  }
}

/**
 * Validate all registered services
 */
export async function validateServices(): Promise<void> {
  console.log('[ServiceRegistry] Validating services...');
  
  const validation = await container.validateServices();
  
  if (!validation.success) {
    console.error('[ServiceRegistry] Service validation failed:', validation.errors);
    throw new Error(`Service validation failed: ${validation.errors.join(', ')}`);
  }
  
  console.log('[ServiceRegistry] All services validated successfully');
}

/**
 * Get a service from the container with type safety
 */
export function getService<T extends keyof import('./interfaces').ServiceRegistry>(
  serviceName: T
): import('./interfaces').ServiceRegistry[T] {
  return container.get(serviceName);
}

/**
 * Check if a service is available
 */
export function hasService(serviceName: string): boolean {
  return container.has(serviceName);
}

/**
 * Create a test scope with mocked services
 */
export function createTestScope(): typeof container {
  return container.createScope();
}

/**
 * Mock a service in the container (for testing)
 */
export function mockService<T extends keyof import('./interfaces').ServiceRegistry>(
  serviceName: T,
  mockInstance: import('./interfaces').ServiceRegistry[T]
): void {
  container.mock(serviceName, mockInstance);
}

/**
 * Initialize the service system
 */
export async function initializeServices(): Promise<void> {
  const startTime = performance.now();
  console.log('[ServiceRegistry] === SERVICE INITIALIZATION START ===');
  console.log(`[ServiceRegistry] Timestamp: ${new Date().toISOString()}`);
  console.log(`[ServiceRegistry] Environment: ${(globalThis as any)?.import?.meta?.env?.MODE || 'unknown'}`);
  
  try {
    // Step 1: Register all services
    console.log('[ServiceRegistry] STEP 1: Registering services...');
    const registrationStart = performance.now();
    
    await registerServices();
    
    const registrationTime = performance.now() - registrationStart;
    console.log(`[ServiceRegistry] STEP 1 COMPLETE: Service registration took ${registrationTime.toFixed(2)}ms`);
    
    // Step 2: Validate services
    console.log('[ServiceRegistry] STEP 2: Validating services...');
    const validationStart = performance.now();
    
    await validateServices();
    
    const validationTime = performance.now() - validationStart;
    console.log(`[ServiceRegistry] STEP 2 COMPLETE: Service validation took ${validationTime.toFixed(2)}ms`);
    
    // Step 3: Final initialization
    console.log('[ServiceRegistry] STEP 3: Final service initialization...');
    console.log('[ServiceRegistry] Core services initialized via DI container');
    
    const totalTime = performance.now() - startTime;
    console.log(`[ServiceRegistry] === SERVICE INITIALIZATION COMPLETE ===`);
    console.log(`[ServiceRegistry] Total initialization time: ${totalTime.toFixed(2)}ms`);
    console.log(`[ServiceRegistry] Services available: ${container.getServiceNames().join(', ')}`);
    
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(`[ServiceRegistry] === SERVICE INITIALIZATION FAILED ===`);
    console.error(`[ServiceRegistry] Failed after ${totalTime.toFixed(2)}ms`);
    console.error(`[ServiceRegistry] Error:`, error);
    console.error(`[ServiceRegistry] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

// Export the container for direct access if needed
export { container };