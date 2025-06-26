/**
 * Worker Preload Module
 * 
 * This module ensures all workers are included in the production build
 * by importing them. The actual workers are loaded dynamically at runtime.
 * 
 * AIDEV-NOTE: Build-time worker preloading for production deployment
 */

// Import workers to ensure they're included in build
// These imports ensure Vite includes the workers in the bundle
import './hotStorageWorker?worker';
import './coldStorageWorker?worker';
import './migrationWorker?worker';
import './pdfProcessor?worker';

// Export worker paths for runtime loading
export const WORKER_PATHS = {
  hotStorage: '/src/workers/hotStorageWorker.ts',
  coldStorage: '/src/workers/coldStorageWorker.ts',
  migration: '/src/workers/migrationWorker.ts',
  pdfProcessor: '/src/workers/pdfProcessor.ts'
} as const;

// Worker configuration for production
export const WORKER_CONFIG = {
  type: 'module' as const,
  // Add common worker options
  credentials: 'same-origin' as const
};

// Helper function to create workers with consistent configuration
export function createWorkerFromPath(workerPath: string, workerId?: string) {
  const options: WorkerOptions = {
    ...WORKER_CONFIG,
    ...(workerId ? { name: workerId } : {})
  };
  
  return new Worker(workerPath, options);
}

// Type definitions for worker paths
export type WorkerType = keyof typeof WORKER_PATHS;