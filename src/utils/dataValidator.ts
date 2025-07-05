/**
 * Data Validation Utility for Appeal Case Transformations
 * 
 * Provides comprehensive validation for appeal case data before and after
 * transformation to ensure data quality and cold storage compatibility.
 * 
 * AIDEV-NOTE: Data validation layer with extensive error handling and reporting
 */

import { logger, logTransform } from './logger';
import type { AppealCaseData, ColdStorageDocument } from './appealDataTransformer';

// AIDEV-NOTE: Validation rule types for configurable validation
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationRule {
  name: string;
  severity: ValidationSeverity;
  check: (data: any) => boolean;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  score: number; // 0-100 quality score
}

export interface ValidationIssue {
  rule: string;
  severity: ValidationSeverity;
  message: string;
  field?: string;
  value?: any;
  suggestion?: string;
}

export interface BatchValidationResult {
  totalValidated: number;
  validCount: number;
  invalidCount: number;
  averageScore: number;
  results: Array<{
    index: number;
    caseId: string;
    validation: ValidationResult;
  }>;
  processingTimeMs: number;
}

/**
 * Validation rules for AppealCaseData (before transformation)
 */
export const APPEAL_CASE_VALIDATION_RULES: ValidationRule[] = [
  // Critical required fields
  {
    name: 'case_id_required',
    severity: 'error',
    check: (data: AppealCaseData) => !!data.case_id && data.case_id.trim().length > 0,
    message: 'Case ID is required',
    suggestion: 'Ensure each appeal case has a unique case ID'
  },
  {
    name: 'content_required',
    severity: 'error',
    check: (data: AppealCaseData) => !!data.content && data.content.trim().length > 0,
    message: 'Content is required',
    suggestion: 'PDF content extraction may have failed'
  },
  
  // Data quality checks
  {
    name: 'case_id_format',
    severity: 'warning',
    check: (data: AppealCaseData) => {
      if (!data.case_id) return true; // Handled by required check
      return /^[A-Z0-9\/]+$/.test(data.case_id);
    },
    message: 'Case ID contains unexpected characters',
    suggestion: 'Case IDs should typically contain only uppercase letters, numbers, and forward slashes'
  },
  {
    name: 'content_length_minimum',
    severity: 'warning',
    check: (data: AppealCaseData) => {
      if (!data.content) return true; // Handled by required check
      return data.content.length >= 100;
    },
    message: 'Content appears very short (< 100 characters)',
    suggestion: 'This may indicate incomplete PDF extraction'
  },
  {
    name: 'content_length_reasonable',
    severity: 'info',
    check: (data: AppealCaseData) => {
      if (!data.content) return true;
      return data.content.length <= 500000; // 500KB reasonable max
    },
    message: 'Content is unusually long (> 500KB)',
    suggestion: 'This may indicate extracted data includes non-text content'
  },
  
  // Decision outcome validation
  {
    name: 'decision_outcome_present',
    severity: 'warning',
    check: (data: AppealCaseData) => !!data.decision_outcome && data.decision_outcome !== 'NOT_FOUND',
    message: 'Decision outcome not available',
    suggestion: 'Decision outcome is important for search and analysis'
  },
  {
    name: 'decision_outcome_valid',
    severity: 'warning',
    check: (data: AppealCaseData) => {
      if (!data.decision_outcome || data.decision_outcome === 'NOT_FOUND') return true;
      return ['Allowed', 'Dismissed', 'Split Decision', 'Withdrawn'].includes(data.decision_outcome);
    },
    message: 'Decision outcome has unexpected value',
    suggestion: 'Expected values: Allowed, Dismissed, Split Decision, Withdrawn'
  },
  
  // Date validation
  {
    name: 'decision_date_present',
    severity: 'warning',
    check: (data: AppealCaseData) => !!data.decision_date && data.decision_date !== 'NOT_FOUND',
    message: 'Decision date not available',
    suggestion: 'Decision date is important for temporal analysis'
  },
  {
    name: 'decision_date_format',
    severity: 'info',
    check: (data: AppealCaseData) => {
      if (!data.decision_date || data.decision_date === 'NOT_FOUND') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(data.decision_date) || /^\d{2}\/\d{2}\/\d{4}$/.test(data.decision_date);
    },
    message: 'Decision date format may not be standardized',
    suggestion: 'Expected formats: YYYY-MM-DD or DD/MM/YYYY'
  },
  
  // LPA validation
  {
    name: 'lpa_present',
    severity: 'info',
    check: (data: AppealCaseData) => !!data.lpa_name && data.lpa_name !== 'NOT_FOUND',
    message: 'LPA name not available',
    suggestion: 'Local Planning Authority name helps with geographic analysis'
  },
  
  // Case type validation
  {
    name: 'case_type_present',
    severity: 'info',
    check: (data: AppealCaseData) => !!data.case_type && data.case_type.trim().length > 0,
    message: 'Case type not specified',
    suggestion: 'Case type helps categorize appeals'
  }
];

/**
 * Validation rules for ColdStorageDocument (after transformation)
 */
export const COLD_STORAGE_VALIDATION_RULES: ValidationRule[] = [
  // Critical structure requirements
  {
    name: 'id_required',
    severity: 'error',
    check: (doc: ColdStorageDocument) => !!doc.id && doc.id.trim().length > 0,
    message: 'Document ID is required',
    suggestion: 'ID should match the original case_id'
  },
  {
    name: 'filename_required',
    severity: 'error',
    check: (doc: ColdStorageDocument) => !!doc.filename && doc.filename.trim().length > 0,
    message: 'Document filename is required',
    suggestion: 'Filename should be generated from case_id'
  },
  {
    name: 'content_required',
    severity: 'error',
    check: (doc: ColdStorageDocument) => !!doc.content && doc.content.trim().length > 0,
    message: 'Document content is required',
    suggestion: 'Content should be preserved from original appeal data'
  },
  {
    name: 'metadata_required',
    severity: 'error',
    check: (doc: ColdStorageDocument) => !!doc.metadata,
    message: 'Document metadata is required',
    suggestion: 'Metadata should contain all appeal-specific information'
  },
  
  // ID consistency
  {
    name: 'id_metadata_consistency',
    severity: 'error',
    check: (doc: ColdStorageDocument) => {
      if (!doc.id || !doc.case_id) return true;
      return doc.id === doc.case_id;
    },
    message: 'Document ID must match case_id',
    suggestion: 'Ensure consistent ID mapping during transformation'
  },
  
  // Filename format
  {
    name: 'filename_format',
    severity: 'warning',
    check: (doc: ColdStorageDocument) => {
      if (!doc.filename) return true;
      return doc.filename.endsWith('.pdf') && !doc.filename.includes('/') && !doc.filename.includes('\\');
    },
    message: 'Filename should end with .pdf and not contain path separators',
    suggestion: 'Use sanitized case_id + .pdf extension'
  },
  
  // Case ID completeness (at root level)
  {
    name: 'case_id_required',
    severity: 'error',
    check: (doc: ColdStorageDocument) => !!doc.case_id,
    message: 'Document must include case_id at root level',
    suggestion: 'case_id is required for document identification'
  },
  {
    name: 'metadata_source_type',
    severity: 'error',
    check: (doc: ColdStorageDocument) => !!doc.metadata?.source_type,
    message: 'Metadata must include source_type',
    suggestion: 'source_type should be "appeal_decision_letter"'
  },
  {
    name: 'metadata_transformed_at',
    severity: 'error',
    check: (doc: ColdStorageDocument) => !!doc.metadata?.transformed_at,
    message: 'Metadata must include transformed_at timestamp',
    suggestion: 'Use ISO timestamp for transformation time'
  },
  
  // Content preservation
  {
    name: 'content_length_preserved',
    severity: 'warning',
    check: (doc: ColdStorageDocument) => {
      if (!doc.content || !doc.metadata?.content_length) return true;
      return Math.abs(doc.content.length - doc.metadata.content_length) <= 10; // Allow small differences
    },
    message: 'Content length does not match metadata',
    suggestion: 'Ensure content is preserved accurately during transformation'
  }
];

/**
 * Validate AppealCaseData before transformation
 */
export function validateAppealCase(data: AppealCaseData): ValidationResult {
  const timer = logger.startTimer(`validate-appeal-case-${data.case_id}`);
  
  logTransform('Starting appeal case validation', {
    case_id: data.case_id,
    has_content: !!data.content,
    content_length: data.content?.length || 0
  }, 'validateAppealCase');

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // Run all validation rules
  APPEAL_CASE_VALIDATION_RULES.forEach(rule => {
    try {
      const passed = rule.check(data);
      if (!passed) {
        const issue: ValidationIssue = {
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          suggestion: rule.suggestion
        };

        switch (rule.severity) {
          case 'error':
            errors.push(issue);
            break;
          case 'warning':
            warnings.push(issue);
            break;
          case 'info':
            info.push(issue);
            break;
        }
      }
    } catch (error) {
      logger.transformError('Validation rule execution failed', {
        rule: rule.name,
        case_id: data.case_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'validateAppealCase');
      
      errors.push({
        rule: rule.name,
        severity: 'error',
        message: `Validation rule failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Calculate quality score (0-100)
  const failedCriticalRules = errors.length;
  const failedWarningRules = warnings.length;
  
  // Score: 100 - (critical failures * 20) - (warnings * 5)
  const score = Math.max(0, 100 - (failedCriticalRules * 20) - (failedWarningRules * 5));

  const valid = errors.length === 0;
  
  const result: ValidationResult = {
    valid,
    errors,
    warnings,
    info,
    score
  };

  timer.end({
    valid,
    score,
    errors: errors.length,
    warnings: warnings.length,
    info: info.length
  });

  logTransform('Appeal case validation completed', {
    case_id: data.case_id,
    valid,
    score,
    errors: errors.length,
    warnings: warnings.length,
    info: info.length
  }, 'validateAppealCase');

  return result;
}

/**
 * Validate ColdStorageDocument after transformation
 */
export function validateColdStorageDocument(document: ColdStorageDocument): ValidationResult {
  const timer = logger.startTimer(`validate-cold-storage-doc-${document.id}`);
  
  logTransform('Starting cold storage document validation', {
    document_id: document.id,
    filename: document.filename,
    content_length: document.content?.length || 0
  }, 'validateColdStorageDocument');

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // Run all validation rules
  COLD_STORAGE_VALIDATION_RULES.forEach(rule => {
    try {
      const passed = rule.check(document);
      if (!passed) {
        const issue: ValidationIssue = {
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          suggestion: rule.suggestion
        };

        switch (rule.severity) {
          case 'error':
            errors.push(issue);
            break;
          case 'warning':
            warnings.push(issue);
            break;
          case 'info':
            info.push(issue);
            break;
        }
      }
    } catch (error) {
      logger.transformError('Cold storage validation rule execution failed', {
        rule: rule.name,
        document_id: document.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'validateColdStorageDocument');
      
      errors.push({
        rule: rule.name,
        severity: 'error',
        message: `Validation rule failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Calculate quality score
  const failedCriticalRules = errors.length;
  const failedWarningRules = warnings.length;
  
  const score = Math.max(0, 100 - (failedCriticalRules * 20) - (failedWarningRules * 5));
  const valid = errors.length === 0;
  
  const result: ValidationResult = {
    valid,
    errors,
    warnings,
    info,
    score
  };

  timer.end({
    valid,
    score,
    errors: errors.length,
    warnings: warnings.length,
    info: info.length
  });

  logTransform('Cold storage document validation completed', {
    document_id: document.id,
    valid,
    score,
    errors: errors.length,
    warnings: warnings.length,
    info: info.length
  }, 'validateColdStorageDocument');

  return result;
}

/**
 * Validate a batch of appeal cases
 */
export function validateAppealCaseBatch(appealCases: AppealCaseData[]): BatchValidationResult {
  const startTime = performance.now();
  const batchTimer = logger.startBatch('validate-appeal-batch', appealCases.length);
  
  logTransform('Starting batch validation', {
    total_cases: appealCases.length
  }, 'validateAppealCaseBatch');

  const results: Array<{
    index: number;
    caseId: string;
    validation: ValidationResult;
  }> = [];

  let validCount = 0;
  let totalScore = 0;

  appealCases.forEach((appealCase, index) => {
    try {
      const validation = validateAppealCase(appealCase);
      
      if (validation.valid) {
        validCount++;
        batchTimer.logItem(index, `Validation passed for case ${appealCase.case_id}`, {
          score: validation.score,
          warnings: validation.warnings.length
        });
      } else {
        batchTimer.logError(index, `Validation failed for case ${appealCase.case_id}`, {
          errors: validation.errors.length,
          score: validation.score
        });
      }

      totalScore += validation.score;
      
      results.push({
        index,
        caseId: appealCase.case_id,
        validation
      });
    } catch (error) {
      logger.transformError('Exception during validation', {
        case_id: appealCase.case_id,
        index,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'validateAppealCaseBatch');
      
      results.push({
        index,
        caseId: appealCase.case_id,
        validation: {
          valid: false,
          errors: [{
            rule: 'validation_exception',
            severity: 'error',
            message: `Validation exception: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          warnings: [],
          info: [],
          score: 0
        }
      });
    }
  });

  const endTime = performance.now();
  const processingTimeMs = Math.round(endTime - startTime);
  const averageScore = appealCases.length > 0 ? totalScore / appealCases.length : 0;

  const batchResult: BatchValidationResult = {
    totalValidated: appealCases.length,
    validCount,
    invalidCount: appealCases.length - validCount,
    averageScore,
    results,
    processingTimeMs
  };

  batchTimer.end({
    valid_count: validCount,
    invalid_count: appealCases.length - validCount,
    average_score: averageScore.toFixed(1),
    processing_time_ms: processingTimeMs
  });

  logTransform('Batch validation completed', {
    total_validated: appealCases.length,
    valid_count: validCount,
    invalid_count: appealCases.length - validCount,
    average_score: averageScore.toFixed(1),
    processing_time_ms: processingTimeMs,
    validation_rate: `${(validCount / appealCases.length * 100).toFixed(1)}%`
  }, 'validateAppealCaseBatch');

  return batchResult;
}

/**
 * Get detailed validation statistics
 */
export function getValidationStats(batchResult: BatchValidationResult): {
  validationRate: number;
  averageScore: number;
  errorDistribution: Record<string, number>;
  warningDistribution: Record<string, number>;
  scoreDistribution: {
    excellent: number; // 90-100
    good: number;      // 70-89
    fair: number;      // 50-69
    poor: number;      // 0-49
  };
} {
  const validationRate = (batchResult.validCount / batchResult.totalValidated) * 100;
  
  const errorDistribution: Record<string, number> = {};
  const warningDistribution: Record<string, number> = {};
  const scoreDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };

  batchResult.results.forEach(result => {
    // Count errors by rule
    result.validation.errors.forEach(error => {
      errorDistribution[error.rule] = (errorDistribution[error.rule] || 0) + 1;
    });

    // Count warnings by rule
    result.validation.warnings.forEach(warning => {
      warningDistribution[warning.rule] = (warningDistribution[warning.rule] || 0) + 1;
    });

    // Score distribution
    const score = result.validation.score;
    if (score >= 90) {
      scoreDistribution.excellent++;
    } else if (score >= 70) {
      scoreDistribution.good++;
    } else if (score >= 50) {
      scoreDistribution.fair++;
    } else {
      scoreDistribution.poor++;
    }
  });

  return {
    validationRate,
    averageScore: batchResult.averageScore,
    errorDistribution,
    warningDistribution,
    scoreDistribution
  };
}