export declare class MemoryManager {
  constructor();
  initialize(): Promise<void>;
  getCurrentMemoryUsage(): number;
  trackResource(id: string, resource: any, estimatedSizeMB?: number): void;
  trackDecryptedBatch(batchId: string, data: any, sizeMB: number): void;
  accessResource(id: string): any;
  accessDecryptedBatch(batchId: string): any;
  untrackResource(id: string): boolean;
  untrackDecryptedBatch(batchId: string): boolean;
  forceCleanup(): Promise<void>;
  onMemoryWarning(listener: (data: any) => void): () => void;
  onCleanup(listener: (data: any) => void): () => void;
  getMemoryStats(): {
    current: number;
    peak: number;
    thresholds: {
      warning: number;
      critical: number;
      target: number;
    };
    resources: {
      tracked: number;
      decryptedBatches: number;
      activeOperations: number;
    };
    performance: any;
  };
  destroy(): void;
}

export declare const memoryManager: MemoryManager;
export declare const MEMORY_CONFIG: any;