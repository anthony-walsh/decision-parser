/**
 * Tests for Dependency Injection Container
 * 
 * Demonstrates how the DI container improves testability by enabling
 * easy service mocking and dependency management.
 * 
 * AIDEV-NOTE: Example tests showing DI container benefits for testability
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DIContainer } from '@/services/DIContainer';
import type { IAuthenticationService, ILogger } from '@/services/interfaces';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('service registration', () => {
    it('should register and retrieve singleton instances', () => {
      const mockService = { test: 'value' };
      container.registerSingleton('testService', mockService);

      const retrieved = container.get('testService');
      expect(retrieved).toBe(mockService);
    });

    it('should register and instantiate classes', () => {
      class TestService {
        value = 'test';
      }

      container.registerClass('testService', TestService);
      const instance = container.get('testService');
      
      expect(instance).toBeInstanceOf(TestService);
      expect(instance.value).toBe('test');
    });

    it('should handle dependencies', () => {
      class Logger {
        log(message: string) { return `LOG: ${message}`; }
      }

      class ServiceWithDependency {
        constructor(private logger: Logger) {}
        
        doSomething() {
          return this.logger.log('doing something');
        }
      }

      container.registerClass('logger', Logger);
      container.registerClass('serviceWithDep', ServiceWithDependency, ['logger']);

      const service = container.get('serviceWithDep');
      expect(service.doSomething()).toBe('LOG: doing something');
    });

    it('should detect circular dependencies', () => {
      class ServiceA {
        constructor(public serviceB: any) {}
      }

      class ServiceB {
        constructor(public serviceA: any) {}
      }

      container.registerClass('serviceA', ServiceA, ['serviceB']);
      container.registerClass('serviceB', ServiceB, ['serviceA']);

      expect(() => container.get('serviceA')).toThrow(/circular dependency/i);
    });
  });

  describe('factory registration', () => {
    it('should use factory functions', () => {
      const factory = vi.fn(() => ({ created: Date.now() }));
      
      container.registerFactory('factoryService', factory);
      const instance = container.get('factoryService');
      
      expect(factory).toHaveBeenCalledOnce();
      expect(instance.created).toBeTypeOf('number');
    });
  });

  describe('service validation', () => {
    it('should validate all services successfully', async () => {
      container.registerSingleton('validService', { working: true });
      
      const validation = await container.validateServices();
      
      expect(validation.success).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report validation errors', async () => {
      // Register a service that will fail
      container.registerClass('failingService', class {
        constructor() {
          throw new Error('Construction failed');
        }
      });

      const validation = await container.validateServices();
      
      expect(validation.success).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('Construction failed');
    });
  });

  describe('scoping and mocking', () => {
    it('should create child scopes', () => {
      container.registerSingleton('originalService', { value: 'original' });
      
      const scope = container.createScope();
      scope.mock('originalService', { value: 'mocked' });
      
      // Original container unchanged
      expect(container.get('originalService').value).toBe('original');
      
      // Scope has mocked version
      expect(scope.get('originalService').value).toBe('mocked');
    });

    it('should allow service mocking', () => {
      const originalService = { authenticate: () => false };
      container.registerSingleton('auth', originalService);
      
      const mockService = { authenticate: () => true };
      container.mock('auth', mockService);
      
      expect(container.get('auth')).toBe(mockService);
    });
  });

  describe('error handling', () => {
    it('should throw error for unregistered services', () => {
      expect(() => container.get('nonexistent')).toThrow(/not found/i);
    });

    it('should provide helpful error messages', () => {
      container.registerSingleton('service1', {});
      container.registerSingleton('service2', {});
      
      expect(() => container.get('wrongService')).toThrow(/available services: service1, service2/i);
    });
  });
});

// Example test showing how to use DI for component testing
describe('Component Testing with DI', () => {
  it('should demonstrate service mocking in component tests', () => {
    // This shows how you would test a component that uses services
    const container = new DIContainer();
    
    // Mock authentication service
    const mockAuthService: IAuthenticationService = {
      isAuthenticated: true,
      needsPasswordSetup: () => false,
      setupPassword: vi.fn().mockResolvedValue(undefined),
      authenticate: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      getAuthState: () => ({ isAuthenticated: true, isInitialized: true, hasChallenge: true }),
      deriveKeyForBatch: vi.fn().mockResolvedValue({} as CryptoKey)
    };
    
    // Mock logger
    const mockLogger: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      startTimer: vi.fn(() => ({ end: vi.fn() }))
    };
    
    container.registerSingleton('authentication', mockAuthService);
    container.registerSingleton('logger', mockLogger);
    
    // Now your component would use these mocked services
    const authService = container.get('authentication');
    const logger = container.get('logger');
    
    // Test component behavior
    expect(authService.isAuthenticated).toBe(true);
    
    logger.info('Test message', { test: true });
    expect(mockLogger.info).toHaveBeenCalledWith('Test message', { test: true });
  });
});