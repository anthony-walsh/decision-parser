/**
 * PDF Processing Service
 * 
 * Handles PDF text extraction using PDF.js with proper error handling,
 * security configuration, and text cleaning. Single responsibility for PDF operations.
 * 
 * AIDEV-NOTE: Focused PDF processor extracted from appeal downloader
 */

import { getEnvironmentConfig } from '@/utils/environment.js';
import type { IPDFProcessor, IHttpClient } from './interfaces.js';

export class PDFProcessor implements IPDFProcessor {
  private pdfjsLib: any = null;
  private httpClient: IHttpClient;

  constructor(httpClient: IHttpClient) {
    this.httpClient = httpClient;
  }

  async initialize(): Promise<void> {
    if (!this.pdfjsLib) {
      try {
        // Try modern ES module import first
        try {
          this.pdfjsLib = await import('pdfjs-dist/build/pdf.mjs' as any);
        } catch (importError) {
          // Fallback to CommonJS
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
        
        console.log('[PDFProcessor] Worker configured with URL:', workerUrl);
      } catch (error) {
        console.error('[PDFProcessor] Failed to initialize PDF.js:', error);
        throw new Error(`PDF.js initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async extractTextFromUrl(url: string): Promise<string> {
    const buffer = await this.httpClient.download(url);
    return this.extractTextFromBuffer(buffer);
  }

  async extractTextFromBuffer(pdfArrayBuffer: ArrayBuffer): Promise<string> {
    if (!this.pdfjsLib) {
      throw new Error('PDF processor not initialized. Call initialize() first.');
    }

    try {
      const pdfLib = this.pdfjsLib.default || this.pdfjsLib;
      const uint8Array = new Uint8Array(pdfArrayBuffer);

      // Validate PDF header
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
          console.warn(`[PDFProcessor] Error processing page ${pageNum}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
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

    // Sort by Y position (top to bottom), then X position (left to right)
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

    // Likely footer if very short and only contains numbers/punctuation
    if (lowerText.length < 10 && /^[\d\s\-\/\(\)\.]+$/.test(lowerText)) {
      return true;
    }

    return false;
  }

  private cleanExtractedText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Clean up spaces
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      // Limit excessive line breaks
      .replace(/\n{4,}/g, '\n\n\n')
      // Remove form feed and other control characters
      .replace(/\f/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u2000-\u200B]/g, ' ')
      // Fix hyphenated words across lines
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Fix spacing around punctuation
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();

    // Remove duplicate consecutive lines
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
}