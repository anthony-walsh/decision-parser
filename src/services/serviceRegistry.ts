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
    const { coldStorageService } = await import('@/services/ColdStorageService');
    return coldStorageService;
  } catch (error) {
    console.warn('[ServiceRegistry] Cold storage service not available:', error);
    return null;
  }
}

async function getMemoryManager() {
  try {
    const { memoryManager } = await import('./MemoryManager');
    return memoryManager;
  } catch (error) {
    console.warn('[ServiceRegistry] Memory manager not available:', error);
    return null;
  }
}

async function getPerformanceMonitor() {
  try {
    const { performanceMonitor } = await import('./PerformanceMonitor');
    return performanceMonitor;
  } catch (error) {
    console.warn('[ServiceRegistry] Performance monitor not available:', error);
    return null;
  }
}

async function getAppealImportService() {
  try {
    const { appealImportService } = await import('./AppealImportService');
    return appealImportService;
  } catch (error) {
    console.warn('[ServiceRegistry] Appeal import service not available:', error);
    return null;
  }
}

/**
 * Register all services in the DI container
 */
export async function registerServices(): Promise<void> {
  console.log('[ServiceRegistry] Registering services in DI container...');

  try {
    // Core services (always available)
    
    // Authentication Service - singleton instance
    container.registerSingleton('authentication', new AuthenticationService());
    
    // Encryption Service - singleton instance  
    container.registerSingleton('encryption', new EncryptionService());
    
    // Search History Service - existing singleton
    container.registerSingleton('searchHistory', searchHistoryService);
    
    // Logger - existing singleton
    container.registerSingleton('logger', logger);
    
    // ServiceProvider removed - using DI container directly

    // Optional services (dynamic imports)
    
    // Cold Storage Service
    const coldStorage = await getColdStorageService();
    if (coldStorage) {
      // AIDEV-NOTE: Debug logging to verify singleton instance consistency
      console.log('[ServiceRegistry] Cold storage service instance:', coldStorage.constructor.name);
      console.log('[ServiceRegistry] Cold storage instance ID:', coldStorage.toString());
      
      // Initialize the service before registering
      await coldStorage.initialize();
      container.registerSingleton('coldStorage', coldStorage);
      console.log('[ServiceRegistry] Cold storage service registered and initialized');
    }
    
    // Memory Manager
    const memoryManager = await getMemoryManager();
    if (memoryManager) {
      container.registerSingleton('memoryManager', memoryManager);
      console.log('[ServiceRegistry] Memory manager registered');
    }
    
    // Performance Monitor
    const performanceMonitor = await getPerformanceMonitor();
    if (performanceMonitor) {
      container.registerSingleton('performanceMonitor', performanceMonitor);
      console.log('[ServiceRegistry] Performance monitor registered');
    }
    
    // Appeal Import Service
    const appealImport = await getAppealImportService();
    if (appealImport) {
      container.registerSingleton('appealImport', appealImport);
      console.log('[ServiceRegistry] Appeal import service registered');
    }

    console.log('[ServiceRegistry] Service registration completed');
    console.log('[ServiceRegistry] Available services:', container.getServiceNames());

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
  console.log('[ServiceRegistry] Initializing service system...');
  
  // Register all services
  await registerServices();
  
  // Validate services
  await validateServices();
  
  // Core services initialized via DI container
  console.log('[ServiceRegistry] Core services initialized via DI container');
  
  console.log('[ServiceRegistry] Service system initialization completed');
}

// Export the container for direct access if needed
export { container };