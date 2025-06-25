import fuzzysort from 'fuzzysort';
import type { SearchIndex, SearchResult, Document } from '@/types';
import { db } from '@/stores/database';

export class SearchEngine {
  private searchIndices: SearchIndex[] = [];
  private documents: Map<string, Document> = new Map();
  private threshold: number = 0.5; // AIDEV-NOTE: Configurable search threshold (converted to fuzzysort score)
  private prepared: { content: any; metadata: any; docId: string; }[] = []; // AIDEV-NOTE: Prepared search targets for fuzzysort

  async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.setupFuzzysort();

      // Allow initialization with 0 documents - prepared array will be empty but that's OK
    } catch (error) {
      throw new Error(`Search engine initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadData(): Promise<void> {
    try {
      const [indices, docs] = await Promise.all([
        db.getAllSearchIndices(),
        db.getAllDocuments()
      ]);

      if (!Array.isArray(indices) || !Array.isArray(docs)) {
        throw new Error('Invalid data format from database');
      }

      this.searchIndices = indices;
      this.documents = new Map(docs.map(doc => [doc.id, doc]));

    } catch (error) {
      throw new Error(`Database loading failed: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  private setupFuzzysort(): void {
    try {
      if (!this.searchIndices || this.searchIndices.length === 0) {
        this.prepared = [];
        return;
      }

      // AIDEV-NOTE: Prepare search targets for fuzzysort - combines content and metadata for optimal search
      this.prepared = this.searchIndices.map(index => {
        // Combine content with weighted metadata fields for comprehensive search
        const metadata = index.metadata || {};
        const searchableText = [
          index.content,
          metadata.title || '',
          metadata.appealReferenceNumber || '',
          metadata.lpa || '',
          metadata.inspector || '',
          metadata.decisionOutcome || '',
          metadata.author || '',
          metadata.subject || ''
        ].filter(Boolean).join(' ');

        return {
          content: fuzzysort.prepare(searchableText),
          metadata: index.metadata,
          docId: index.docId
        };
      });
    } catch (error) {
      throw new Error(`Search index setup failed: ${error instanceof Error ? error.message : 'Unknown fuzzysort error'}`);
    }
  }

  async search(query: string, limit: number = 50): Promise<SearchResult[]> {
    // Validate search requirements
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error('Search query is required and must be a non-empty string');
    }

    if (this.prepared.length === 0) {
      throw new Error('Search index is not initialized. Please check if documents have been uploaded and indexed.');
    }

    if (this.searchIndices.length === 0) {
      throw new Error('No documents available for search. Please upload some PDF documents first.');
    }

    try {
      const trimmedQuery = query.trim();

      // AIDEV-NOTE: Use fuzzysort.go for searching prepared targets
      const results = fuzzysort.go(trimmedQuery, this.prepared, {
        key: 'content',
        limit: limit,
        threshold: this.threshold / 10
      });

      const searchResults: SearchResult[] = [];

      for (const result of results) {
        const document = this.documents.get(result.obj.docId);
        if (!document) {
          continue;
        }

        // AIDEV-NOTE: Extract matches from fuzzysort result
        const matches = [{
          content: this.extractContextFromFuzzysort(result),
          matchValue: this.extractMatchValueFromFuzzysort(result),
          indices: this.extractIndicesFromFuzzysort(result),
          score: result.score
        }].filter((match) => {
          if (match.matchValue.length >= trimmedQuery.length * 0.5) {
            return match;
          }
        });

        if (matches.length > 0) {
          searchResults.push({
            document,
            matches,
            overallScore: result.score
          });
        }
      }

      // Save search history (but don't fail search if this fails)
      try {
        await db.addSearchHistory(trimmedQuery, searchResults.length);
      } catch (historyError) {
        // Ignore search history errors
      }

      return searchResults;
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown search error'}`);
    }
  }


  async refresh(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to refresh search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractContextFromFuzzysort(result: any, contextLength: number = 400): string {
    if (!result.target) {
      return '';
    }

    const text = result.target;
    const indices = result.indexes || [];

    if (indices.length === 0) {
      return text.substring(0, contextLength) + (text.length > contextLength ? '...' : '');
    }

    // Find the span of all matches
    const firstMatch = Math.min(...indices);
    const lastMatch = Math.max(...indices);

    // Calculate context boundaries
    const halfContext = Math.floor(contextLength / 2);
    const contextStart = Math.max(0, firstMatch - halfContext);
    const contextEnd = Math.min(text.length, lastMatch + halfContext);

    let context = text.substring(contextStart, contextEnd);

    // Add ellipsis if needed
    if (contextStart > 0) {
      context = '...' + context;
    }
    if (contextEnd < text.length) {
      context = context + '...';
    }

    return context;
  }

  private extractMatchValueFromFuzzysort(result: any): string {
    if (!result.target || !result.indexes) {
      return '';
    }

    const text = result.target;
    const indices = result.indexes;

    if (indices.length === 0) {
      return '';
    }

    // Find the longest contiguous match
    let longestStart = indices[0];
    let longestEnd = indices[0];
    let currentStart = indices[0];
    let currentEnd = indices[0];

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === currentEnd + 1) {
        currentEnd = indices[i];
      } else {
        if (currentEnd - currentStart > longestEnd - longestStart) {
          longestStart = currentStart;
          longestEnd = currentEnd;
        }
        currentStart = indices[i];
        currentEnd = indices[i];
      }
    }

    if (currentEnd - currentStart > longestEnd - longestStart) {
      longestStart = currentStart;
      longestEnd = currentEnd;
    }

    return text.substring(longestStart, longestEnd + 1);
  }

  private extractIndicesFromFuzzysort(result: any): [number, number][] {
    if (!result.indexes) {
      return [];
    }

    const indices = result.indexes;
    const pairs: [number, number][] = [];

    let start = indices[0];
    let end = indices[0];

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === end + 1) {
        end = indices[i];
      } else {
        pairs.push([start, end]);
        start = indices[i];
        end = indices[i];
      }
    }

    pairs.push([start, end]);
    return pairs;
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  getIndexedDocumentCount(): number {
    return this.searchIndices.length;
  }

  // AIDEV-NOTE: Methods for threshold configuration
  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.threshold = threshold;
    // Re-setup fuzzysort with new threshold (no re-preparation needed, threshold used in search)
  }

  getThreshold(): number {
    return this.threshold;
  }
}