import type { Document, SearchIndex, WorkerMessage, ProcessingProgress } from '@/types';
import { extractPlanningAppealMetadata } from '@/utils/metadataExtractor';

// Dynamic import of PDF.js to avoid build issues
let pdfjsLib: any = null;

// Helper function to extract and clean text from a PDF page
function extractPageText(textContent: any, pageNum: number, totalPages: number): string {
  if (!textContent || !textContent.items || !Array.isArray(textContent.items)) {
    return '';
  }

  // Extract text items with position information
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
    const yDiff = b.y - a.y; // Reverse Y (PDF coordinates are bottom-up)
    if (Math.abs(yDiff) > 5) { // Same line threshold
      return yDiff;
    }
    return a.x - b.x; // Left to right
  });

  // Group items into lines and remove likely footers
  const lines: string[] = [];
  let currentLine: any[] = [];
  let lastY = textItems[0]?.y;

  for (const item of textItems) {
    // Check if this item is on a new line
    if (Math.abs(item.y - lastY) > 5) {
      // Process current line
      if (currentLine.length > 0) {
        const lineText = currentLine.map(i => i.text).join(' ');
        if (!isLikelyFooter(lineText, pageNum, totalPages)) {
          lines.push(lineText);
        }
      }
      currentLine = [item];
      lastY = item.y;
    } else {
      currentLine.push(item);
    }
  }

  // Process final line
  if (currentLine.length > 0) {
    const lineText = currentLine.map(i => i.text).join(' ');
    if (!isLikelyFooter(lineText, pageNum, totalPages)) {
      lines.push(lineText);
    }
  }

  // Join lines with proper spacing
  return lines.join('\n').trim();
}

// Helper function to identify and filter out footers
function isLikelyFooter(text: string, _pageNum: number, _totalPages: number): boolean {
  const lowerText = text.toLowerCase().trim();
  
  // Skip empty or very short text
  if (lowerText.length < 3) {
    return true;
  }
  
  // Common footer patterns
  const footerPatterns = [
    // Page numbers
    /^page\s*\d+/i,
    /^\d+\s*$/, // Just a number
    /^\d+\s*of\s*\d+/i,
    /^\d+\s*\/\s*\d+/,
    
    // Copyright and legal
    /©.*\d{4}/i,
    /copyright.*\d{4}/i,
    /all rights reserved/i,
    
    // Document identifiers
    /^ref:/i,
    /^document\s*(id|number)/i,
    /^version\s*\d/i,
    
    // Website URLs and contact info
    /www\./i,
    /\.com/i,
    /\.org/i,
    /\.gov/i,
    /@\w+\./i,
    
    // Common footer words
    /^confidential$/i,
    /^draft$/i,
    /^final$/i,
    
    // Date patterns at bottom
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    /^\d{4}-\d{2}-\d{2}$/,
  ];
  
  // Check if text matches any footer pattern
  for (const pattern of footerPatterns) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }
  
  // If text is mostly numbers/symbols and short, likely a footer
  if (lowerText.length < 10 && /^[\d\s\-\/\(\)\.]+$/.test(lowerText)) {
    return true;
  }
  
  return false;
}

// Helper function to clean and optimize extracted text
function cleanExtractedText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text
    // Normalize whitespace
    .replace(/\r\n/g, '\n')  // Windows line endings
    .replace(/\r/g, '\n')    // Mac line endings
    
    // Remove excessive whitespace
    .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs to single space
    .replace(/\n[ \t]+/g, '\n')  // Spaces after newlines
    .replace(/[ \t]+\n/g, '\n')  // Spaces before newlines
    
    // Clean up excessive line breaks but preserve paragraph structure
    .replace(/\n{4,}/g, '\n\n\n')  // Max 3 consecutive newlines
    
    // Remove common PDF artifacts
    .replace(/\f/g, '')  // Form feed characters
    .replace(/\u00A0/g, ' ')  // Non-breaking spaces
    .replace(/[\u2000-\u200B]/g, ' ')  // Various Unicode spaces
    
    // Clean up hyphenated words split across lines
    .replace(/(\w)-\n(\w)/g, '$1$2')  // Remove hyphenation at line breaks
    
    // Normalize quotes and apostrophes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    
    // Remove or fix common OCR errors (optional - be careful not to over-clean)
    .replace(/\s+([.,;:!?])/g, '$1')  // Fix spacing before punctuation
    
    // Final cleanup
    .trim();
    
  // Remove duplicate consecutive lines (common in poorly formatted PDFs)
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

async function initializePdfJs() {
  if (!pdfjsLib) {
    try {
      // Try different import methods for better compatibility
      try {
        pdfjsLib = await import('pdfjs-dist/build/pdf.mjs' as any);
      } catch (importError) {
        pdfjsLib = await import('pdfjs-dist');
      }
      
      // Configure PDF.js worker with proper URL
      if (pdfjsLib.GlobalWorkerOptions) {
        // Use a more reliable CDN URL with correct version
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
      } else if (pdfjsLib.default && pdfjsLib.default.GlobalWorkerOptions) {
        pdfjsLib.default.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
      }
    } catch (error) {
      console.error('Failed to initialize PDF.js:', error);
      throw error;
    }
  }
  return pdfjsLib;
}


let isPaused = false;
let currentProgress: ProcessingProgress = {
  total: 0,
  completed: 0,
  failed: 0,
  status: 'idle'
};

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'process-batch':
        await processBatch(payload.files, payload.startIndex);
        break;
      case 'pause':
        isPaused = true;
        currentProgress.status = 'paused';
        postProgress();
        break;
      case 'resume':
        isPaused = false;
        currentProgress.status = 'processing';
        postProgress();
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

async function processBatch(files: Array<{name: string, size: number, data: ArrayBuffer, index: number}>, startIndex: number) {
  currentProgress = {
    total: files.length,
    completed: 0,
    failed: 0,
    status: 'processing'
  };

  // Initialize PDF.js once for the entire batch
  try {
    await initializePdfJs();
  } catch (error) {
    // Don't fall back to mock processing - let the error propagate
    currentProgress.status = 'error';
    currentProgress.failed = files.length;
    postProgress();
    
    self.postMessage({
      type: 'error',
      payload: `PDF.js initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    return;
  }

  const batchSize = 5; // Smaller batch size for PDF processing
  const results: Array<{ document: Document; searchIndex: SearchIndex | null }> = [];

  for (let i = 0; i < files.length; i += batchSize) {
    if (isPaused) {
      await waitForResume();
    }

    const batch = files.slice(i, i + batchSize);
    
    for (const file of batch) {
      if (isPaused) {
        await waitForResume();
      }

      currentProgress.current = file.name;
      postProgress();

      try {
        const result = await processFile(file, startIndex + file.index);
        results.push(result);
        currentProgress.completed++;
      } catch (error) {
        currentProgress.failed++;
        
        // Don't create any document entry for failed processing
        // This will force the UI to show the error rather than saving incomplete data
      }

      postProgress();
    }

    // Send batch results
    self.postMessage({
      type: 'complete',
      payload: { batch: results.slice(-batchSize) }
    });
  }

  currentProgress.status = 'completed';
  currentProgress.current = undefined;
  postProgress();
}

async function processFile(file: {name: string, size: number, data: ArrayBuffer, index: number}, index: number): Promise<{ document: Document; searchIndex: SearchIndex }> {
  
  try {
    if (!pdfjsLib) {
      throw new Error('PDF.js not initialized');
    }

    // Validate PDF data
    if (!file.data || file.data.byteLength === 0) {
      throw new Error('Empty PDF data');
    }
    
    // Load PDF using PDF.js
    const uint8Array = new Uint8Array(file.data);
    
    // Check if it looks like a PDF file
    const pdfHeader = new TextDecoder().decode(uint8Array.slice(0, 5));
    if (!pdfHeader.startsWith('%PDF')) {
      throw new Error('Invalid PDF format - missing PDF header');
    }
    
    
    // Handle both default export and direct export
    const pdfLib = pdfjsLib.default || pdfjsLib;
    
    const loadingTask = pdfLib.getDocument({ 
      data: uint8Array,
      verbosity: 0, // Suppress PDF.js warnings
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false
    });
    
    // Add timeout and better error handling
    const pdf = await Promise.race([
      loadingTask.promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF loading timeout after 30 seconds')), 30000)
      )
    ]);

    // Extract text from all pages (no artificial page limit)
    let fullText = '';
    const totalPages = pdf.numPages;
    
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (isPaused) {
        await waitForResume();
      }
      
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text with better formatting preservation
        const pageText = extractPageText(textContent, pageNum, totalPages);
        
        if (pageText.trim()) {
          fullText += pageText + '\n\n'; // Double newline between pages
        }
        
        // Clean up page resources
        page.cleanup();
      } catch (pageError) {
        // Continue with other pages
      }
    }

    // Clean up and optimize the extracted text
    fullText = cleanExtractedText(fullText);
    
    // AIDEV-NOTE: Extract planning appeal specific metadata from document text
    const appealMetadata = extractPlanningAppealMetadata(fullText);

    // Get metadata
    let metadata;
    try {
      metadata = await pdf.getMetadata();
    } catch (metaError) {
      metadata = { info: {} };
    }
    
    const info = metadata?.info || {};
    
    const document: Document = {
      id: `doc_${index}`,
      filename: file.name,
      size: file.size,
      uploadDate: new Date(),
      processingStatus: 'completed',
      metadata: {
        pageCount: pdf.numPages,
        title: info.Title || file.name,
        author: info.Author || 'Unknown',
        subject: info.Subject || '',
        keywords: info.Keywords || '',
        // AIDEV-NOTE: Include extracted planning appeal metadata
        appealReferenceNumber: appealMetadata.appealReferenceNumber,
        siteVisitDate: appealMetadata.siteVisitDate,
        decisionDate: appealMetadata.decisionDate,
        lpa: appealMetadata.lpa,
        inspector: appealMetadata.inspector,
        decisionOutcome: appealMetadata.decisionOutcome
      }
    };

    const searchIndex: SearchIndex = {
      docId: document.id,
      content: fullText.trim() || `Document: ${file.name} (${pdf.numPages} pages)`,
      metadata: {
        pageCount: pdf.numPages,
        title: info.Title || file.name,
        author: info.Author || 'Unknown',
        subject: info.Subject || '',
        keywords: info.Keywords || '',
        // AIDEV-NOTE: Include extracted planning appeal metadata for search indexing
        appealReferenceNumber: appealMetadata.appealReferenceNumber,
        siteVisitDate: appealMetadata.siteVisitDate,
        decisionDate: appealMetadata.decisionDate,
        lpa: appealMetadata.lpa,
        inspector: appealMetadata.inspector,
        decisionOutcome: appealMetadata.decisionOutcome
      }
    };

    // Clean up PDF resources
    pdf.cleanup();

    return { document, searchIndex };
    
  } catch (error) {
    // Don't create fallback data - let the error propagate
    throw error;
  }
}

// Mock processing function removed - no fallbacks, expose real errors

function postProgress() {
  self.postMessage({
    type: 'progress',
    payload: currentProgress
  });
}

async function waitForResume(): Promise<void> {
  return new Promise((resolve) => {
    const checkPause = () => {
      if (!isPaused) {
        resolve();
      } else {
        setTimeout(checkPause, 100);
      }
    };
    checkPause();
  });
}