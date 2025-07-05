/**
 * User-Friendly Error Handling
 * 
 * Provides user-facing error messages with contextual help and recovery suggestions.
 * Converts technical errors into actionable guidance for users.
 * 
 * AIDEV-NOTE: Implements the CLAUDE.md requirement for enhanced error handling
 */

export interface ErrorContext {
  operation?: string;
  component?: string;
  userAction?: string;
  technicalDetails?: string;
  timestamp?: Date;
  userId?: string;
  sessionId?: string;
}

export interface RecoveryAction {
  label: string;
  description: string;
  action?: () => void;
  url?: string;
  priority: 'primary' | 'secondary';
}

export interface UserFriendlyErrorOptions {
  title: string;
  message: string;
  context?: ErrorContext;
  recoveryActions?: RecoveryAction[];
  severity?: 'info' | 'warning' | 'error' | 'critical';
  showTechnicalDetails?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

/**
 * User-friendly error class that provides actionable error messages
 * AIDEV-NOTE: Replaces generic developer errors with contextual user guidance
 */
export class UserFriendlyError extends Error {
  public readonly title: string;
  public readonly userMessage: string;
  public readonly context: ErrorContext;
  public readonly recoveryActions: RecoveryAction[];
  public readonly severity: 'info' | 'warning' | 'error' | 'critical';
  public readonly showTechnicalDetails: boolean;
  public readonly autoHide: boolean;
  public readonly autoHideDelay: number;
  public readonly errorId: string;

  constructor(options: UserFriendlyErrorOptions, originalError?: Error) {
    // Call parent constructor with user-friendly message
    super(options.message);
    
    this.name = 'UserFriendlyError';
    this.title = options.title;
    this.userMessage = options.message;
    this.context = {
      timestamp: new Date(),
      ...options.context
    };
    this.recoveryActions = options.recoveryActions || [];
    this.severity = options.severity || 'error';
    this.showTechnicalDetails = options.showTechnicalDetails ?? false;
    this.autoHide = options.autoHide ?? false;
    this.autoHideDelay = options.autoHideDelay ?? 5000;
    this.errorId = this.generateErrorId();

    // Preserve original error stack if available
    if (originalError) {
      this.stack = originalError.stack;
      this.context.technicalDetails = originalError.message;
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Convert this error to a plain object for logging or transmission
   */
  public toJSON(): Record<string, any> {
    return {
      errorId: this.errorId,
      name: this.name,
      title: this.title,
      message: this.userMessage,
      severity: this.severity,
      context: this.context,
      recoveryActions: this.recoveryActions.map(action => ({
        label: action.label,
        description: action.description,
        priority: action.priority,
        hasAction: !!action.action,
        hasUrl: !!action.url
      })),
      stack: this.stack
    };
  }

  /**
   * Get a simple string representation for logging
   */
  public toString(): string {
    return `${this.title}: ${this.userMessage}`;
  }
}

/**
 * Factory class for creating common user-friendly errors
 * AIDEV-NOTE: Provides pre-configured error types for common scenarios
 */
export class UserFriendlyErrorFactory {
  
  /**
   * Authentication errors
   */
  static authentication(details: string, originalError?: Error): UserFriendlyError {
    return new UserFriendlyError({
      title: 'Authentication Required',
      message: 'Please enter your password to access encrypted documents.',
      context: {
        operation: 'authentication',
        technicalDetails: details
      },
      recoveryActions: [
        {
          label: 'Try Again',
          description: 'Re-enter your password',
          priority: 'primary'
        },
        {
          label: 'Help',
          description: 'Learn about document security',
          url: '#help-authentication',
          priority: 'secondary'
        }
      ],
      severity: 'warning',
      showTechnicalDetails: false
    }, originalError);
  }

  /**
   * Network/connectivity errors
   */
  static network(details: string, originalError?: Error): UserFriendlyError {
    return new UserFriendlyError({
      title: 'Connection Problem',
      message: 'Unable to connect to the document archive. Please check your internet connection and try again.',
      context: {
        operation: 'network',
        technicalDetails: details
      },
      recoveryActions: [
        {
          label: 'Retry',
          description: 'Try connecting again',
          priority: 'primary'
        },
        {
          label: 'Work Offline',
          description: 'Continue with cached documents',
          priority: 'secondary'
        }
      ],
      severity: 'error',
      showTechnicalDetails: false
    }, originalError);
  }

  /**
   * Search operation errors
   */
  static search(query: string, details: string, originalError?: Error): UserFriendlyError {
    return new UserFriendlyError({
      title: 'Search Unavailable',
      message: `Unable to search for "${query}". The document archive may be temporarily unavailable.`,
      context: {
        operation: 'search',
        userAction: `search for "${query}"`,
        technicalDetails: details
      },
      recoveryActions: [
        {
          label: 'Try Different Search',
          description: 'Search for different terms',
          priority: 'primary'
        },
        {
          label: 'Retry Search',
          description: 'Try the same search again',
          priority: 'secondary'
        }
      ],
      severity: 'error',
      showTechnicalDetails: false
    }, originalError);
  }

  /**
   * Memory/performance errors
   */
  static performance(operation: string, details: string, originalError?: Error): UserFriendlyError {
    return new UserFriendlyError({
      title: 'Performance Issue',
      message: 'The application is running slowly due to high memory usage. Some features may be temporarily limited.',
      context: {
        operation: 'performance',
        userAction: operation,
        technicalDetails: details
      },
      recoveryActions: [
        {
          label: 'Clear Cache',
          description: 'Free up memory by clearing cached data',
          priority: 'primary'
        },
        {
          label: 'Refresh Page',
          description: 'Reload the application',
          priority: 'secondary'
        }
      ],
      severity: 'warning',
      showTechnicalDetails: false,
      autoHide: true,
      autoHideDelay: 10000
    }, originalError);
  }

  /**
   * Data/storage errors
   */
  static storage(operation: string, details: string, originalError?: Error): UserFriendlyError {
    return new UserFriendlyError({
      title: 'Storage Error',
      message: 'Unable to access document storage. Your documents are safe, but some features may be limited.',
      context: {
        operation: 'storage',
        userAction: operation,
        technicalDetails: details
      },
      recoveryActions: [
        {
          label: 'Retry',
          description: 'Try the operation again',
          priority: 'primary'
        },
        {
          label: 'Report Issue',
          description: 'Contact support for help',
          url: '#support',
          priority: 'secondary'
        }
      ],
      severity: 'error',
      showTechnicalDetails: false
    }, originalError);
  }

  /**
   * Validation errors
   */
  static validation(field: string, value: string, requirement: string): UserFriendlyError {
    return new UserFriendlyError({
      title: 'Invalid Input',
      message: `${field} ${requirement}. Please check your input and try again.`,
      context: {
        operation: 'validation',
        userAction: `enter ${field}`,
        technicalDetails: `Field: ${field}, Value: ${value}, Requirement: ${requirement}`
      },
      recoveryActions: [
        {
          label: 'Fix Input',
          description: `Correct the ${field} and try again`,
          priority: 'primary'
        }
      ],
      severity: 'warning',
      showTechnicalDetails: false
    });
  }

  /**
   * Generic application errors with user context
   */
  static application(title: string, message: string, context: ErrorContext, originalError?: Error): UserFriendlyError {
    return new UserFriendlyError({
      title,
      message,
      context,
      recoveryActions: [
        {
          label: 'Refresh Page',
          description: 'Reload the application',
          priority: 'primary'
        },
        {
          label: 'Report Issue',
          description: 'Contact support for help',
          url: '#support',
          priority: 'secondary'
        }
      ],
      severity: 'error',
      showTechnicalDetails: false
    }, originalError);
  }

  /**
   * Browser compatibility errors
   */
  static compatibility(feature: string, details: string): UserFriendlyError {
    return new UserFriendlyError({
      title: 'Browser Compatibility',
      message: `Your browser doesn't support ${feature}. Please use a modern browser like Chrome, Firefox, or Safari.`,
      context: {
        operation: 'compatibility',
        technicalDetails: details
      },
      recoveryActions: [
        {
          label: 'Update Browser',
          description: 'Use the latest version of your browser',
          priority: 'primary'
        },
        {
          label: 'Switch Browser',
          description: 'Try a different modern browser',
          priority: 'secondary'
        }
      ],
      severity: 'error',
      showTechnicalDetails: false
    });
  }
}

/**
 * Error helper functions for common patterns
 * AIDEV-NOTE: Utility functions for consistent error handling
 */
export class ErrorHelpers {
  
  /**
   * Wrap async operations with user-friendly error handling
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    errorFactory: (error: Error) => UserFriendlyError
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw errorFactory(error as Error);
    }
  }

  /**
   * Wrap sync operations with user-friendly error handling
   */
  static wrap<T>(
    operation: () => T,
    errorFactory: (error: Error) => UserFriendlyError
  ): T {
    try {
      return operation();
    } catch (error) {
      throw errorFactory(error as Error);
    }
  }

  /**
   * Log error with structured data for debugging
   */
  static log(error: UserFriendlyError, level: 'warn' | 'error' = 'error'): void {
    const logData = {
      ...error.toJSON(),
      timestamp: error.context.timestamp?.toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    if (level === 'error') {
      console.error(`[UserFriendlyError] ${error.toString()}`, logData);
    } else {
      console.warn(`[UserFriendlyError] ${error.toString()}`, logData);
    }
  }

  /**
   * Check if error is a UserFriendlyError
   */
  static isUserFriendlyError(error: any): error is UserFriendlyError {
    return error instanceof UserFriendlyError;
  }

  /**
   * Extract user-safe message from any error
   */
  static getUserMessage(error: any): string {
    if (ErrorHelpers.isUserFriendlyError(error)) {
      return error.userMessage;
    }
    
    // Fallback for generic errors
    return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }

  /**
   * Get error severity from any error
   */
  static getSeverity(error: any): 'info' | 'warning' | 'error' | 'critical' {
    if (ErrorHelpers.isUserFriendlyError(error)) {
      return error.severity;
    }
    return 'error';
  }
}

// Types are already exported as interfaces above