import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

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
  outputDir: string;
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

  constructor(config: Partial<DownloaderConfig> = {}) {
    this.config = {
      concurrencyLimit: 10,
      rateLimitMs: 200,
      maxRetries: 3,
      batchSize: 1000,
      outputDir: 'public/cold-storage/raw',
      timeoutMs: 30000,
      ...config
    };

    // AIDEV-NOTE: Axios setup with connection pooling for performance
    this.axiosClient = axios.create({
      timeout: this.config.timeoutMs,
      httpAgent: new (require('http').Agent)({
        keepAlive: true,
        maxSockets: this.config.concurrencyLimit
      }),
      httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: this.config.concurrencyLimit
      }),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    this.progress = {
      totalCases: 0,
      processedCases: 0,
      failedCases: 0,
      currentBatch: 0,
      totalBatches: 0
    };
  }

  // AIDEV-NOTE: Initialize PDF.js using same pattern as pdfProcessor.ts
  private async initializePdfJs(): Promise<void> {
    if (!this.pdfjsLib) {
      try {
        try {
          this.pdfjsLib = await import('pdfjs-dist/build/pdf.mjs' as any);
        } catch (importError) {
          this.pdfjsLib = await import('pdfjs-dist');
        }

        if (this.pdfjsLib.GlobalWorkerOptions) {
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
        } else if (this.pdfjsLib.default && this.pdfjsLib.default.GlobalWorkerOptions) {
          this.pdfjsLib.default.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
        }
      } catch (error) {
        console.error('Failed to initialize PDF.js:', error);
        throw error;
      }
    }
  }

  // AIDEV-NOTE: Read case references from CSV file
  private async readCaseReferences(): Promise<string[]> {
    try {
      const csvPath = path.join(process.cwd(), 'src/utils/caseReferences.csv');
      const csvContent = await fs.readFile(csvPath, 'utf-8');

      return csvContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (error) {
      throw new Error(`Failed to read case references CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // AIDEV-NOTE: Extract text from PDF using PDF.js patterns from pdfProcessor.ts
  private async extractPdfText(pdfBuffer: Buffer): Promise<string> {
    try {
      const pdfLib = this.pdfjsLib.default || this.pdfjsLib;
      const uint8Array = new Uint8Array(pdfBuffer);

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

  // AIDEV-NOTE: Process single case with web scraping and PDF extraction
  private async processCase(caseId: string, retryCount = 0): Promise<AppealCaseData> {
    const url = `https://acp.planninginspectorate.gov.uk/ViewCase.aspx?CaseID=${caseId}`;

    try {
      // Add rate limiting
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs));

      const response = await this.axiosClient.get(url);
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

            const pdfBuffer = Buffer.from(pdfResponse.data);
            pdfContent = await this.extractPdfText(pdfBuffer);
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

  // AIDEV-NOTE: Save batch to JSON file following established naming convention
  private async saveBatch(batchData: AppealCaseData[], batchNumber: number): Promise<void> {
    const outputDir = path.join(process.cwd(), this.config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    const filename = `documents-batch-${batchNumber.toString().padStart(3, '0')}.json`;
    const filepath = path.join(outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(batchData, null, 2));
    console.log(`✅ Saved batch ${batchNumber} with ${batchData.length} cases to ${filename}`);
  }

  // AIDEV-NOTE: Save failed cases log
  private async saveFailedCasesLog(): Promise<void> {
    if (this.failedCases.length === 0) return;

    const outputDir = path.join(process.cwd(), this.config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    const logPath = path.join(outputDir, 'failed-cases.log');
    const logContent = this.failedCases
      .map(fc => `${fc.timestamp} | Case: ${fc.caseId} | URL: ${fc.url} | Error: ${fc.error} | Retries: ${fc.retryCount}`)
      .join('\n');

    await fs.writeFile(logPath, logContent);
    console.log(`📝 Saved ${this.failedCases.length} failed cases to failed-cases.log`);
  }

  // AIDEV-NOTE: Progress logging to console
  private logProgress(): void {
    const percentage = ((this.progress.processedCases + this.progress.failedCases) / this.progress.totalCases * 100).toFixed(1);
    console.log(`📊 Progress: ${percentage}% (${this.progress.processedCases + this.progress.failedCases}/${this.progress.totalCases}) | Batch: ${this.progress.currentBatch}/${this.progress.totalBatches} | Failed: ${this.progress.failedCases} | Current: ${this.progress.currentCase || 'N/A'}`);
  }

  // AIDEV-NOTE: Main execution method
  public async downloadAllCases(): Promise<void> {
    console.log('🚀 Starting Appeal Decision Letter Downloader...');

    try {
      // Initialize PDF.js
      await this.initializePdfJs();
      console.log('✅ PDF.js initialized');

      // Read case references
      const caseIds = await this.readCaseReferences();
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
      console.log(`📁 Output directory: ${this.config.outputDir}`);

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