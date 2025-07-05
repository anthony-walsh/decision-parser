/**
 * Vue Composable for Service Access
 * 
 * Provides reactive access to services from the DI container within Vue components.
 * Enables type-safe service injection and easy mocking for testing.
 * Updated to support abstraction layer services.
 * 
 * AIDEV-NOTE: Vue composable for type-safe service injection with abstraction layer support
 */

import { inject, provide, ref, type InjectionKey, type Ref } from 'vue';
import { container } from '@/services/DIContainer';
import type { ServiceRegistry, ServiceKey } from '@/services/interfaces';

// Abstraction layers removed - using direct service interfaces

// Injection keys for Vue's provide/inject system
export const SERVICE_CONTAINER_KEY: InjectionKey<any> = Symbol('serviceContainer');
export const IS_TESTING_KEY: InjectionKey<Ref<boolean>> = Symbol('isTesting');

/**
 * Composable for accessing services
 */
export function useServices() {
  const isTesting = inject(IS_TESTING_KEY, ref(false));
  const customContainer = inject(SERVICE_CONTAINER_KEY, null);

  /**
   * Get a service with type safety
   */
  function useService<T extends ServiceKey>(serviceName: T): ServiceRegistry[T] {
    try {
      if (customContainer && isTesting.value) {
        return customContainer.get(serviceName);
      }
      return container.get(serviceName);
    } catch (error) {
      console.error(`[useServices] Failed to get service '${serviceName}':`, error);
      throw error;
    }
  }

  /**
   * Check if a service is available
   */
  function hasServiceAvailable(serviceName: string): boolean {
    if (customContainer && isTesting.value) {
      return customContainer.has(serviceName);
    }
    return container.has(serviceName);
  }

  /**
   * Get multiple services at once
   */
  function useMultipleServices<T extends ServiceKey[]>(
    serviceNames: [...T]
  ): { [K in T[number]]: ServiceRegistry[K] } {
    const services = {} as any;
    
    for (const serviceName of serviceNames) {
      services[serviceName] = useService(serviceName);
    }
    
    return services;
  }

  // Abstraction layer methods removed - use direct service access

  return {
    useService,
    hasServiceAvailable,
    useMultipleServices
  };
}

/**
 * Composable for specific service types (convenience methods)
 */
export function useAuthenticationService() {
  const { useService } = useServices();
  return useService('authentication');
}

export function useEncryptionService() {
  const { useService } = useServices();
  return useService('encryption');
}

export function useColdStorageService() {
  const { useService } = useServices();
  return useService('coldStorage');
}

export function useSearchHistoryService() {
  const { useService } = useServices();
  return useService('searchHistory');
}

export function useLogger() {
  const { useService } = useServices();
  return useService('logger');
}

export function usePerformanceMonitor() {
  const { useService, hasServiceAvailable } = useServices();
  
  if (!hasServiceAvailable('performanceMonitor')) {
    // Return a no-op implementation if service is not available
    return {
      startTimer: () => ({ end: () => 0 }),
      recordMetric: () => {},
      getMetrics: () => [],
      clearMetrics: () => {},
      isPerformanceIssue: () => false
    };
  }
  
  return useService('performanceMonitor');
}

export function useMemoryManager() {
  const { useService, hasServiceAvailable } = useServices();
  
  if (!hasServiceAvailable('memoryManager')) {
    // Return a no-op implementation if service is not available
    return {
      isMemoryPressure: () => false,
      getMemoryInfo: () => ({}),
      clearCaches: async () => {},
      optimizeMemory: async () => {},
      onMemoryPressure: () => {}
    };
  }
  
  return useService('memoryManager');
}

/**
 * Provider setup for testing
 */
export function provideTestServices() {
  const isTesting = ref(true);
  const testContainer = container.createScope();
  
  provide(IS_TESTING_KEY, isTesting);
  provide(SERVICE_CONTAINER_KEY, testContainer);
  
  return {
    mockService: <T extends ServiceKey>(
      serviceName: T,
      mockInstance: ServiceRegistry[T]
    ) => {
      testContainer.mock(serviceName, mockInstance);
    },
    clearMocks: () => {
      testContainer.clear();
    }
  };
}

/**
 * Helper for creating service mocks in tests
 */
export function createServiceMocks() {
  return {
    authentication: {
      isAuthenticated: false,
      needsPasswordSetup: () => true,
      setupPassword: async () => {},
      authenticate: async () => true,
      logout: () => {},
      getAuthState: () => ({ isAuthenticated: false, isInitialized: true, hasChallenge: false }),
      deriveKeyForBatch: async () => ({} as CryptoKey)
    } as ServiceRegistry['authentication'],
    
    coldStorage: {
      isAuthenticated: false,
      isInitialized: false,
      initialize: async () => {},
      authenticate: async () => {},
      authenticateWithPassword: async () => {},
      search: async () => [],
      addDocument: async () => {},
      getAllDocuments: async () => [],
      deleteDocument: async () => {},
      clearAll: async () => {},
      getStorageInfo: async () => ({}),
      loadCacheStats: async () => ({}),
      clearCache: async () => {}
    } as ServiceRegistry['coldStorage'],
    
    searchHistory: {
      addSearchHistory: async () => {},
      getSearchHistory: async () => [],
      clearSearchHistory: async () => {},
      saveSearch: async () => {},
      getSavedSearches: async () => [],
      deleteSavedSearch: async () => {}
    } as ServiceRegistry['searchHistory'],
    
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      startTimer: () => ({ end: () => {} })
    } as ServiceRegistry['logger']
  };
}

/**
 * Test utility to setup a component with mocked services
 */
export function withMockedServices<T extends Partial<ServiceRegistry>>(mocks: T) {
  return {
    provide: {
      [IS_TESTING_KEY as symbol]: ref(true),
      [SERVICE_CONTAINER_KEY as symbol]: (() => {
        const testContainer = container.createScope();
        
        // Apply mocks
        Object.entries(mocks).forEach(([serviceName, mockInstance]) => {
          testContainer.mock(serviceName, mockInstance);
        });
        
        return testContainer;
      })()
    }
  };
}