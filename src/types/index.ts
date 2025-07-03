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

// AIDEV-NOTE: Cold storage search result format
export interface ColdStorageSearchResult {
  id: string;
  filename: string;
  metadata: any;
  snippet: string;
  relevance: number;
  tier: 'hot' | 'cold';
  isArchived: boolean;
  batchId?: string;
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

// AIDEV-NOTE: Date filter configuration for search functionality
export interface DateFilter {
  type: 'all' | 'earlierThan' | 'laterThan' | 'range';
  earlierThan?: string; // ISO date string
  laterThan?: string; // ISO date string
}

export interface SearchSummaryData {
  totalResults: number;
  uniqueDocuments: number;
  totalIndexedDocuments: number;
  searchTime: number;
  decisionBreakdown: {
    allowed: number;
    dismissed: number;
    unknown: number;
    total: number;
  };
  matchQuality: {
    averageScore: number;
    highQualityCount: number;
  };
  planningInsights: {
    uniqueLPAs: number;
    uniqueInspectors: number;
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
  // AIDEV-NOTE: Add applied filter information to search summary
  appliedFilters?: {
    dateFilter?: DateFilter;
    metadataFilters?: MetadataFilters;
  };
}

// AIDEV-NOTE: Comprehensive metadata filtering interfaces for advanced search functionality
export interface DateRangeFilter {
  enabled: boolean;
  start?: string; // ISO date string
  end?: string; // ISO date string
}

export interface MetadataFilters {
  // Case Information filters
  lpaNames: string[];
  caseTypes: string[];
  caseOfficers: string[];
  procedures: string[];
  statuses: string[];
  
  // Important Dates filters
  dateFilters: {
    startDate: DateRangeFilter;
    questionnaireDue: DateRangeFilter;
    statementDue: DateRangeFilter;
    interestedPartyCommentsDue: DateRangeFilter;
    finalCommentsDue: DateRangeFilter;
    inquiryEvidenceDue: DateRangeFilter;
    eventDate: DateRangeFilter;
  };
  
  // Decision Information filters
  decisionOutcomes: string[];
  hasLinkedCases?: boolean; // null = no filter, true = has linked cases, false = no linked cases
}

export interface FilterOptions {
  lpaNames: string[];
  caseTypes: string[];
  caseOfficers: string[];
  procedures: string[];
  statuses: string[];
  decisionOutcomes: string[];
}

export interface FilterCounts {
  total: number;
  lpaNames: number;
  caseTypes: number;
  caseOfficers: number;
  procedures: number;
  statuses: number;
  dateFilters: number;
  decisionOutcomes: number;
  linkedCases: number;
}