/**
 * TypeScript definitions for WorkerLoader utility
 */

export interface WorkerInfo {
  worker: Worker;
  workerPath: string;
  created: number;
  loadTime: number;
}

export interface WorkerStatus {
  totalWorkers: number;
  workers: Array<{
    id: string;
    path: string;
    uptime: number;
    loadTime: number;
  }>;
}

export interface WorkerOptions {
  type?: 'classic' | 'module';
  name?: string;
  credentials?: 'omit' | 'same-origin' | 'include';
}

export declare class WorkerLoader {
  constructor();
  
  /**
   * Create and initialize a worker with production optimizations
   */
  createWorker(workerPath: string, workerId: string, options?: WorkerOptions): Promise<Worker>;
  
  /**
   * Terminate a worker and clean up resources
   */
  terminateWorker(workerId: string): Promise<void>;
  
  /**
   * Get status of all active workers
   */
  getWorkerStatus(): WorkerStatus;
  
  /**
   * Terminate all active workers
   */
  terminateAllWorkers(): Promise<void>;
  
  /**
   * Get average worker load time for performance monitoring
   */
  getAverageLoadTime(): number;
}

export declare const workerLoader: WorkerLoader;