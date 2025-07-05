/**
 * Web Scraper Service
 * 
 * Handles web scraping of appeal case data from UK Planning Appeals website.
 * Uses cheerio for HTML parsing. Single responsibility for web scraping only.
 * 
 * AIDEV-NOTE: Focused web scraper extracted from appeal downloader
 */

import * as cheerio from 'cheerio';
import type { IWebScraper, IHttpClient, AppealCaseData, IEnvironmentDetector } from './interfaces.js';

export class WebScraper implements IWebScraper {
  private httpClient: IHttpClient;
  private environmentDetector: IEnvironmentDetector;

  constructor(httpClient: IHttpClient, environmentDetector: IEnvironmentDetector) {
    this.httpClient = httpClient;
    this.environmentDetector = environmentDetector;
  }

  isProduction(): boolean {
    return this.environmentDetector.isProduction();
  }

  async scrapeAppealCase(caseId: string): Promise<Partial<AppealCaseData>> {
    const url = `https://acp.planninginspectorate.gov.uk/ViewCase.aspx?CaseID=${caseId}`;

    try {
      console.log(`[WebScraper] Scraping case ${caseId} from ${url}`);
      
      const htmlData = await this.httpClient.get(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      return this.parseHtmlContent(htmlData, caseId, url);
    } catch (error) {
      throw new Error(`Failed to scrape case ${caseId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseHtmlContent(htmlContent: string, caseId: string, url: string): Partial<AppealCaseData> {
    try {
      const $ = cheerio.load(htmlContent);

      // Extract case data using field mapping from original implementation
      const caseData: Partial<AppealCaseData> = {
        case_id: caseId,
        doc_link_span: url,
        case_type: this.extractText($, '#cphMainContent_labCaseTypeName'),
        start_date: this.extractText($, '#cphMainContent_labStartDate'),
        lpa_name: this.extractText($, '#cphMainContent_labLPAName'),
        questionnaire_due: this.extractText($, '#cphMainContent_labQuestionnaireDueDate'),
        statement_due: this.extractText($, '#cphMainContent_labAppellantLPARepsDueDate'),
        case_officer: this.extractText($, '#cphMainContent_labCaseOfficer'),
        interested_party_comments_due: this.extractText($, '#cphMainContent_labInterestedPartyCommentsDueDate'),
        procedure: this.extractText($, '#cphMainContent_labProcedure'),
        final_comments_due: this.extractText($, '#cphMainContent_labFinalCommentsDueDate'),
        status: this.extractText($, '#cphMainContent_labStatus'),
        inquiry_evidence_due: this.extractText($, '#cphMainContent_labInquiryEvidenceDueDate'),
        decision_outcome: this.extractText($, '#cphMainContent_labOutcome'),
        event_date: this.extractText($, '#cphMainContent_labEventDate'),
        link_status: this.extractText($, '#cphMainContent_labCaseLinkStatus'),
        decision_date: this.extractText($, '#cphMainContent_labDecisionDate'),
        linked_case_count: this.extractNumber($, '#cphMainContent_labLinkedCaseCount')
      };

      // Extract PDF link for later processing
      const decisionLinkSpan = $('#cphMainContent_labDecisionLink');
      const pdfLinks = decisionLinkSpan.find('a').toArray();

      if (pdfLinks.length > 0) {
        const pdfLink = $(pdfLinks[0]).attr('href');
        if (pdfLink) {
          // Store the PDF URL for later processing by PDFProcessor
          (caseData as any).pdfUrl = `https://acp.planninginspectorate.gov.uk/${pdfLink}`;
        }
      }

      return caseData;
    } catch (error) {
      throw new Error(`Failed to parse HTML for case ${caseId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractText($: cheerio.CheerioAPI, selector: string): string {
    return $(selector).text().trim() || '';
  }

  private extractNumber($: cheerio.CheerioAPI, selector: string): number {
    const text = this.extractText($, selector);
    const number = parseInt(text);
    return isNaN(number) ? 0 : number;
  }

  /**
   * Extract PDF URLs from case data
   */
  extractPdfUrls(htmlContent: string): string[] {
    try {
      const $ = cheerio.load(htmlContent);
      const decisionLinkSpan = $('#cphMainContent_labDecisionLink');
      const pdfLinks = decisionLinkSpan.find('a').toArray();

      return pdfLinks
        .map((link: any) => $(link).attr('href'))
        .filter((href: string | undefined) => href && href.trim())
        .map((href: string) => `https://acp.planninginspectorate.gov.uk/${href}`);
    } catch (error) {
      console.warn(`[WebScraper] Failed to extract PDF URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
}