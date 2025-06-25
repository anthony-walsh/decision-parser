// AIDEV-NOTE: Planning appeal decision metadata extraction utility
// Extracts specific metadata fields from UK Planning Inspectorate appeal decisions

export interface ExtractedMetadata {
  appealReferenceNumber: string;
  siteVisitDate: string;
  decisionDate: string;
  lpa: string;
  inspector: string;
  decisionOutcome: 'Dismissed' | 'Allowed' | 'NOT_FOUND';
}

/**
 * Extracts metadata from planning appeal decision document text
 * Returns default "NOT_FOUND" values for any fields that cannot be extracted
 */
export function extractPlanningAppealMetadata(text: string): ExtractedMetadata {
  const metadata: ExtractedMetadata = {
    appealReferenceNumber: 'NOT_FOUND',
    siteVisitDate: 'NOT_FOUND',
    decisionDate: 'NOT_FOUND',
    lpa: 'NOT_FOUND',
    inspector: 'NOT_FOUND',
    decisionOutcome: 'NOT_FOUND'
  };

  if (!text || typeof text !== 'string') {
    return metadata;
  }

  // AIDEV-NOTE: Focus on first page/header section where metadata is located
  // Most metadata is in the first 1000-1500 characters
  const headerSection = text.substring(0, 1500);
  
  // Debug logging to understand actual text format
  if (text.length > 100) { // Only log for substantial text
    console.log('=== METADATA EXTRACTION DEBUG ===');
    console.log('Original text length:', text.length);
    console.log('Header section (first 1000 chars):');
    console.log(headerSection.substring(0, 1000));
    console.log('\n--- Line breaks preserved ---');
    console.log(headerSection.substring(0, 1000).replace(/\n/g, '\\n'));
  }

  // Preserve original text with line breaks for line-dependent patterns
  const originalText = headerSection.trim();
  
  // Clean text for patterns that don't need line breaks
  const cleanText = headerSection.replace(/\s+/g, ' ').trim();

  if (text.length > 100) {
    console.log('\n--- After cleaning (first 300 chars) ---');
    console.log(cleanText.substring(0, 300));
  }

  // Extract each metadata field using both original and cleaned text
  metadata.appealReferenceNumber = extractAppealReference(originalText, cleanText);
  metadata.siteVisitDate = extractSiteVisitDate(originalText, cleanText);
  metadata.decisionDate = extractDecisionDate(originalText, cleanText);
  metadata.lpa = extractLPA(originalText, cleanText);
  metadata.inspector = extractInspector(originalText, cleanText);
  metadata.decisionOutcome = extractDecisionOutcome(originalText, cleanText);

  if (text.length > 100) {
    console.log('\n--- Extraction Results ---');
    console.log('Appeal Reference:', metadata.appealReferenceNumber);
    console.log('Site Visit Date:', metadata.siteVisitDate);
    console.log('Decision Date:', metadata.decisionDate);
    console.log('LPA:', metadata.lpa);
    console.log('Inspector:', metadata.inspector);
    console.log('Decision Outcome:', metadata.decisionOutcome);
    console.log('=== END DEBUG ===\n');
  }

  return metadata;
}

/**
 * Extract Appeal Reference Number - format with '/' separators ending in 7 digits
 * Examples: APP/X9999/W/20/3359543, APP/T0355/W/21/3359411
 */
function extractAppealReference(originalText: string, cleanText: string): string {
  // Try both original and cleaned text
  const textsToTry = [originalText, cleanText];
  
  // AIDEV-NOTE: Simple patterns based on actual format
  const patterns = [
    // Basic format: sequences ending with 7 digits and containing '/'
    /[A-Z0-9\/]+\/\d{7}/gi,
    // Look for patterns after "Appeal Ref:" or similar
    /(?:Appeal\s+(?:Ref|Reference)[:\s]+)([A-Z0-9\/]+\/\d{7})/gi,
    // Look for patterns after "Ref:"
    /(?:Ref[:\s]+)([A-Z0-9\/]+\/\d{7})/gi
  ];

  for (const textToSearch of textsToTry) {
    for (const pattern of patterns) {
      const match = textToSearch.match(pattern);
      if (match) {
        let candidate = match[1] || match[0];
        
        // Validate that it ends with exactly 7 digits and has the right structure
        if (/\d{7}$/.test(candidate) && candidate.includes('/')) {
          console.log(`Found appeal reference: ${candidate}`);
          return candidate.toUpperCase();
        }
      }
    }
  }

  return 'NOT_FOUND';
}

/**
 * Extract Site Visit Date - follows "Site visit made on"
 */
function extractSiteVisitDate(originalText: string, cleanText: string): string {
  const textsToTry = [originalText, cleanText];
  
  // AIDEV-NOTE: Simple patterns based on actual debug output format
  const patterns = [
    // Basic pattern: "Site visit made on" followed by date
    /Site visit made on ([^\n\r.]+)/i,
    // More flexible with spacing
    /Site\s+visit\s+made\s+on\s+([^\n\r.]+)/i
  ];

  for (const textToSearch of textsToTry) {
    for (const pattern of patterns) {
      const match = textToSearch.match(pattern);
      if (match && match[1]) {
        let dateStr = match[1].trim();
        console.log(`Found site visit date: ${dateStr}`);
        return parseAndNormalizeDate(dateStr);
      }
    }
  }

  return 'NOT_FOUND';
}

/**
 * Extract Decision Date - follows "Decision date:"
 */
function extractDecisionDate(originalText: string, cleanText: string): string {
  const textsToTry = [originalText, cleanText];
  
  // AIDEV-NOTE: Simple patterns based on actual debug output
  const patterns = [
    // Basic pattern: "Decision date:" followed by date
    /Decision date:\s*([^\n\r.]+)/i,
    // More flexible with spacing
    /Decision\s+date:\s*([^\n\r.]+)/i
  ];

  for (const textToSearch of textsToTry) {
    for (const pattern of patterns) {
      const match = textToSearch.match(pattern);
      if (match && match[1]) {
        let dateStr = match[1].trim();
        // Remove any trailing period
        dateStr = dateStr.replace(/\.$/, '');
        console.log(`Found decision date: ${dateStr}`);
        return parseAndNormalizeDate(dateStr);
      }
    }
  }

  return 'NOT_FOUND';
}

/**
 * Extract LPA - follows "against the decision of [LPA]"
 */
function extractLPA(originalText: string, cleanText: string): string {
  const textsToTry = [originalText, cleanText];
  
  // AIDEV-NOTE: Simple patterns based on actual debug output
  const patterns = [
    // Basic pattern: "against the decision of [Council Name]"
    /against the decision of ([^.\n\r]+)/i,
    // Look for council names directly in bullet points
    /•.*?against the decision of ([^.\n\r]+)/i
  ];

  for (const textToSearch of textsToTry) {
    for (const pattern of patterns) {
      const match = textToSearch.match(pattern);
      if (match && match[1]) {
        let lpa = match[1].trim();
        
        // Clean up extracted text
        lpa = lpa
          .replace(/^(the\s+)?/gi, '')
          .replace(/\s+/g, ' ')
          .replace(/[.,;]$/, '')
          .trim();
        
        // Validate it looks like a council name
        if (lpa.length > 5 && !/^(decision|appeal|the\s)/i.test(lpa)) {
          console.log(`Found LPA: ${lpa}`);
          return lpa;
        }
      }
    }
  }

  return 'NOT_FOUND';
}

/**
 * Extract Inspector - follows "by [Inspector Name] an Inspector appointed by the Secretary of State"
 */
function extractInspector(originalText: string, cleanText: string): string {
  const textsToTry = [originalText, cleanText];
  
  // AIDEV-NOTE: Simple patterns based on actual debug output
  const patterns = [
    // Basic pattern: "by [Name] [Qualifications]" - capture name before qualifications
    /by ([A-Z][A-Za-z ]+?) (?:[A-Z]{2,}|an Inspector)/i,
    // Alternative pattern: "by [Name] [qualifications]" 
    /by ([A-Z][A-Za-z ]+?) (?:BA|BSc|MSc|MRTPI|RIBA|Dip|Arch|Hons|PGCE|FRICS|FAAV|RTPI|PGDip|MA)/i
  ];

  for (const textToSearch of textsToTry) {
    for (const pattern of patterns) {
      const match = textToSearch.match(pattern);
      if (match && match[1]) {
        let inspector = match[1].trim();
        
        // Clean up any remaining qualifications
        inspector = inspector
          .replace(/\s+(BA|BSc|MSc|MRTPI|RIBA|Dip\.|Arch|Hons|PGCE|FRICS|FAAV|RTPI|F\s*RTPI|PGDip|MA).*$/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Validate it looks like a proper name
        if (inspector.length >= 3 && /^[A-Z]/.test(inspector) && inspector.includes(' ')) {
          console.log(`Found inspector: ${inspector}`);
          return inspector;
        }
      }
    }
  }

  return 'NOT_FOUND';
}

/**
 * Extract Decision Outcome - under "Decision" heading, simplified to "Dismissed" or "Allowed"
 */
function extractDecisionOutcome(originalText: string, cleanText: string): 'Dismissed' | 'Allowed' | 'NOT_FOUND' {
  const textsToTry = [originalText, cleanText];
  
  // AIDEV-NOTE: Simple patterns based on actual debug output
  const patterns = [
    // Look for "Decision" heading followed by the outcome
    /Decision[:\s]*[^\n\r]*?(dismissed|allowed)/i,
    // Pattern for "The appeal is dismissed/allowed"
    /The\s+appeal\s+is\s+(dismissed|allowed)/i,
    // More general appeal outcome pattern
    /appeal.*?is\s+(dismissed|allowed)/i
  ];

  for (const textToSearch of textsToTry) {
    for (const pattern of patterns) {
      const match = textToSearch.match(pattern);
      if (match && match[1]) {
        const outcome = match[1].toLowerCase();
        if (outcome === 'dismissed') {
          console.log('Found decision outcome: Dismissed');
          return 'Dismissed';
        }
        if (outcome === 'allowed') {
          console.log('Found decision outcome: Allowed');
          return 'Allowed';
        }
      }
    }
  }

  return 'NOT_FOUND';
}

/**
 * Parse and normalize date from various formats
 */
function parseAndNormalizeDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return 'NOT_FOUND';
  }

  const cleaned = dateStr.trim();
  
  // For now, just return the cleaned original string
  // In a real implementation, you might want to normalize to a specific format
  // using patterns like: DD Month YYYY, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, Month DD, YYYY
  return cleaned;
}