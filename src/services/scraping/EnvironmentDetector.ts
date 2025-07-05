/**
 * Environment Detection Service
 * 
 * Determines whether the application is running in development or production
 * environment. Single responsibility for environment detection.
 * 
 * AIDEV-NOTE: Focused environment detection extracted from appeal downloader
 */

import type { IEnvironmentDetector } from './interfaces.js';

export class EnvironmentDetector implements IEnvironmentDetector {
  
  isLocalDevelopment(): boolean {
    if (typeof window === 'undefined') {
      // Server-side or Node.js environment
      return process?.env?.NODE_ENV === 'development';
    }
    
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Check for localhost patterns
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname === '0.0.0.0' ||
                       hostname.startsWith('192.168.') ||
                       hostname.startsWith('10.') ||
                       hostname.endsWith('.local');
    
    // Check for development ports
    const isDevelopmentPort = port === '5173' || 
                             port === '5174' || 
                             port === '3000' || 
                             port === '8080' || 
                             port === '4173';
    
    return isLocalhost || isDevelopmentPort;
  }

  isProduction(): boolean {
    return !this.isLocalDevelopment();
  }

  getEnvironmentName(): string {
    return this.isLocalDevelopment() ? 'development' : 'production';
  }

  /**
   * Get current hostname (browser only)
   */
  getHostname(): string {
    if (typeof window === 'undefined') {
      return 'server';
    }
    return window.location.hostname;
  }

  /**
   * Get current port (browser only)
   */
  getPort(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.location.port;
  }

  /**
   * Check if running in browser
   */
  isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Check if running in Node.js
   */
  isNodeJS(): boolean {
    return typeof process !== 'undefined' && process.versions && !!process.versions.node;
  }
}