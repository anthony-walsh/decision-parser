/**
 * Unit Tests for UserFriendlyError Utility
 * 
 * Testing user-friendly error handling, recovery actions, and error factories
 * AIDEV-NOTE: Tests for newly created UserFriendlyError system
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { 
  UserFriendlyError, 
  UserFriendlyErrorFactory, 
  ErrorHelpers,
  type ErrorContext,
  type RecoveryAction,
  type UserFriendlyErrorOptions
} from '../../../src/utils/UserFriendlyError';

// Mock console methods
let consoleErrorSpy: MockedFunction<any>;
let consoleWarnSpy: MockedFunction<any>;

describe('UserFriendlyError', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('UserFriendlyError Class', () => {
    it('should create error with basic options', () => {
      const options: UserFriendlyErrorOptions = {
        title: 'Test Error',
        message: 'This is a test error message'
      };

      const error = new UserFriendlyError(options);

      expect(error.title).toBe('Test Error');
      expect(error.userMessage).toBe('This is a test error message');
      expect(error.message).toBe('This is a test error message'); // Inherited from Error
      expect(error.severity).toBe('error'); // Default
      expect(error.errorId).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(error.context.timestamp).toBeInstanceOf(Date);
    });

    it('should create error with complete options', () => {
      const context: ErrorContext = {
        operation: 'search',
        component: 'SearchComponent',
        userAction: 'search for documents',
        technicalDetails: 'Database connection failed'
      };

      const recoveryActions: RecoveryAction[] = [
        {
          label: 'Retry',
          description: 'Try the search again',
          priority: 'primary'
        },
        {
          label: 'Help',
          description: 'Get help with searching',
          url: '#help',
          priority: 'secondary'
        }
      ];

      const options: UserFriendlyErrorOptions = {
        title: 'Search Failed',
        message: 'Unable to search documents at this time',
        context,
        recoveryActions,
        severity: 'warning',
        showTechnicalDetails: true,
        autoHide: true,
        autoHideDelay: 5000
      };

      const error = new UserFriendlyError(options);

      expect(error.title).toBe('Search Failed');
      expect(error.context.operation).toBe('search');
      expect(error.recoveryActions).toEqual(recoveryActions);
      expect(error.severity).toBe('warning');
      expect(error.showTechnicalDetails).toBe(true);
      expect(error.autoHide).toBe(true);
      expect(error.autoHideDelay).toBe(5000);
    });

    it('should preserve original error stack and details', () => {
      const originalError = new Error('Original technical error');
      originalError.stack = 'Original stack trace';

      const options: UserFriendlyErrorOptions = {
        title: 'User Error',
        message: 'Something went wrong'
      };

      const error = new UserFriendlyError(options, originalError);

      expect(error.stack).toBe('Original stack trace');
      expect(error.context.technicalDetails).toBe('Original technical error');
    });

    it('should serialize to JSON correctly', () => {
      const options: UserFriendlyErrorOptions = {
        title: 'Test Error',
        message: 'Test message',
        context: { operation: 'test' },
        recoveryActions: [
          {
            label: 'Retry',
            description: 'Try again',
            priority: 'primary',
            action: () => console.log('retry')
          }
        ],
        severity: 'critical'
      };

      const error = new UserFriendlyError(options);
      const json = error.toJSON();

      expect(json).toEqual({
        errorId: error.errorId,
        name: 'UserFriendlyError',
        title: 'Test Error',
        message: 'Test message',
        severity: 'critical',
        context: expect.objectContaining({ operation: 'test' }),
        recoveryActions: [
          {
            label: 'Retry',
            description: 'Try again',
            priority: 'primary',
            hasAction: true,
            hasUrl: false
          }
        ],
        stack: expect.any(String)
      });
    });

    it('should have meaningful string representation', () => {
      const error = new UserFriendlyError({
        title: 'Network Error',
        message: 'Connection failed'
      });

      expect(error.toString()).toBe('Network Error: Connection failed');
    });
  });

  describe('UserFriendlyErrorFactory', () => {
    describe('Authentication Errors', () => {
      it('should create authentication error', () => {
        const originalError = new Error('Invalid credentials');
        const error = UserFriendlyErrorFactory.authentication('Login failed', originalError);

        expect(error.title).toBe('Authentication Required');
        expect(error.userMessage).toBe('Please enter your password to access encrypted documents.');
        expect(error.severity).toBe('warning');
        expect(error.context.operation).toBe('authentication');
        expect(error.context.technicalDetails).toBe('Login failed');
        expect(error.recoveryActions).toHaveLength(2);
        expect(error.recoveryActions[0].label).toBe('Try Again');
        expect(error.recoveryActions[1].label).toBe('Help');
      });
    });

    describe('Network Errors', () => {
      it('should create network error', () => {
        const error = UserFriendlyErrorFactory.network('Timeout after 30s');

        expect(error.title).toBe('Connection Problem');
        expect(error.userMessage).toContain('Unable to connect to the document archive');
        expect(error.severity).toBe('error');
        expect(error.context.operation).toBe('network');
        expect(error.recoveryActions).toHaveLength(2);
        expect(error.recoveryActions[0].label).toBe('Retry');
        expect(error.recoveryActions[1].label).toBe('Work Offline');
      });
    });

    describe('Search Errors', () => {
      it('should create search error with query context', () => {
        const query = 'planning permission';
        const error = UserFriendlyErrorFactory.search(query, 'Index unavailable');

        expect(error.title).toBe('Search Unavailable');
        expect(error.userMessage).toContain(`Unable to search for "${query}"`);
        expect(error.context.userAction).toBe(`search for "${query}"`);
        expect(error.recoveryActions).toHaveLength(2);
        expect(error.recoveryActions[0].label).toBe('Try Different Search');
        expect(error.recoveryActions[1].label).toBe('Retry Search');
      });
    });

    describe('Performance Errors', () => {
      it('should create performance error with auto-hide', () => {
        const error = UserFriendlyErrorFactory.performance('memory cleanup', 'High memory usage detected');

        expect(error.title).toBe('Performance Issue');
        expect(error.userMessage).toContain('running slowly due to high memory usage');
        expect(error.severity).toBe('warning');
        expect(error.autoHide).toBe(true);
        expect(error.autoHideDelay).toBe(10000);
        expect(error.context.userAction).toBe('memory cleanup');
        expect(error.recoveryActions[0].label).toBe('Clear Cache');
      });
    });

    describe('Storage Errors', () => {
      it('should create storage error', () => {
        const error = UserFriendlyErrorFactory.storage('save document', 'Disk full');

        expect(error.title).toBe('Storage Error');
        expect(error.userMessage).toContain('Unable to access document storage');
        expect(error.context.userAction).toBe('save document');
        expect(error.recoveryActions[0].label).toBe('Retry');
        expect(error.recoveryActions[1].label).toBe('Report Issue');
      });
    });

    describe('Validation Errors', () => {
      it('should create validation error', () => {
        const error = UserFriendlyErrorFactory.validation('Email', 'test@', 'must be a valid email address');

        expect(error.title).toBe('Invalid Input');
        expect(error.userMessage).toBe('Email must be a valid email address. Please check your input and try again.');
        expect(error.severity).toBe('warning');
        expect(error.context.userAction).toBe('enter Email');
        expect(error.context.technicalDetails).toContain('Field: Email');
        expect(error.recoveryActions[0].label).toBe('Fix Input');
      });
    });

    describe('Application Errors', () => {
      it('should create generic application error', () => {
        const context: ErrorContext = {
          operation: 'data-processing',
          component: 'DataProcessor'
        };
        
        const error = UserFriendlyErrorFactory.application(
          'Processing Failed', 
          'Unable to process the data', 
          context
        );

        expect(error.title).toBe('Processing Failed');
        expect(error.userMessage).toBe('Unable to process the data');
        expect(error.context.operation).toBe('data-processing');
        expect(error.recoveryActions[0].label).toBe('Refresh Page');
        expect(error.recoveryActions[1].label).toBe('Report Issue');
      });
    });

    describe('Compatibility Errors', () => {
      it('should create browser compatibility error', () => {
        const error = UserFriendlyErrorFactory.compatibility('Web Workers', 'Not supported in this browser');

        expect(error.title).toBe('Browser Compatibility');
        expect(error.userMessage).toContain("Your browser doesn't support Web Workers");
        expect(error.context.technicalDetails).toBe('Not supported in this browser');
        expect(error.recoveryActions[0].label).toBe('Update Browser');
        expect(error.recoveryActions[1].label).toBe('Switch Browser');
      });
    });
  });

  describe('ErrorHelpers', () => {
    describe('Async Wrapper', () => {
      it('should wrap successful async operations', async () => {
        const successfulOperation = async () => 'success result';
        const errorFactory = (error: Error) => UserFriendlyErrorFactory.network(error.message);

        const result = await ErrorHelpers.wrapAsync(successfulOperation, errorFactory);
        expect(result).toBe('success result');
      });

      it('should wrap failed async operations with user-friendly errors', async () => {
        const failingOperation = async () => {
          throw new Error('Network timeout');
        };
        const errorFactory = (error: Error) => UserFriendlyErrorFactory.network(error.message);

        await expect(ErrorHelpers.wrapAsync(failingOperation, errorFactory))
          .rejects.toThrow(UserFriendlyError);

        try {
          await ErrorHelpers.wrapAsync(failingOperation, errorFactory);
        } catch (error) {
          expect(error).toBeInstanceOf(UserFriendlyError);
          expect((error as UserFriendlyError).title).toBe('Connection Problem');
        }
      });
    });

    describe('Sync Wrapper', () => {
      it('should wrap successful sync operations', () => {
        const successfulOperation = () => 42;
        const errorFactory = (error: Error) => UserFriendlyErrorFactory.application('Math Error', error.message, {});

        const result = ErrorHelpers.wrap(successfulOperation, errorFactory);
        expect(result).toBe(42);
      });

      it('should wrap failed sync operations with user-friendly errors', () => {
        const failingOperation = () => {
          throw new Error('Division by zero');
        };
        const errorFactory = (error: Error) => UserFriendlyErrorFactory.application('Math Error', error.message, {});

        expect(() => ErrorHelpers.wrap(failingOperation, errorFactory))
          .toThrow(UserFriendlyError);
      });
    });

    describe('Error Logging', () => {
      it('should log error with structured data', () => {
        const error = UserFriendlyErrorFactory.search('test query', 'Search failed');
        
        ErrorHelpers.log(error, 'error');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[UserFriendlyError] Search Unavailable: Unable to search for "test query"'),
          expect.objectContaining({
            errorId: error.errorId,
            title: 'Search Unavailable',
            severity: 'error',
            userAgent: expect.any(String),
            url: expect.any(String)
          })
        );
      });

      it('should log warning level errors', () => {
        const error = UserFriendlyErrorFactory.validation('name', '', 'is required');
        
        ErrorHelpers.log(error, 'warn');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[UserFriendlyError] Invalid Input'),
          expect.any(Object)
        );
      });
    });

    describe('Error Type Checking', () => {
      it('should identify UserFriendlyError instances', () => {
        const userFriendlyError = new UserFriendlyError({
          title: 'Test',
          message: 'Test message'
        });
        const regularError = new Error('Regular error');

        expect(ErrorHelpers.isUserFriendlyError(userFriendlyError)).toBe(true);
        expect(ErrorHelpers.isUserFriendlyError(regularError)).toBe(false);
        expect(ErrorHelpers.isUserFriendlyError('string')).toBe(false);
        expect(ErrorHelpers.isUserFriendlyError(null)).toBe(false);
      });
    });

    describe('Message Extraction', () => {
      it('should extract user message from UserFriendlyError', () => {
        const error = new UserFriendlyError({
          title: 'Test Error',
          message: 'User-friendly message'
        });

        const message = ErrorHelpers.getUserMessage(error);
        expect(message).toBe('User-friendly message');
      });

      it('should provide fallback message for regular errors', () => {
        const regularError = new Error('Technical error');
        
        const message = ErrorHelpers.getUserMessage(regularError);
        expect(message).toBe('An unexpected error occurred. Please try again or contact support if the problem persists.');
      });

      it('should handle non-error objects', () => {
        const message = ErrorHelpers.getUserMessage('string error');
        expect(message).toBe('An unexpected error occurred. Please try again or contact support if the problem persists.');
      });
    });

    describe('Severity Extraction', () => {
      it('should extract severity from UserFriendlyError', () => {
        const criticalError = new UserFriendlyError({
          title: 'Critical Error',
          message: 'System failure',
          severity: 'critical'
        });

        expect(ErrorHelpers.getSeverity(criticalError)).toBe('critical');
      });

      it('should provide default severity for regular errors', () => {
        const regularError = new Error('Some error');
        expect(ErrorHelpers.getSeverity(regularError)).toBe('error');
      });
    });
  });

  describe('Integration Examples', () => {
    it('should work in a realistic authentication scenario', async () => {
      const authenticateUser = async (password: string) => {
        if (!password) {
          throw new Error('Password is required');
        }
        if (password.length < 8) {
          throw new Error('Password too short');
        }
        return 'auth-token-123';
      };

      // Wrap with user-friendly error handling
      const safeAuthenticate = (password: string) =>
        ErrorHelpers.wrapAsync(
          () => authenticateUser(password),
          (error) => UserFriendlyErrorFactory.authentication(error.message, error)
        );

      // Test successful authentication
      const token = await safeAuthenticate('securepassword123');
      expect(token).toBe('auth-token-123');

      // Test failed authentication
      try {
        await safeAuthenticate('short');
      } catch (error) {
        expect(error).toBeInstanceOf(UserFriendlyError);
        const userError = error as UserFriendlyError;
        expect(userError.title).toBe('Authentication Required');
        expect(userError.recoveryActions[0].label).toBe('Try Again');
        expect(userError.context.technicalDetails).toBe('Password too short');
      }
    });

    it('should work in a realistic search scenario', () => {
      const performSearch = (query: string) => {
        if (!query.trim()) {
          throw new Error('Empty query provided');
        }
        if (query.length < 3) {
          throw new Error('Query too short');
        }
        return [`Result for ${query}`];
      };

      // Wrap with user-friendly error handling
      const safeSearch = (query: string) =>
        ErrorHelpers.wrap(
          () => performSearch(query),
          (error) => UserFriendlyErrorFactory.search(query, error.message, error)
        );

      // Test successful search
      const results = safeSearch('planning permission');
      expect(results).toEqual(['Result for planning permission']);

      // Test failed search
      try {
        safeSearch('ab');
      } catch (error) {
        expect(error).toBeInstanceOf(UserFriendlyError);
        const userError = error as UserFriendlyError;
        expect(userError.userMessage).toContain('Unable to search for "ab"');
        expect(userError.recoveryActions[0].label).toBe('Try Different Search');
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined/null values gracefully', () => {
      expect(() => new UserFriendlyError({
        title: '',
        message: ''
      })).not.toThrow();

      expect(ErrorHelpers.getUserMessage(undefined)).toBeTruthy();
      expect(ErrorHelpers.getSeverity(null)).toBe('error');
    });

    it('should handle circular references in context', () => {
      const circularObject: any = { name: 'test' };
      circularObject.self = circularObject;

      expect(() => new UserFriendlyError({
        title: 'Test',
        message: 'Test message',
        context: { data: circularObject }
      })).not.toThrow();
    });

    it('should generate unique error IDs', () => {
      const error1 = new UserFriendlyError({ title: 'Test 1', message: 'Message 1' });
      const error2 = new UserFriendlyError({ title: 'Test 2', message: 'Message 2' });

      expect(error1.errorId).not.toBe(error2.errorId);
      expect(error1.errorId).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(error2.errorId).toMatch(/^error_\d+_[a-z0-9]+$/);
    });
  });
});