// AIDEV-NOTE: Environment configuration utility for secure production settings
// Centralizes environment detection and configuration management

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  enableDebugLogging: boolean;
  enableSensitiveLogging: boolean;
  pdfWorkerUrl: string;
  enforceHttps: boolean;
}

/**
 * Detect current environment based on multiple indicators
 */
function detectEnvironment(): { isDev: boolean; isProd: boolean; isTest: boolean } {
  // Browser environment detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    
    // Development indicators
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname === '0.0.0.0' ||
                       hostname.startsWith('192.168.') ||
                       hostname.startsWith('10.') ||
                       hostname.endsWith('.local');
    
    const isDevelopmentPort = ['5173', '5174', '3000', '8080', '4173'].includes(port);
    const isHttpProtocol = protocol === 'http:';
    
    const isDev = isLocalhost || isDevelopmentPort || isHttpProtocol;
    const isProd = !isDev && hostname !== '';
    
    return { isDev, isProd, isTest: false };
  }
  
  // Node.js environment detection
  if (typeof process !== 'undefined' && process.env) {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const isDev = nodeEnv === 'development';
    const isProd = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';
    
    return { isDev, isProd, isTest };
  }
  
  // Default to production for security
  return { isDev: false, isProd: true, isTest: false };
}

/**
 * Get current environment configuration
 * AIDEV-NOTE: Security-first approach - defaults to production settings
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const { isDev, isProd, isTest } = detectEnvironment();
  
  return {
    isDevelopment: isDev,
    isProduction: isProd,
    isTest: isTest,
    
    // Logging configuration - secure by default
    enableDebugLogging: isDev || isTest,
    enableSensitiveLogging: isDev, // Only enable in development
    
    // Asset configuration
    pdfWorkerUrl: isDev 
      ? 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'
      : '/pdf.worker.min.mjs', // Self-hosted in production
    
    // Security configuration
    enforceHttps: isProd // Enforce HTTPS in production
  };
}

/**
 * Get environment-specific logger that respects security settings
 */
export function createSecureLogger(componentName: string) {
  const config = getEnvironmentConfig();
  
  return {
    /**
     * Debug logging - only enabled in development
     */
    debug: (...args: any[]) => {
      if (config.enableDebugLogging) {
        console.log(`[${componentName}]`, ...args);
      }
    },
    
    /**
     * Info logging - enabled in all environments
     */
    info: (...args: any[]) => {
      console.log(`[${componentName}]`, ...args);
    },
    
    /**
     * Warning logging - enabled in all environments
     */
    warn: (...args: any[]) => {
      console.warn(`[${componentName}]`, ...args);
    },
    
    /**
     * Error logging - enabled in all environments
     */
    error: (...args: any[]) => {
      console.error(`[${componentName}]`, ...args);
    },
    
    /**
     * Sensitive data logging - only enabled in development
     * AIDEV-NOTE: Use this for logging that could expose sensitive information
     */
    sensitive: (message: string, data?: any) => {
      if (config.enableSensitiveLogging) {
        console.log(`[${componentName}][SENSITIVE] ${message}`, data || '');
      } else {
        console.log(`[${componentName}] ${message} [Data hidden in production]`);
      }
    }
  };
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return getEnvironmentConfig().isDevelopment;
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return getEnvironmentConfig().isProduction;
}

/**
 * Check if import functionality should be available
 * AIDEV-NOTE: Import functionality only available in production mode
 * @returns true if import should be enabled (production mode only)
 */
export function isImportEnabled(): boolean {
  return isProduction();
}

/**
 * Log environment information for debugging
 */
export function logEnvironmentInfo(): void {
  const config = getEnvironmentConfig();
  console.log('[Environment] Configuration:', {
    mode: config.isDevelopment ? 'development' : 'production',
    importEnabled: isImportEnabled(),
    debugLogging: config.enableDebugLogging,
    sensitiveLogging: config.enableSensitiveLogging,
    enforceHttps: config.enforceHttps
  });
}