import Fuse from 'fuse.js';
import type { SearchIndex, SearchResult, Document } from '@/types';
import { db } from '@/stores/database';

export class SearchEngine {
  private fuse: Fuse<SearchIndex> | null = null;
  private searchIndices: SearchIndex[] = [];
  private documents: Map<string, Document> = new Map();

  async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.setupFuse();

      // Allow initialization with 0 documents - fuse will be null but that's OK
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

  private setupFuse(): void {
    try {
      if (!this.searchIndices || this.searchIndices.length === 0) {
        this.fuse = null;
        return;
      }

      const options = {
        keys: [
          { name: 'content', weight: 0.5 },
          { name: 'metadata.title', weight: 0.15 },
          { name: 'metadata.author', weight: 0.03 },
          { name: 'metadata.subject', weight: 0.03 },
          // AIDEV-NOTE: Planning appeal metadata fields for enhanced search
          { name: 'metadata.appealReferenceNumber', weight: 0.15 },
          { name: 'metadata.lpa', weight: 0.08 },
          { name: 'metadata.inspector', weight: 0.05 },
          { name: 'metadata.decisionOutcome', weight: 0.08 },
          { name: 'metadata.siteVisitDate', weight: 0.03 },
          { name: 'metadata.decisionDate', weight: 0.03 }
        ],
        threshold: 0.2, // Balanced threshold - not too strict, not too loose
        includeMatches: true,
        includeScore: true,
        minMatchCharLength: 2, // Allow 2+ characters but with better overall scoring
        findAllMatches: true, // Find multiple matches but with quality filtering
        ignoreLocation: true, // Don't penalize based on location in text
        ignoreFieldNorm: false, // Use field normalization for better scoring
        useExtendedSearch: false, // Keep simple search for reliability
        distance: 50, // Moderate distance for fuzzy matching
        shouldSort: true, // Sort results by relevance
        sortFn: (a: any, b: any) => a.score - b.score // Best matches first
      };

      this.fuse = new Fuse(this.searchIndices, options);
    } catch (error) {
      throw new Error(`Search index setup failed: ${error instanceof Error ? error.message : 'Unknown Fuse error'}`);
    }
  }

  async search(query: string, limit: number = 50): Promise<SearchResult[]> {
    // Validate search requirements
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error('Search query is required and must be a non-empty string');
    }

    if (!this.fuse) {
      throw new Error('Search index is not initialized. Please check if documents have been uploaded and indexed.');
    }

    if (this.searchIndices.length === 0) {
      throw new Error('No documents available for search. Please upload some PDF documents first.');
    }

    try {
      const trimmedQuery = query.trim();
      const results = this.fuse.search(trimmedQuery, { limit });
      const searchResults: SearchResult[] = [];

      for (const result of results) {
        const document = this.documents.get(result.item.docId);
        if (!document) {
          continue;
        }

        const matches = result.matches?.map(match => ({
          content: this.extractContext(match.value || '', match.indices || []),
          matchValue: this.extractMatchValue(match.value || '', match.indices || []),
          indices: (match.indices || []) as [number, number][],
          score: result.score || 0
        })) || [];

        searchResults.push({
          document,
          matches,
          overallScore: result.score || 0
        });
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

  private extractMatchValue(text: string, indices: readonly [number, number][]): string | undefined {
    // If no indices provided, return start of text as fallback
    if (!indices || indices.length === 0) {
      return "";
    }

    // AIDEV-NOTE: Find the most meaningful match - prefer longer matches and avoid document headers
    let bestMatch = indices[0];

    // Look for the longest match first (more meaningful)
    for (const match of indices) {
      const matchLength = match[1] - match[0];
      const bestLength = bestMatch[1] - bestMatch[0];
      if (matchLength > bestLength) {
        bestMatch = match;
      }
    }

    // If the best match is still very short (2 chars) and in the header area,
    // try to find a match that's deeper in the document
    if ((bestMatch[1] - bestMatch[0]) <= 2 && bestMatch[0] < 200) {
      for (const match of indices) {
        if (match[0] > 200) { // Skip document header area
          bestMatch = match;
          break;
        }
      }
    }

    const matchStart = bestMatch[0];
    const matchEnd = bestMatch[1];

    // Extract the context
    let context = text.substring(matchStart, matchEnd + 1);

    return context;
  }

  private extractContext(text: string, indices: readonly [number, number][], contextLength: number = 400): string {
    // If no indices provided, return start of text as fallback
    if (!indices || indices.length === 0) {
      return text.substring(0, contextLength) + (text.length > contextLength ? '...' : '');
    }

    // AIDEV-NOTE: Find the most meaningful match - prefer longer matches and avoid document headers
    let bestMatch = indices[0];

    // Look for the longest match first (more meaningful)
    for (const match of indices) {
      const matchLength = match[1] - match[0];
      const bestLength = bestMatch[1] - bestMatch[0];
      if (matchLength > bestLength) {
        bestMatch = match;
      }
    }

    // If the best match is still very short (2 chars) and in the header area,
    // try to find a match that's deeper in the document
    if ((bestMatch[1] - bestMatch[0]) <= 2 && bestMatch[0] < 200) {
      for (const match of indices) {
        if (match[0] > 200) { // Skip document header area
          bestMatch = match;
          break;
        }
      }
    }

    const matchStart = bestMatch[0];
    const matchEnd = bestMatch[1];

    // Calculate context boundaries - center around the match
    const halfContext = Math.floor(contextLength / 2);
    const contextStart = Math.max(0, matchStart - halfContext);
    const contextEnd = Math.min(text.length, matchEnd + halfContext);

    // Extract the context
    let context = text.substring(contextStart, contextEnd);

    // Add ellipsis if we're not at the beginning/end
    if (contextStart > 0) {
      context = '...' + context;
    }
    if (contextEnd < text.length) {
      context = context + '...';
    }

    return context;
  }

  async refresh(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to refresh search engine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  getIndexedDocumentCount(): number {
    return this.searchIndices.length;
  }
}