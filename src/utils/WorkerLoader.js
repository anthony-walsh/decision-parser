/**
 * Worker Loader Utility
 * 
 * Provides standardized worker loading with production optimization,
 * error handling, and resource management integration.
 * 
 * AIDEV-NOTE: Centralized worker management for production deployment
 */

import { browserResourceManager } from './BrowserResourceManager.js';
import { performanceMonitor } from '../services/PerformanceMonitor.js';

export class WorkerLoader {
  constructor() {
    this.activeWorkers = new Map();
    this.workerLoadTimes = new Map();
  }

  /**
   * Create and initialize a worker with production optimizations
   * @param {string} workerPath - Path to worker file
   * @param {string} workerId - Unique identifier for the worker
   * @param {Object} options - Worker options
   * @returns {Promise<Worker>} Initialized worker
   */
  async createWorker(workerPath, workerId, options = {}) {
    const startTime = performance.now();
    
    try {
      // Default worker options for production
      const workerOptions = {
        type: 'module',
        name: workerId,
        ...options
      };

      console.log(`Creating worker: ${workerId} from ${workerPath}`);
      
      // Create worker with resource management integration
      const worker = new Worker(workerPath, workerOptions);
      
      // Set up error handling
      worker.onerror = (error) => {
        console.error(`Worker ${workerId} error:`, error);
        performanceMonitor.recordError('worker_error', {
          workerId,
          workerPath,
          error: error.message
        });
      };

      // Set up termination handling
      worker.onmessageerror = (error) => {
        console.error(`Worker ${workerId} message error:`, error);
        performanceMonitor.recordError('worker_message_error', {
          workerId,
          workerPath,
          error: error.message
        });
      };

      // Track worker creation time
      const loadTime = performance.now() - startTime;
      this.workerLoadTimes.set(workerId, loadTime);
      
      // Register with resource manager for wake lock coordination
      if (browserResourceManager) {
        browserResourceManager.registerWorker(workerId);
      }

      // Track active worker
      this.activeWorkers.set(workerId, {
        worker,
        workerPath,
        created: Date.now(),
        loadTime
      });

      // Record performance metrics
      performanceMonitor.recordWorkerOperation('create', loadTime, {
        workerId,
        workerPath,
        success: true
      });

      console.log(`Worker ${workerId} created successfully in ${loadTime.toFixed(2)}ms`);
      return worker;

    } catch (error) {
      const loadTime = performance.now() - startTime;
      
      console.error(`Failed to create worker ${workerId}:`, error);
      
      // Record failure metrics
      performanceMonitor.recordWorkerOperation('create_failed', loadTime, {
        workerId,
        workerPath,
        error: error.message,
        success: false
      });

      throw new Error(`Worker creation failed for ${workerId}: ${error.message}`);
    }
  }

  /**
   * Terminate a worker and clean up resources
   * @param {string} workerId - Worker identifier
   */
  async terminateWorker(workerId) {
    const workerInfo = this.activeWorkers.get(workerId);
    
    if (!workerInfo) {
      console.warn(`Worker ${workerId} not found for termination`);
      return;
    }

    const startTime = performance.now();
    
    try {
      // Unregister from resource manager
      if (browserResourceManager) {
        browserResourceManager.unregisterWorker(workerId);
      }

      // Terminate worker
      workerInfo.worker.terminate();
      
      // Clean up tracking
      this.activeWorkers.delete(workerId);
      this.workerLoadTimes.delete(workerId);

      const terminationTime = performance.now() - startTime;
      
      // Record metrics
      performanceMonitor.recordWorkerOperation('terminate', terminationTime, {
        workerId,
        uptime: Date.now() - workerInfo.created,
        success: true
      });

      console.log(`Worker ${workerId} terminated successfully in ${terminationTime.toFixed(2)}ms`);

    } catch (error) {
      console.error(`Error terminating worker ${workerId}:`, error);
      
      // Force cleanup anyway
      this.activeWorkers.delete(workerId);
      this.workerLoadTimes.delete(workerId);
      
      performanceMonitor.recordError('worker_termination_error', {
        workerId,
        error: error.message
      });
    }
  }

  /**
   * Get status of all active workers
   * @returns {Object} Worker status information
   */
  getWorkerStatus() {
    const status = {
      totalWorkers: this.activeWorkers.size,
      workers: []
    };

    for (const [workerId, workerInfo] of this.activeWorkers) {
      status.workers.push({
        id: workerId,
        path: workerInfo.workerPath,
        uptime: Date.now() - workerInfo.created,
        loadTime: workerInfo.loadTime
      });
    }

    return status;
  }

  /**
   * Terminate all active workers (useful for cleanup)
   */
  async terminateAllWorkers() {
    const workerIds = Array.from(this.activeWorkers.keys());
    
    console.log(`Terminating ${workerIds.length} active workers`);
    
    const terminationPromises = workerIds.map(workerId => 
      this.terminateWorker(workerId)
    );

    await Promise.allSettled(terminationPromises);
    
    console.log('All workers terminated');
  }

  /**
   * Get average worker load time for performance monitoring
   * @returns {number} Average load time in milliseconds
   */
  getAverageLoadTime() {
    if (this.workerLoadTimes.size === 0) return 0;
    
    const totalTime = Array.from(this.workerLoadTimes.values())
      .reduce((sum, time) => sum + time, 0);
    
    return totalTime / this.workerLoadTimes.size;
  }
}

// Export singleton instance
export const workerLoader = new WorkerLoader();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    workerLoader.terminateAllWorkers();
  });
}