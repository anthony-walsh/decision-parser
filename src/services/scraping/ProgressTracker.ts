/**
 * Progress Tracking Service
 * 
 * Manages and reports progress for batch processing operations.
 * Single responsibility for progress tracking and reporting.
 * 
 * AIDEV-NOTE: Focused progress tracker extracted from appeal downloader
 */

import type { IProgressTracker, ProcessingProgress } from './interfaces.js';

export class ProgressTracker implements IProgressTracker {
  private progress: ProcessingProgress;
  private progressCallbacks: ((progress: ProcessingProgress) => void)[] = [];

  constructor(totalCases: number = 0, totalBatches: number = 0) {
    this.progress = {
      totalCases,
      processedCases: 0,
      failedCases: 0,
      currentBatch: 0,
      totalBatches,
      currentCase: undefined
    };
  }

  updateProgress(processed: number, failed: number, current?: string): void {
    this.progress.processedCases = processed;
    this.progress.failedCases = failed;
    this.progress.currentCase = current;
    
    // Notify callbacks
    this.notifyCallbacks();
  }

  setCurrentBatch(batchNumber: number): void {
    this.progress.currentBatch = batchNumber;
    this.notifyCallbacks();
  }

  incrementProcessed(): void {
    this.progress.processedCases++;
    this.notifyCallbacks();
  }

  incrementFailed(): void {
    this.progress.failedCases++;
    this.notifyCallbacks();
  }

  setCurrentCase(caseId: string): void {
    this.progress.currentCase = caseId;
    this.notifyCallbacks();
  }

  getCurrentProgress(): ProcessingProgress {
    return { ...this.progress };
  }

  getPercentageComplete(): number {
    const total = this.progress.totalCases;
    if (total === 0) return 0;
    
    const completed = this.progress.processedCases + this.progress.failedCases;
    return Math.round((completed / total) * 100);
  }

  getTotalCompleted(): number {
    return this.progress.processedCases + this.progress.failedCases;
  }

  isComplete(): boolean {
    return this.getTotalCompleted() >= this.progress.totalCases;
  }

  logProgress(): void {
    const percentage = this.getPercentageComplete();
    const completed = this.getTotalCompleted();
    
    console.log(
      `📊 Progress: ${percentage}% (${completed}/${this.progress.totalCases}) | ` +
      `Batch: ${this.progress.currentBatch}/${this.progress.totalBatches} | ` +
      `Failed: ${this.progress.failedCases} | ` +
      `Current: ${this.progress.currentCase || 'N/A'}`
    );
  }

  onProgress(callback: (progress: ProcessingProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  removeProgressCallback(callback: (progress: ProcessingProgress) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  private notifyCallbacks(): void {
    const currentProgress = this.getCurrentProgress();
    this.progressCallbacks.forEach(callback => {
      try {
        callback(currentProgress);
      } catch (error) {
        console.error('[ProgressTracker] Error in progress callback:', error);
      }
    });
  }

  reset(): void {
    this.progress.processedCases = 0;
    this.progress.failedCases = 0;
    this.progress.currentBatch = 0;
    this.progress.currentCase = undefined;
    this.notifyCallbacks();
  }

  configure(totalCases: number, totalBatches: number): void {
    this.progress.totalCases = totalCases;
    this.progress.totalBatches = totalBatches;
    this.reset();
  }
}