export interface Document {
  id: string;
  filename: string;
  size: number;
  uploadDate: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  metadata?: {
    pageCount: number;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    // AIDEV-NOTE: Planning appeal specific metadata fields with default "NOT_FOUND" values
    appealReferenceNumber?: string;
    siteVisitDate?: string;
    decisionDate?: string;
    lpa?: string;
    inspector?: string;
    decisionOutcome?: 'Dismissed' | 'Allowed' | 'NOT_FOUND';
  };
}

export interface SearchIndex {
  docId: string;
  content: string;
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    // AIDEV-NOTE: Planning appeal specific metadata fields for search indexing
    appealReferenceNumber?: string;
    siteVisitDate?: string;
    decisionDate?: string;
    lpa?: string;
    inspector?: string;
    decisionOutcome?: 'Dismissed' | 'Allowed' | 'NOT_FOUND';
  };
}

export interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdDate: Date;
}

export interface SearchResult {
  document: Document;
  matches: Array<{
    content: string;
    matchValue: string | undefined;
    indices: Array<[number, number]>;
    score: number;
  }>;
  overallScore: number;
}

export interface ProcessingProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'error';
}

export interface WorkerMessage {
  type: 'process-batch' | 'pause' | 'resume' | 'progress' | 'error' | 'complete';
  payload?: any;
}