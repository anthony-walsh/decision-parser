/**
 * Structured Logging Utility for Cold Storage Testing
 * 
 * Provides categorized logging with consistent formatting for debugging
 * import operations, data transformations, and cold storage interactions.
 * 
 * AIDEV-NOTE: Extensive logging infrastructure for debugging cold storage integration
 */

export type LogCategory = 'IMPORT' | 'TRANSFORM' | 'COLD-STORAGE' | 'UI' | 'PERFORMANCE' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  category: LogCategory;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  source?: string;
}

class Logger {
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;
  private enabledCategories: Set<LogCategory> = new Set([
    'IMPORT', 'TRANSFORM', 'COLD-STORAGE', 'UI', 'PERFORMANCE', 'ERROR'
  ]);

  /**
   * Enable or disable specific log categories
   */
  setEnabledCategories(categories: LogCategory[]) {
    this.enabledCategories = new Set(categories);
  }

  /**
   * Check if a category is enabled
   */
  isCategoryEnabled(category: LogCategory): boolean {
    return this.enabledCategories.has(category);
  }

  /**
   * Core logging method
   */
  private log(
    category: LogCategory, 
    level: 'debug' | 'info' | 'warn' | 'error', 
    message: string, 
    data?: any,
    source?: string
  ) {
    if (!this.isCategoryEnabled(category)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      category,
      level,
      message,
      data,
      source
    };

    // Add to history
    this.logHistory.push(logEntry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Format for console output
    const categoryTag = `[${category}]`;
    const sourceTag = source ? `[${source}]` : '';
    const fullMessage = `${categoryTag}${sourceTag} ${message}`;

    // Console output with appropriate level
    switch (level) {
      case 'debug':
        console.debug(fullMessage, data ? data : '');
        break;
      case 'info':
        console.log(fullMessage, data ? data : '');
        break;
      case 'warn':
        console.warn(fullMessage, data ? data : '');
        break;
      case 'error':
        console.error(fullMessage, data ? data : '');
        break;
    }
  }

  // IMPORT category methods
  importInfo(message: string, data?: any, source?: string) {
    this.log('IMPORT', 'info', message, data, source);
  }

  importWarn(message: string, data?: any, source?: string) {
    this.log('IMPORT', 'warn', message, data, source);
  }

  importError(message: string, data?: any, source?: string) {
    this.log('IMPORT', 'error', message, data, source);
  }

  importDebug(message: string, data?: any, source?: string) {
    this.log('IMPORT', 'debug', message, data, source);
  }

  // TRANSFORM category methods
  transformInfo(message: string, data?: any, source?: string) {
    this.log('TRANSFORM', 'info', message, data, source);
  }

  transformWarn(message: string, data?: any, source?: string) {
    this.log('TRANSFORM', 'warn', message, data, source);
  }

  transformError(message: string, data?: any, source?: string) {
    this.log('TRANSFORM', 'error', message, data, source);
  }

  transformDebug(message: string, data?: any, source?: string) {
    this.log('TRANSFORM', 'debug', message, data, source);
  }

  // COLD-STORAGE category methods
  coldStorageInfo(message: string, data?: any, source?: string) {
    this.log('COLD-STORAGE', 'info', message, data, source);
  }

  coldStorageWarn(message: string, data?: any, source?: string) {
    this.log('COLD-STORAGE', 'warn', message, data, source);
  }

  coldStorageError(message: string, data?: any, source?: string) {
    this.log('COLD-STORAGE', 'error', message, data, source);
  }

  coldStorageDebug(message: string, data?: any, source?: string) {
    this.log('COLD-STORAGE', 'debug', message, data, source);
  }

  // UI category methods
  uiInfo(message: string, data?: any, source?: string) {
    this.log('UI', 'info', message, data, source);
  }

  uiWarn(message: string, data?: any, source?: string) {
    this.log('UI', 'warn', message, data, source);
  }

  uiError(message: string, data?: any, source?: string) {
    this.log('UI', 'error', message, data, source);
  }

  uiDebug(message: string, data?: any, source?: string) {
    this.log('UI', 'debug', message, data, source);
  }

  // PERFORMANCE category methods
  performanceInfo(message: string, data?: any, source?: string) {
    this.log('PERFORMANCE', 'info', message, data, source);
  }

  performanceWarn(message: string, data?: any, source?: string) {
    this.log('PERFORMANCE', 'warn', message, data, source);
  }

  performanceError(message: string, data?: any, source?: string) {
    this.log('PERFORMANCE', 'error', message, data, source);
  }

  performanceDebug(message: string, data?: any, source?: string) {
    this.log('PERFORMANCE', 'debug', message, data, source);
  }

  // ERROR category methods (for general errors)
  errorInfo(message: string, data?: any, source?: string) {
    this.log('ERROR', 'info', message, data, source);
  }

  errorWarn(message: string, data?: any, source?: string) {
    this.log('ERROR', 'warn', message, data, source);
  }

  errorError(message: string, data?: any, source?: string) {
    this.log('ERROR', 'error', message, data, source);
  }

  errorDebug(message: string, data?: any, source?: string) {
    this.log('ERROR', 'debug', message, data, source);
  }

  // Utility methods for performance timing
  startTimer(operation: string): { end: (data?: any) => void } {
    const startTime = performance.now();
    const source = `timer-${operation}`;
    
    this.performanceDebug(`Starting operation: ${operation}`, { startTime }, source);
    
    return {
      end: (data?: any) => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        this.performanceInfo(`Completed operation: ${operation}`, {
          duration: `${duration}ms`,
          startTime,
          endTime,
          ...data
        }, source);
      }
    };
  }

  // Batch logging for multiple related operations
  startBatch(batchName: string, expectedCount: number): {
    logItem: (index: number, message: string, data?: any) => void;
    logError: (index: number, error: string, data?: any) => void;
    end: (summary?: any) => void;
  } {
    const startTime = performance.now();
    const source = `batch-${batchName}`;
    let completedCount = 0;
    let errorCount = 0;
    
    this.importInfo(`Starting batch operation: ${batchName}`, {
      expectedCount,
      startTime
    }, source);
    
    return {
      logItem: (index: number, message: string, data?: any) => {
        completedCount++;
        this.importDebug(`Batch item ${index + 1}/${expectedCount}: ${message}`, {
          progress: `${completedCount}/${expectedCount}`,
          ...data
        }, source);
      },
      
      logError: (index: number, error: string, data?: any) => {
        errorCount++;
        this.importError(`Batch item ${index + 1}/${expectedCount} failed: ${error}`, {
          errorCount,
          ...data
        }, source);
      },
      
      end: (summary?: any) => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        this.importInfo(`Completed batch operation: ${batchName}`, {
          duration: `${duration}ms`,
          completedCount,
          errorCount,
          expectedCount,
          successRate: `${((completedCount - errorCount) / expectedCount * 100).toFixed(1)}%`,
          ...summary
        }, source);
      }
    };
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 50, category?: LogCategory): LogEntry[] {
    let filteredLogs = this.logHistory;
    
    if (category) {
      filteredLogs = this.logHistory.filter(log => log.category === category);
    }
    
    return filteredLogs.slice(-count);
  }

  // Clear log history
  clearHistory() {
    this.logHistory = [];
    this.log('UI', 'info', 'Log history cleared', { timestamp: new Date().toISOString() });
  }

  // Export logs as JSON for debugging
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  // Get logging statistics
  getStats(): {
    totalLogs: number;
    byCategory: Record<LogCategory, number>;
    byLevel: Record<string, number>;
    oldestLog?: string;
    newestLog?: string;
  } {
    const byCategory: Record<LogCategory, number> = {
      'IMPORT': 0,
      'TRANSFORM': 0,
      'COLD-STORAGE': 0,
      'UI': 0,
      'PERFORMANCE': 0,
      'ERROR': 0
    };
    
    const byLevel: Record<string, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };
    
    this.logHistory.forEach(log => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
    });
    
    return {
      totalLogs: this.logHistory.length,
      byCategory,
      byLevel,
      oldestLog: this.logHistory[0]?.timestamp,
      newestLog: this.logHistory[this.logHistory.length - 1]?.timestamp
    };
  }
}

// AIDEV-NOTE: Export singleton instance for consistent usage across application
export const logger = new Logger();

// Export convenience functions for common logging patterns
export const logImport = logger.importInfo.bind(logger);
export const logTransform = logger.transformInfo.bind(logger);
export const logColdStorage = logger.coldStorageInfo.bind(logger);
export const logUI = logger.uiInfo.bind(logger);
export const logPerformance = logger.performanceInfo.bind(logger);
export const logError = logger.errorError.bind(logger);

// Export timer utilities
export const startTimer = logger.startTimer.bind(logger);
export const startBatch = logger.startBatch.bind(logger);