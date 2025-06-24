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