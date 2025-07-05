export declare class BrowserResourceManager {
  constructor();
  initialize(): Promise<void>;
  requestWakeLock(operationId: string, reason?: string): Promise<boolean>;
  releaseWakeLock(operationId: string): Promise<void>;
  trackHeavyOperation(operationId: string, description: string, estimatedDuration: number): void;
  completeHeavyOperation(operationId: string): void;
  onVisibilityChange(listener: (isVisible: boolean) => void): () => void;
  onFocusChange(listener: (hasFocus: boolean) => void): () => void;
  onConnectionChange(listener: (isOnline: boolean, connection?: any) => void): () => void;
  onBatteryChange(listener: (battery: any) => void): () => void;
  getResourceStatus(): {
    visibility: {
      isVisible: boolean;
      hasFocus: boolean;
      backgroundDuration: number;
    };
    wakeLock: {
      isActive: boolean;
      activeRequests: number;
      requests: string[];
    };
    connection: {
      isOnline: boolean;
      [key: string]: any;
    };
    battery: any;
    operations: {
      heavy: number;
      background: number;
    };
    lastActivity: Date;
  };
  destroy(): void;
}

export declare const browserResourceManager: BrowserResourceManager;
export declare const RESOURCE_CONFIG: any;