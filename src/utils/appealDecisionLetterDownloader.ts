import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { getEnvironmentConfig } from './environment.js';

// AIDEV-NOTE: Interface matching sampledata.json structure for appeal case data
interface AppealCaseData {
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

// AIDEV-NOTE: Configuration interface for downloader behavior
interface DownloaderConfig {
  concurrencyLimit: number;
  rateLimitMs: number;
  maxRetries: number;
  batchSize: number;
  timeoutMs: number;
}

// AIDEV-NOTE: Progress tracking interface
interface ProcessingProgress {
  totalCases: number;
  processedCases: number;
  failedCases: number;
  currentBatch: number;
  totalBatches: number;
  currentCase?: string;
}

// AIDEV-NOTE: Failed case logging interface
interface FailedCase {
  caseId: string;
  url: string;
  error: string;
  timestamp: string;
  retryCount: number;
}

class AppealDecisionLetterDownloader {
  private axiosClient: AxiosInstance;
  private config: DownloaderConfig;
  private progress: ProcessingProgress;
  private failedCases: FailedCase[] = [];
  private pdfjsLib: any = null;

  // AIDEV-NOTE: Cold storage integration for direct document processing
  private coldStorageMode: boolean = false;
  private transformAndStoreCallback: ((documents: AppealCaseData[]) => Promise<void>) | null = null;

  constructor(config: Partial<DownloaderConfig> = {}) {
    this.config = {
      concurrencyLimit: 10,
      rateLimitMs: 200,
      maxRetries: 3,
      batchSize: 1000,
      timeoutMs: 30000,
      ...config
    };

    // AIDEV-NOTE: Security-enhanced Axios setup with HTTPS enforcement
    const envConfig = getEnvironmentConfig();
    this.axiosClient = axios.create({
      timeout: this.config.timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // AIDEV-NOTE: Add request interceptor to enforce HTTPS in production
    if (envConfig.enforceHttps) {
      this.axiosClient.interceptors.request.use((config) => {
        if (config.url && config.url.startsWith('http://')) {
          console.warn('[SECURITY] Converting HTTP to HTTPS:', config.url);
          config.url = config.url.replace('http://', 'https://');
        }
        return config;
      });
    }

    this.progress = {
      totalCases: 0,
      processedCases: 0,
      failedCases: 0,
      currentBatch: 0,
      totalBatches: 0
    };
  }

  // AIDEV-NOTE: Configure cold storage mode for direct integration
  enableColdStorageMode(_coldStorageService: any, transformAndStoreCallback: (documents: AppealCaseData[]) => Promise<void>) {
    this.coldStorageMode = true;
    this.transformAndStoreCallback = transformAndStoreCallback;
    console.log('[DOWNLOADER] Cold storage mode enabled - bypassing file system');
  }

  // AIDEV-NOTE: Disable cold storage mode (use file system)
  disableColdStorageMode() {
    this.coldStorageMode = false;
    this.transformAndStoreCallback = null;
    console.log('[DOWNLOADER] Cold storage mode disabled - using file system');
  }

  // AIDEV-NOTE: Check if cold storage mode is active
  isColdStorageMode(): boolean {
    return this.coldStorageMode && !!this.transformAndStoreCallback;
  }

  // AIDEV-NOTE: Initialize PDF.js with secure, configurable worker URL
  private async initializePdfJs(): Promise<void> {
    if (!this.pdfjsLib) {
      try {
        try {
          this.pdfjsLib = await import('pdfjs-dist/build/pdf.mjs' as any);
        } catch (importError) {
          this.pdfjsLib = await import('pdfjs-dist');
        }

        // AIDEV-NOTE: Security improvement - use environment-configured worker URL
        const config = getEnvironmentConfig();
        const workerUrl = config.pdfWorkerUrl;

        if (this.pdfjsLib.GlobalWorkerOptions) {
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        } else if (this.pdfjsLib.default && this.pdfjsLib.default.GlobalWorkerOptions) {
          this.pdfjsLib.default.GlobalWorkerOptions.workerSrc = workerUrl;
        }
        
        console.log('[PDF.js] Worker configured with URL:', workerUrl);
      } catch (error) {
        console.error('Failed to initialize PDF.js:', error);
        throw error;
      }
    }
  }

  // AIDEV-NOTE: Read case references from CSV file (browser-compatible version)
  private async getCaseReferences(): Promise<string[]> {
    // AIDEV-NOTE: Fetch CSV file from public directory in browser (accounting for base path)
    const response = await fetch('/decision-parser/caseReferences.csv');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch case references: ${response.status} ${response.statusText}`);
    }
    
    const csvContent = await response.text();
    
    // Parse CSV content - each line is a case ID
    const caseIds = csvContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !isNaN(Number(line))) // Ensure it's a valid number
      .slice(0, this.config.batchSize); // Respect configured batch size
    
    console.log(`[DOWNLOADER] Loaded ${caseIds.length} case references from CSV file`);
    return caseIds;
  }

  // AIDEV-NOTE: Extract text from PDF using PDF.js patterns from pdfProcessor.ts (browser-compatible)
  private async extractPdfText(pdfArrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const pdfLib = this.pdfjsLib.default || this.pdfjsLib;
      const uint8Array = new Uint8Array(pdfArrayBuffer);

      // Check PDF header
      const pdfHeader = new TextDecoder().decode(uint8Array.slice(0, 5));
      if (!pdfHeader.startsWith('%PDF')) {
        throw new Error('Invalid PDF format - missing PDF header');
      }

      const loadingTask = pdfLib.getDocument({
        data: uint8Array,
        verbosity: 0,
        disableAutoFetch: false,
        disableStream: false,
        disableRange: false
      });

      const pdf = await Promise.race([
        loadingTask.promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF loading timeout after 30 seconds')), 30000)
        )
      ]);

      let fullText = '';
      const totalPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          const pageText = this.extractPageText(textContent, pageNum, totalPages);

          if (pageText.trim()) {
            fullText += pageText + '\n\n';
          }

          page.cleanup();
        } catch (pageError) {
          // Continue with other pages
          continue;
        }
      }

      pdf.cleanup();
      return this.cleanExtractedText(fullText);
    } catch (error) {
      throw new Error(`PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // AIDEV-NOTE: Extract page text using same logic as pdfProcessor.ts
  private extractPageText(textContent: any, pageNum: number, totalPages: number): string {
    if (!textContent || !textContent.items || !Array.isArray(textContent.items)) {
      return '';
    }

    const textItems = textContent.items
      .filter((item: any) => item && typeof item.str === 'string' && item.str.trim())
      .map((item: any) => ({
        text: item.str.trim(),
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        height: item.height || 0
      }))
      .filter((item: any) => item.text.length > 0);

    if (textItems.length === 0) {
      return '';
    }

    textItems.sort((a: any, b: any) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) {
        return yDiff;
      }
      return a.x - b.x;
    });

    const lines: string[] = [];
    let currentLine: any[] = [];
    let lastY = textItems[0]?.y;

    for (const item of textItems) {
      if (Math.abs(item.y - lastY) > 5) {
        if (currentLine.length > 0) {
          const lineText = currentLine.map(i => i.text).join(' ');
          if (!this.isLikelyFooter(lineText, pageNum, totalPages)) {
            lines.push(lineText);
          }
        }
        currentLine = [item];
        lastY = item.y;
      } else {
        currentLine.push(item);
      }
    }

    if (currentLine.length > 0) {
      const lineText = currentLine.map(i => i.text).join(' ');
      if (!this.isLikelyFooter(lineText, pageNum, totalPages)) {
        lines.push(lineText);
      }
    }

    return lines.join('\n').trim();
  }

  // AIDEV-NOTE: Footer detection using same patterns as pdfProcessor.ts
  private isLikelyFooter(text: string, _pageNum: number, _totalPages: number): boolean {
    const lowerText = text.toLowerCase().trim();

    if (lowerText.length < 3) {
      return true;
    }

    const footerPatterns = [
      /^page\s*\d+/i,
      /^\d+\s*$/,
      /^\d+\s*of\s*\d+/i,
      /^\d+\s*\/\s*\d+/,
      /©.*\d{4}/i,
      /copyright.*\d{4}/i,
      /all rights reserved/i,
      /^ref:/i,
      /^document\s*(id|number)/i,
      /^version\s*\d/i,
      /www\./i,
      /\.com/i,
      /\.org/i,
      /\.gov/i,
      /@\w+\./i,
      /^confidential$/i,
      /^draft$/i,
      /^final$/i,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
      /^\d{4}-\d{2}-\d{2}$/,
    ];

    for (const pattern of footerPatterns) {
      if (pattern.test(lowerText)) {
        return true;
      }
    }

    if (lowerText.length < 10 && /^[\d\s\-\/\(\)\.]+$/.test(lowerText)) {
      return true;
    }

    return false;
  }

  // AIDEV-NOTE: Text cleaning using same logic as pdfProcessor.ts
  private cleanExtractedText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\f/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u2000-\u200B]/g, ' ')
      .replace(/(\w)-\n(\w)/g, '$1$2')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();

    const lines = cleaned.split('\n');
    const deduplicatedLines: string[] = [];
    let lastLine = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine !== lastLine || trimmedLine === '') {
        deduplicatedLines.push(line);
        lastLine = trimmedLine;
      }
    }

    return deduplicatedLines.join('\n').trim();
  }

  // AIDEV-NOTE: Environment detection for localhost vs production
  private isLocalDevelopment(): boolean {
    if (typeof window === 'undefined') {
      // Server-side or Node.js environment
      return false;
    }
    
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Check for localhost patterns
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname === '0.0.0.0' ||
                       hostname.startsWith('192.168.') ||
                       hostname.startsWith('10.') ||
                       hostname.endsWith('.local');
    
    // Check for development ports
    const isDevelopmentPort = port === '5173' || port === '5174' || port === '3000' || port === '8080' || port === '4173';
    
    return isLocalhost || isDevelopmentPort;
  }

  // AIDEV-NOTE: Generate simulated case data for localhost testing
  private generateSimulatedCaseData(caseId: string, url: string): AppealCaseData {
    // AIDEV-NOTE: Realistic case types from UK Planning Appeals
    const caseTypes = [
      'Householder Appeal', 'Full Planning Appeal', 'Advertisement Appeal',
      'Listed Building Appeal', 'Enforcement Appeal', 'Commercial Development Appeal',
      'Residential Development Appeal', 'Change of Use Appeal'
    ];

    // AIDEV-NOTE: Realistic Local Planning Authority names
    const lpaNames = [
      'Birmingham City Council', 'Manchester City Council', 'Leeds City Council',
      'Sheffield City Council', 'Bristol City Council', 'Liverpool City Council',
      'Newcastle upon Tyne City Council', 'Nottingham City Council', 'Cardiff Council',
      'Coventry City Council', 'Leicester City Council', 'Sunderland City Council'
    ];

    // AIDEV-NOTE: Realistic case officer names
    const caseOfficers = [
      'Sarah Johnson', 'Michael Brown', 'Emma Wilson', 'James Davis',
      'Lisa Thompson', 'David Miller', 'Rachel Green', 'Christopher Lee'
    ];

    // AIDEV-NOTE: Appeal procedures
    const procedures = [
      'Written Representations', 'Informal Hearing', 'Public Inquiry',
      'Householder Appeal Service', 'Commercial Appeal Service'
    ];

    // AIDEV-NOTE: Decision outcomes
    const outcomes = [
      'Appeal Allowed', 'Appeal Dismissed', 'Appeal Allowed in Part',
      'Appeal Withdrawn', 'Invalid Appeal', 'Split Decision'
    ];

    // AIDEV-NOTE: Generate realistic dates based on case ID
    const seed = parseInt(caseId) % 10000;
    const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
    const decisionDate = new Date(startDate.getTime() + (90 + (seed % 180)) * 24 * 60 * 60 * 1000);

    // AIDEV-NOTE: Generate realistic PDF content for testing
    const pdfContent = this.generateSimulatedPdfContent(caseId, caseTypes[seed % caseTypes.length], lpaNames[seed % lpaNames.length]);

    return {
      case_id: caseId,
      doc_link_span: url,
      case_type: caseTypes[seed % caseTypes.length],
      start_date: startDate.toLocaleDateString('en-GB'),
      lpa_name: lpaNames[seed % lpaNames.length],
      questionnaire_due: new Date(startDate.getTime() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
      statement_due: new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
      case_officer: caseOfficers[seed % caseOfficers.length],
      interested_party_comments_due: new Date(startDate.getTime() + 42 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
      procedure: procedures[seed % procedures.length],
      final_comments_due: new Date(startDate.getTime() + 56 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
      status: seed % 3 === 0 ? 'Closed' : 'In Progress',
      inquiry_evidence_due: procedures[seed % procedures.length] === 'Public Inquiry' ? new Date(startDate.getTime() + 70 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB') : '',
      decision_outcome: seed % 3 === 0 ? outcomes[seed % outcomes.length] : '',
      event_date: decisionDate.toLocaleDateString('en-GB'),
      link_status: seed % 5 === 0 ? 'Linked Case' : 'Standalone',
      decision_date: seed % 3 === 0 ? decisionDate.toLocaleDateString('en-GB') : '',
      linked_case_count: seed % 5 === 0 ? (seed % 3) + 1 : 0,
      content: pdfContent
    };
  }

  // AIDEV-NOTE: Generate realistic PDF content for testing search functionality
  private generateSimulatedPdfContent(caseId: string, caseType: string, lpaName: string): string {
    const seed = parseInt(caseId) % 10000;
    
    // AIDEV-NOTE: Template content that varies based on seed for testing
    const templates = [
      `PLANNING APPEAL DECISION

Appeal Reference: APP/${caseId}/D/23/${String(seed).padStart(6, '0')}
Case ID: ${caseId}

DECISION

The appeal is ${seed % 2 === 0 ? 'ALLOWED' : 'DISMISSED'}.

MAIN ISSUES

The main issues are:
- The effect of the development on the character and appearance of the area
- Whether the development would provide adequate living conditions for future occupants
- The impact on highway safety and parking provision

REASONING AND CONCLUSIONS

${seed % 3 === 0 ? 'The proposed development would be in keeping with the established character of the area. The design and scale are appropriate for the local context.' : 'The proposed development would have an adverse impact on the character and appearance of the area due to its scale and design.'}

${seed % 2 === 0 ? 'The development would provide adequate living conditions with sufficient light, outlook and privacy for future occupants.' : 'The development would result in poor living conditions due to inadequate light and privacy.'}

FORMAL DECISION

For the reasons given above, the appeal is ${seed % 2 === 0 ? 'ALLOWED' : 'DISMISSED'}.

Inspector: J. Smith BA(Hons) MRTPI
Date: ${new Date().toLocaleDateString('en-GB')}`,

      `APPEAL DECISION NOTICE

Planning Appeal by ${lpaName}
Appeal Reference: ${caseId}
Site: Land adjacent to residential properties
Development: ${caseType}

PRELIMINARY MATTERS

This appeal relates to an application for planning permission that was refused by ${lpaName}. The refusal was based on concerns about ${seed % 4 === 0 ? 'highway safety' : seed % 4 === 1 ? 'visual impact' : seed % 4 === 2 ? 'noise pollution' : 'environmental impact'}.

MAIN CONSIDERATIONS

The determining issues in this case are:
1. Policy compliance with local development plan
2. Impact on residential amenity
3. ${seed % 3 === 0 ? 'Heritage considerations' : seed % 3 === 1 ? 'Environmental protection' : 'Economic benefits'}

ASSESSMENT

${seed % 2 === 0 ? 'The proposal accords with the development plan and would not cause significant harm to residential amenity. The benefits of the development outweigh any limited harm.' : 'The proposal conflicts with development plan policies and would cause significant harm to residential amenity that is not outweighed by any benefits.'}

CONCLUSION

Having regard to all matters raised, I conclude that the appeal should be ${seed % 2 === 0 ? 'allowed' : 'dismissed'}.

Planning Inspector
Date of Decision: ${new Date().toLocaleDateString('en-GB')}`
    ];

    return templates[seed % templates.length];
  }

  // AIDEV-NOTE: Process case with real web scraping for production
  private async processCaseProduction(caseId: string, url: string): Promise<AppealCaseData> {
    console.log(`[DOWNLOADER] Scraping production data for case ${caseId}`);
    
    // Fetch case page HTML
    const response = await this.axiosClient.get(url, {
      timeout: this.config.timeoutMs,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Parse HTML with cheerio
    const $ = cheerio.load(response.data);

    // Extract case data using same field mapping as original Python script
    const caseData: Partial<AppealCaseData> = {
      case_id: caseId,
      doc_link_span: url,
      case_type: $('#cphMainContent_labCaseTypeName').text().trim() || '',
      start_date: $('#cphMainContent_labStartDate').text().trim() || '',
      lpa_name: $('#cphMainContent_labLPAName').text().trim() || '',
      questionnaire_due: $('#cphMainContent_labQuestionnaireDueDate').text().trim() || '',
      statement_due: $('#cphMainContent_labAppellantLPARepsDueDate').text().trim() || '',
      case_officer: $('#cphMainContent_labCaseOfficer').text().trim() || '',
      interested_party_comments_due: $('#cphMainContent_labInterestedPartyCommentsDueDate').text().trim() || '',
      procedure: $('#cphMainContent_labProcedure').text().trim() || '',
      final_comments_due: $('#cphMainContent_labFinalCommentsDueDate').text().trim() || '',
      status: $('#cphMainContent_labStatus').text().trim() || '',
      inquiry_evidence_due: $('#cphMainContent_labInquiryEvidenceDueDate').text().trim() || '',
      decision_outcome: $('#cphMainContent_labOutcome').text().trim() || '',
      event_date: $('#cphMainContent_labEventDate').text().trim() || '',
      link_status: $('#cphMainContent_labCaseLinkStatus').text().trim() || '',
      decision_date: $('#cphMainContent_labDecisionDate').text().trim() || '',
      linked_case_count: parseInt($('#cphMainContent_labLinkedCaseCount').text().trim()) || 0
    };

    // Find decision letter PDF link
    const decisionLinkSpan = $('#cphMainContent_labDecisionLink');
    const pdfLinks = decisionLinkSpan.find('a').toArray();

    let pdfContent = '';

    if (pdfLinks.length > 0) {
      const pdfLink = $(pdfLinks[0]).attr('href');
      if (pdfLink) {
        const pdfUrl = `https://acp.planninginspectorate.gov.uk/${pdfLink}`;

        try {
          // Download and extract PDF content
          const pdfResponse = await this.axiosClient.get(pdfUrl, {
            responseType: 'arraybuffer',
            timeout: this.config.timeoutMs
          });

          pdfContent = await this.extractPdfText(pdfResponse.data);
        } catch (pdfError) {
          console.warn(`Failed to extract PDF for case ${caseId}: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
          pdfContent = `PDF extraction failed for case ${caseId}`;
        }
      }
    }

    return {
      ...caseData,
      content: pdfContent || `Case data for ${caseId} - No PDF content available`,
    } as AppealCaseData;
  }

  // AIDEV-NOTE: Process single case - environment-aware (localhost simulation vs production scraping)
  private async processCase(caseId: string, retryCount = 0): Promise<AppealCaseData> {
    const url = `https://acp.planninginspectorate.gov.uk/ViewCase.aspx?CaseID=${caseId}`;

    try {
      // Add rate limiting
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs));

      // AIDEV-NOTE: Environment-aware processing
      if (this.isLocalDevelopment()) {
        console.log(`[DOWNLOADER] Using simulated data for case ${caseId} (localhost mode)`);
        return this.generateSimulatedCaseData(caseId, url);
      } else {
        console.log(`[DOWNLOADER] Using web scraping for case ${caseId} (production mode)`);
        return await this.processCaseProduction(caseId, url);
      }

    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        console.log(`  Retrying case ${caseId} (attempt ${retryCount + 1}/${this.config.maxRetries})`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs * Math.pow(2, retryCount)));
        return this.processCase(caseId, retryCount + 1);
      }

      throw error;
    }
  }

  // AIDEV-NOTE: Process cases with concurrency control and error handling
  private async processCasesWithConcurrency(caseIds: string[]): Promise<AppealCaseData[]> {
    const results: AppealCaseData[] = [];

    for (let i = 0; i < caseIds.length; i += this.config.concurrencyLimit) {
      const batch = caseIds.slice(i, i + this.config.concurrencyLimit);

      const batchPromises = batch.map(async (caseId) => {
        this.progress.currentCase = caseId;
        this.logProgress();

        try {
          const caseData = await this.processCase(caseId);
          this.progress.processedCases++;
          return caseData;
        } catch (error) {
          this.progress.failedCases++;

          const failedCase: FailedCase = {
            caseId,
            url: `https://acp.planninginspectorate.gov.uk/ViewCase.aspx?CaseID=${caseId}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            retryCount: this.config.maxRetries
          };

          this.failedCases.push(failedCase);
          console.error(`  Failed to process case ${caseId}: ${failedCase.error}`);

          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is AppealCaseData => result !== null));

      this.logProgress();
    }

    return results;
  }

  // AIDEV-NOTE: Save batch - either to file system or cold storage depending on mode
  private async saveBatch(batchData: AppealCaseData[], batchNumber: number): Promise<void> {
    if (this.isColdStorageMode() && this.transformAndStoreCallback) {
      // Cold storage mode - bypass file system
      console.log(`[DOWNLOADER] Processing batch ${batchNumber} for cold storage with ${batchData.length} cases`);

      try {
        await this.transformAndStoreCallback(batchData);
        console.log(`✅ Processed batch ${batchNumber} through cold storage with ${batchData.length} cases`);
      } catch (error) {
        console.error(`❌ Failed to process batch ${batchNumber} through cold storage:`, error);
        throw error;
      }
    } else {
      // File system mode - browser fallback (download as file)
      const filename = `documents-batch-${batchNumber.toString().padStart(3, '0')}.json`;
      const dataStr = JSON.stringify(batchData, null, 2);

      // Create downloadable blob
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create temporary download link
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';

      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up object URL
      URL.revokeObjectURL(url);

      console.log(`✅ Downloaded batch ${batchNumber} with ${batchData.length} cases as ${filename}`);
    }
  }

  // AIDEV-NOTE: Save failed cases log - conditional on mode
  private async saveFailedCasesLog(): Promise<void> {
    if (this.failedCases.length === 0) return;

    if (this.isColdStorageMode()) {
      // Cold storage mode - just log to console, don't save files
      console.log(`📝 [COLD-STORAGE] ${this.failedCases.length} failed cases during import:`);
      this.failedCases.forEach(fc => {
        console.log(`  - ${fc.timestamp} | Case: ${fc.caseId} | Error: ${fc.error} | Retries: ${fc.retryCount}`);
      });
    } else {
      // File system mode - browser fallback (download as file)
      const logContent = this.failedCases
        .map(fc => `${fc.timestamp} | Case: ${fc.caseId} | URL: ${fc.url} | Error: ${fc.error} | Retries: ${fc.retryCount}`)
        .join('\n');

      // Create downloadable blob
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      // Create temporary download link
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = 'failed-cases.log';
      downloadLink.style.display = 'none';

      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up object URL
      URL.revokeObjectURL(url);

      console.log(`📝 Downloaded failed cases log with ${this.failedCases.length} entries`);
    }
  }

  // AIDEV-NOTE: Progress logging to console
  private logProgress(): void {
    const percentage = ((this.progress.processedCases + this.progress.failedCases) / this.progress.totalCases * 100).toFixed(1);
    console.log(`📊 Progress: ${percentage}% (${this.progress.processedCases + this.progress.failedCases}/${this.progress.totalCases}) | Batch: ${this.progress.currentBatch}/${this.progress.totalBatches} | Failed: ${this.progress.failedCases} | Current: ${this.progress.currentCase || 'N/A'}`);
  }

  // AIDEV-NOTE: Main execution method
  public async downloadAllCases(): Promise<void> {
    console.log('🚀 Starting Appeal Decision Letter Downloader...');
    
    // Log environment mode
    const isLocal = this.isLocalDevelopment();
    console.log(`🌍 Environment: ${isLocal ? 'Local Development (Simulation Mode)' : 'Production (Web Scraping Mode)'}`);
    if (isLocal) {
      console.log('📝 Using simulated data to avoid CORS issues during development');
    } else {
      console.log('🌐 Using real web scraping for production data collection');
    }

    try {
      // Initialize PDF.js
      await this.initializePdfJs();
      console.log('✅ PDF.js initialized');

      // Get case references  
      const caseIds = await this.getCaseReferences();
      console.log(`📋 Loaded ${caseIds.length} case references`);

      // Initialize progress tracking
      this.progress.totalCases = caseIds.length;
      this.progress.totalBatches = Math.ceil(caseIds.length / this.config.batchSize);

      console.log(`🎯 Processing ${caseIds.length} cases in ${this.progress.totalBatches} batches of ${this.config.batchSize}`);
      console.log(`⚙️  Concurrency: ${this.config.concurrencyLimit}, Rate limit: ${this.config.rateLimitMs}ms`);

      // Process cases in batches
      for (let i = 0; i < caseIds.length; i += this.config.batchSize) {
        this.progress.currentBatch = Math.floor(i / this.config.batchSize) + 1;

        const batchCaseIds = caseIds.slice(i, i + this.config.batchSize);
        console.log(`\n🔄 Processing batch ${this.progress.currentBatch}/${this.progress.totalBatches} (${batchCaseIds.length} cases)`);

        const batchResults = await this.processCasesWithConcurrency(batchCaseIds);

        if (batchResults.length > 0) {
          await this.saveBatch(batchResults, this.progress.currentBatch);
        }
      }

      // Save failed cases log
      await this.saveFailedCasesLog();

      // Final summary
      console.log('\n🎉 Download complete!');
      console.log(`✅ Successfully processed: ${this.progress.processedCases} cases`);
      console.log(`❌ Failed: ${this.progress.failedCases} cases`);

      if (this.isColdStorageMode()) {
        console.log(`💾 Storage mode: Cold storage (encrypted archive)`);
      } else {
        console.log(`📁 Storage mode: Browser downloads`);
      }

    } catch (error) {
      console.error('💥 Fatal error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}

// AIDEV-NOTE: Export class for use in other modules, but don't execute automatically
export { AppealDecisionLetterDownloader, type AppealCaseData, type DownloaderConfig };

// AIDEV-NOTE: Example usage (commented out as requested - not called from anywhere)
/*
const downloader = new AppealDecisionLetterDownloader({
  concurrencyLimit: 8,
  rateLimitMs: 250,
  batchSize: 1000
});

downloader.downloadAllCases().catch(console.error);
*/