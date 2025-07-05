export declare class PerformanceMonitor {
  constructor();
  initialize(): Promise<void>;
  recordSearchOperation(type: string, query: string, duration: number, resultCount: number, metadata?: any): void;
  recordStorageOperation(operation: string, duration: number, size: number, metadata?: any): void;
  recordMemoryMetric(usage: number, timestamp?: Date): void;
  onAlert(listener: (alert: any) => void): () => void;
  onPerformanceEvent(listener: (type: string, data: any) => void): () => void;
  getPerformanceSummary(hours?: number): {
    searchPerformance: {
      totalSearches: number;
      avgHotSearchTime: number;
      avgColdSearchTime: number;
      slowSearches: number;
    };
    memoryUsage: {
      current: number;
      average: number;
      peak: number;
      highUsageEvents: number;
    };
    alerts: {
      total: number;
      critical: number;
      warnings: number;
      byType: any;
    };
    session: any;
  };
  getRawMetrics(category: string, limit?: number): any[];
  exportPerformanceData(): any;
  destroy(): void;
}

export declare const performanceMonitor: PerformanceMonitor;
export declare const PERFORMANCE_CONFIG: any;