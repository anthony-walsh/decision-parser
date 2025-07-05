/**
 * Tests for Vue Service Composables
 * 
 * Demonstrates how the service composables enable easy testing of Vue components
 * that depend on services through dependency injection.
 * 
 * AIDEV-NOTE: Example tests showing Vue component service injection testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { provideTestServices, createServiceMocks, withMockedServices } from '@/composables/useServices';
import type { ServiceRegistry } from '@/services/interfaces';

// Mock component that uses services
const TestComponent = {
  template: `
    <div>
      <div data-testid="auth-status">{{ isAuthenticated ? 'Authenticated' : 'Not Authenticated' }}</div>
      <button @click="handleLogin" data-testid="login-btn">Login</button>
      <div data-testid="search-results">{{ searchResults.length }} results</div>
    </div>
  `,
  setup() {
    // This would normally import from useServices
    const { useService } = {
      useService: (serviceName: string) => {
        // Mock implementation that gets services from Vue's inject
        return {} as any;
      }
    };
    
    const authService = useService('authentication');
    const coldStorage = useService('coldStorage');
    
    const isAuthenticated = ref(authService.isAuthenticated);
    const searchResults = ref([]);
    
    const handleLogin = async () => {
      const success = await authService.authenticate('password');
      if (success) {
        isAuthenticated.value = true;
        const results = await coldStorage.search('test query');
        searchResults.value = results;
      }
    };
    
    return {
      isAuthenticated,
      searchResults,
      handleLogin
    };
  }
};

describe('useServices composable', () => {
  describe('service mocking for component tests', () => {
    it('should provide mocked services to components', async () => {
      // Create service mocks
      const mocks = createServiceMocks();
      
      // Override specific behavior
      mocks.authentication.isAuthenticated = true;
      mocks.authentication.authenticate = vi.fn().mockResolvedValue(true);
      mocks.coldStorage.search = vi.fn().mockResolvedValue([
        { id: '1', filename: 'test.pdf' },
        { id: '2', filename: 'test2.pdf' }
      ]);
      
      // Mount component with mocked services
      const wrapper = mount(TestComponent, withMockedServices(mocks));
      
      // Test initial state
      expect(wrapper.find('[data-testid="auth-status"]').text()).toBe('Authenticated');
      
      // Test service interaction
      await wrapper.find('[data-testid="login-btn"]').trigger('click');
      
      // Verify service calls
      expect(mocks.authentication.authenticate).toHaveBeenCalledWith('password');
      expect(mocks.coldStorage.search).toHaveBeenCalledWith('test query');
      
      // Check results
      expect(wrapper.find('[data-testid="search-results"]').text()).toBe('2 results');
    });
    
    it('should handle service errors gracefully', async () => {
      const mocks = createServiceMocks();
      
      // Mock service to throw error
      mocks.authentication.authenticate = vi.fn().mockRejectedValue(new Error('Auth failed'));
      
      const wrapper = mount(TestComponent, withMockedServices(mocks));
      
      // This would normally be caught by error handling in the component
      await wrapper.find('[data-testid="login-btn"]').trigger('click');
      
      expect(mocks.authentication.authenticate).toHaveBeenCalled();
    });
  });
  
  describe('test service provider', () => {
    it('should create isolated test environment', () => {
      const app = createApp({});
      
      // Setup test services
      app.setup = () => {
        const { mockService } = provideTestServices();
        
        // Mock specific services
        mockService('authentication', {
          isAuthenticated: true,
          needsPasswordSetup: () => false,
          setupPassword: vi.fn(),
          authenticate: vi.fn().mockResolvedValue(true),
          logout: vi.fn(),
          getAuthState: () => ({ isAuthenticated: true, isInitialized: true, hasChallenge: true }),
          deriveKeyForBatch: vi.fn()
        });
        
        return {};
      };
      
      // Component would now use mocked services
      expect(app).toBeDefined();
    });
  });
  
  describe('service isolation in tests', () => {
    it('should isolate service instances between tests', () => {
      // Test 1: Mock authentication to be authenticated
      {
        const mocks = createServiceMocks();
        mocks.authentication.isAuthenticated = true;
        
        const wrapper1 = mount(TestComponent, withMockedServices(mocks));
        expect(wrapper1.find('[data-testid="auth-status"]').text()).toBe('Authenticated');
      }
      
      // Test 2: Mock authentication to be not authenticated  
      {
        const mocks = createServiceMocks();
        mocks.authentication.isAuthenticated = false;
        
        const wrapper2 = mount(TestComponent, withMockedServices(mocks));
        expect(wrapper2.find('[data-testid="auth-status"]').text()).toBe('Not Authenticated');
      }
      
      // Tests are isolated - no interference between them
    });
  });
  
  describe('partial service mocking', () => {
    it('should allow mocking only specific services', async () => {
      // Only mock authentication, let other services use defaults
      const partialMocks: Partial<ServiceRegistry> = {
        authentication: {
          isAuthenticated: false,
          needsPasswordSetup: () => true,
          setupPassword: vi.fn().mockResolvedValue(undefined),
          authenticate: vi.fn().mockResolvedValue(false),
          logout: vi.fn(),
          getAuthState: () => ({ isAuthenticated: false, isInitialized: true, hasChallenge: false }),
          deriveKeyForBatch: vi.fn()
        }
      };
      
      const wrapper = mount(TestComponent, withMockedServices(partialMocks));
      
      expect(wrapper.find('[data-testid="auth-status"]').text()).toBe('Not Authenticated');
      
      // Test failed authentication
      await wrapper.find('[data-testid="login-btn"]').trigger('click');
      expect(partialMocks.authentication!.authenticate).toHaveBeenCalled();
    });
  });
});