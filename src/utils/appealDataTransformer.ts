/**
 * Appeal Case Data Transformation Utility
 * 
 * Transforms AppealCaseData from appealDecisionLetterDownloader.ts
 * into the format expected by cold storage system.
 * 
 * AIDEV-NOTE: Data transformation layer for appeal cases to cold storage format
 */

import { logger, logTransform } from './logger';

// AIDEV-NOTE: Import the exact interface from appealDecisionLetterDownloader.ts
export interface AppealCaseData {
  doc_link_span: string;
  content: string;
  case_type: string;
  case_id: string;
  start_date: string;
  lpa_name: string;
  questionnaire_due: string;
  statement_due: string;
  case_officer: string;
  interested_party_comments_due: string;
  procedure: string;
  final_comments_due: string;
  status: string;
  inquiry_evidence_due: string;
  decision_outcome: string;
  event_date: string;
  link_status: string;
  decision_date: string;
  linked_case_count: number;
}

// AIDEV-NOTE: Cold storage document format (matches test batch structure - flattened fields)
export interface ColdStorageDocument {
  id: string;
  filename: string;
  content: string;
  // All appeal fields at root level to match test batch format
  case_type: string;
  case_id: string;
  start_date: string;
  lpa_name: string;
  questionnaire_due: string;
  statement_due: string;
  case_officer: string;
  interested_party_comments_due: string;
  procedure: string;
  final_comments_due: string;
  status: string;
  inquiry_evidence_due: string;
  decision_outcome: string;
  event_date: string;
  link_status: string;
  decision_date: string;
  linked_case_count: number;
  doc_link_span: string;
  // Processing metadata nested for organization
  metadata: {
    extractedDate: string;
    contentSummary?: string;
    transformed_at: string;
    source_type: 'appeal_decision_letter';
    content_length: number;
    has_pdf_content: boolean;
  };
}

// AIDEV-NOTE: Metadata structure preserving all appeal-specific fields
export interface AppealCaseMetadata {
  // Core appeal information
  case_id: string;
  case_type: string;
  decision_outcome: string;
  decision_date: string;
  
  // Administrative details
  lpa_name: string;
  case_officer: string;
  status: string;
  procedure: string;
  
  // Timeline information
  start_date: string;
  event_date: string;
  questionnaire_due: string;
  statement_due: string;
  interested_party_comments_due: string;
  final_comments_due: string;
  inquiry_evidence_due: string;
  
  // Source and link information
  doc_link_span: string;
  link_status: string;
  linked_case_count: number;
  
  // Processing metadata
  transformed_at: string;
  source_type: 'appeal_decision_letter';
  content_length: number;
  has_pdf_content: boolean;
}

// AIDEV-NOTE: Batch structure for cold storage
export interface ColdStorageBatch {
  documents: ColdStorageDocument[];
}

// AIDEV-NOTE: Transformation result with validation info
export interface TransformationResult {
  success: boolean;
  document?: ColdStorageDocument;
  errors: string[];
  warnings: string[];
}

// AIDEV-NOTE: Batch transformation result
export interface BatchTransformationResult {
  documents: ColdStorageDocument[];
  totalProcessed: number;
  successfulTransformations: number;
  errors: Array<{ index: number; caseId: string; error: string }>;
  warnings: Array<{ index: number; caseId: string; warning: string }>;
  processingTimeMs: number;
}

/**
 * Transform a single AppealCaseData object to ColdStorageDocument format
 */
export function transformAppealCase(appealData: AppealCaseData): TransformationResult {
  const timer = logger.startTimer(`transform-appeal-case-${appealData.case_id}`);
  
  logTransform('Starting transformation for appeal case', {
    case_id: appealData.case_id,
    content_length: appealData.content?.length || 0,
    has_decision_outcome: !!appealData.decision_outcome
  }, 'transformAppealCase');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!appealData.case_id) {
    errors.push('Missing required field: case_id');
  }
  
  if (!appealData.content) {
    errors.push('Missing required field: content');
  }

  // Generate filename from case_id (sanitize for filesystem compatibility)
  const sanitizedCaseId = appealData.case_id.replace(/[\/\\:*?"<>|]/g, '_');
  const filename = `${sanitizedCaseId}.pdf`;

  // Check for potential data quality issues
  if (appealData.content && appealData.content.length < 100) {
    warnings.push('Content appears to be very short (< 100 characters)');
  }

  if (!appealData.decision_outcome || appealData.decision_outcome === 'NOT_FOUND') {
    warnings.push('Decision outcome not available or not found');
  }

  if (!appealData.decision_date || appealData.decision_date === 'NOT_FOUND') {
    warnings.push('Decision date not available or not found');
  }

  if (!appealData.lpa_name || appealData.lpa_name === 'NOT_FOUND') {
    warnings.push('LPA name not available or not found');
  }

  // Return early if validation failed
  if (errors.length > 0) {
    timer.end({ success: false, errors: errors.length });
    logTransform('Transformation failed validation', {
      case_id: appealData.case_id,
      errors,
      warnings
    }, 'transformAppealCase');
    
    return {
      success: false,
      errors,
      warnings
    };
  }

  // Create the transformed document with flattened structure to match test batch format
  const document: ColdStorageDocument = {
    id: appealData.case_id,
    filename,
    content: appealData.content || '',
    
    // All appeal fields at root level (matches test batch format)
    case_type: appealData.case_type || 'Planning Appeal',
    case_id: appealData.case_id,
    start_date: appealData.start_date || 'NOT_FOUND',
    lpa_name: appealData.lpa_name || 'NOT_FOUND',
    questionnaire_due: appealData.questionnaire_due || 'NOT_FOUND',
    statement_due: appealData.statement_due || 'NOT_FOUND',
    case_officer: appealData.case_officer || 'NOT_FOUND',
    interested_party_comments_due: appealData.interested_party_comments_due || 'NOT_FOUND',
    procedure: appealData.procedure || 'NOT_FOUND',
    final_comments_due: appealData.final_comments_due || 'NOT_FOUND',
    status: appealData.status || 'NOT_FOUND',
    inquiry_evidence_due: appealData.inquiry_evidence_due || 'NOT_FOUND',
    decision_outcome: appealData.decision_outcome || 'NOT_FOUND',
    event_date: appealData.event_date || 'NOT_FOUND',
    link_status: appealData.link_status || 'NOT_FOUND',
    decision_date: appealData.decision_date || 'NOT_FOUND',
    linked_case_count: appealData.linked_case_count || 0,
    doc_link_span: appealData.doc_link_span || '',
    
    // Processing metadata nested for organization
    metadata: {
      extractedDate: new Date().toISOString(),
      contentSummary: `${appealData.case_type || 'Appeal'} - ${appealData.decision_outcome || 'Decision'}`,
      transformed_at: new Date().toISOString(),
      source_type: 'appeal_decision_letter',
      content_length: appealData.content?.length || 0,
      has_pdf_content: !!(appealData.content && appealData.content.length > 0)
    }
  };

  timer.end({ 
    success: true, 
    warnings: warnings.length,
    content_length: document.metadata.content_length 
  });

  logTransform('Transformation completed successfully', {
    case_id: appealData.case_id,
    filename,
    content_length: document.metadata.content_length,
    warnings_count: warnings.length,
    has_decision_outcome: document.decision_outcome !== 'NOT_FOUND'
  }, 'transformAppealCase');

  return {
    success: true,
    document,
    errors: [],
    warnings
  };
}

/**
 * Transform multiple AppealCaseData objects to ColdStorageBatch format
 */
export function transformAppealCaseBatch(appealCases: AppealCaseData[]): BatchTransformationResult {
  const startTime = performance.now();
  const batchTimer = logger.startBatch('transform-appeal-batch', appealCases.length);
  
  logTransform('Starting batch transformation', {
    total_cases: appealCases.length,
    first_case_id: appealCases[0]?.case_id,
    last_case_id: appealCases[appealCases.length - 1]?.case_id
  }, 'transformAppealCaseBatch');

  const documents: ColdStorageDocument[] = [];
  const errors: Array<{ index: number; caseId: string; error: string }> = [];
  const warnings: Array<{ index: number; caseId: string; warning: string }> = [];
  let successfulTransformations = 0;

  // Process each case
  appealCases.forEach((appealCase, index) => {
    try {
      const result = transformAppealCase(appealCase);
      
      if (result.success && result.document) {
        documents.push(result.document);
        successfulTransformations++;
        
        batchTimer.logItem(index, `Transformed case ${appealCase.case_id}`, {
          filename: result.document.filename,
          content_length: result.document.metadata.content_length,
          warnings_count: result.warnings.length
        });
        
        // Collect warnings
        result.warnings.forEach(warning => {
          warnings.push({
            index,
            caseId: appealCase.case_id,
            warning
          });
        });
      } else {
        // Collect errors
        result.errors.forEach(error => {
          errors.push({
            index,
            caseId: appealCase.case_id,
            error
          });
        });
        
        batchTimer.logError(index, `Failed to transform case ${appealCase.case_id}`, {
          errors: result.errors,
          warnings: result.warnings
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown transformation error';
      errors.push({
        index,
        caseId: appealCase.case_id || `unknown-${index}`,
        error: errorMessage
      });
      
      batchTimer.logError(index, `Exception during transformation: ${errorMessage}`, {
        case_id: appealCase.case_id,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  const endTime = performance.now();
  const processingTimeMs = Math.round(endTime - startTime);

  const result: BatchTransformationResult = {
    documents,
    totalProcessed: appealCases.length,
    successfulTransformations,
    errors,
    warnings,
    processingTimeMs
  };

  batchTimer.end({
    successful_transformations: successfulTransformations,
    total_errors: errors.length,
    total_warnings: warnings.length,
    processing_time_ms: processingTimeMs,
    success_rate: `${(successfulTransformations / appealCases.length * 100).toFixed(1)}%`
  });

  logTransform('Batch transformation completed', {
    total_processed: appealCases.length,
    successful: successfulTransformations,
    errors: errors.length,
    warnings: warnings.length,
    processing_time_ms: processingTimeMs,
    success_rate: `${(successfulTransformations / appealCases.length * 100).toFixed(1)}%`,
    average_time_per_case: `${(processingTimeMs / appealCases.length).toFixed(2)}ms`
  }, 'transformAppealCaseBatch');

  return result;
}

/**
 * Create a cold storage batch from transformed documents
 */
export function createColdStorageBatch(documents: ColdStorageDocument[]): ColdStorageBatch {
  logTransform('Creating cold storage batch', {
    document_count: documents.length,
    total_content_size: documents.reduce((total, doc) => total + (doc.content?.length || 0), 0),
    first_document_id: documents[0]?.id,
    last_document_id: documents[documents.length - 1]?.id
  }, 'createColdStorageBatch');

  return {
    documents
  };
}

/**
 * Validate a transformed document meets cold storage requirements
 */
export function validateColdStorageDocument(document: ColdStorageDocument): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!document.id) {
    errors.push('Document ID is required');
  }

  if (!document.filename) {
    errors.push('Document filename is required');
  }

  if (!document.content) {
    errors.push('Document content is required');
  }

  if (!document.metadata) {
    errors.push('Document metadata is required');
  } else {
    // Check metadata structure
    if (!document.metadata.source_type) {
      errors.push('Metadata source_type is required');
    }
    
    if (!document.metadata.transformed_at) {
      errors.push('Metadata transformed_at timestamp is required');
    }
  }

  // Check case_id at root level
  if (!document.case_id) {
    errors.push('case_id is required at document root level');
  }

  // Check ID matches case_id
  if (document.id && document.case_id && document.id !== document.case_id) {
    errors.push('Document ID must match case_id');
  }

  const valid = errors.length === 0;
  
  if (!valid) {
    logTransform('Document validation failed', {
      document_id: document.id,
      errors
    }, 'validateColdStorageDocument');
  }

  return { valid, errors };
}

/**
 * Get transformation statistics for monitoring
 */
export function getTransformationStats(result: BatchTransformationResult): {
  successRate: number;
  averageProcessingTime: number;
  errorRate: number;
  warningRate: number;
  contentStats: {
    totalContentLength: number;
    averageContentLength: number;
    minContentLength: number;
    maxContentLength: number;
  };
} {
  const successRate = (result.successfulTransformations / result.totalProcessed) * 100;
  const errorRate = (result.errors.length / result.totalProcessed) * 100;
  const warningRate = (result.warnings.length / result.totalProcessed) * 100;
  const averageProcessingTime = result.processingTimeMs / result.totalProcessed;

  // Content statistics
  const contentLengths = result.documents.map(doc => doc.metadata.content_length);
  const totalContentLength = contentLengths.reduce((sum, length) => sum + length, 0);
  const averageContentLength = contentLengths.length > 0 ? totalContentLength / contentLengths.length : 0;
  const minContentLength = contentLengths.length > 0 ? Math.min(...contentLengths) : 0;
  const maxContentLength = contentLengths.length > 0 ? Math.max(...contentLengths) : 0;

  return {
    successRate,
    averageProcessingTime,
    errorRate,
    warningRate,
    contentStats: {
      totalContentLength,
      averageContentLength,
      minContentLength,
      maxContentLength
    }
  };
}