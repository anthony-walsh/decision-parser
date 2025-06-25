import Dexie, { type EntityTable } from 'dexie';
import type { Document, SearchIndex, SearchHistory, SavedSearch } from '@/types';

export class PDFSearchDatabase extends Dexie {
  documents!: EntityTable<Document, 'id'>;
  searchIndex!: EntityTable<SearchIndex, 'docId'>;
  searchHistory!: EntityTable<SearchHistory, 'id'>;
  savedSearches!: EntityTable<SavedSearch, 'id'>;

  constructor() {
    super('PDFSearchDatabase');
    
    // AIDEV-NOTE: Updated schema to include planning appeal metadata fields for indexing
    this.version(1).stores({
      documents: 'id, filename, uploadDate, processingStatus',
      searchIndex: 'docId, content',
      searchHistory: 'id, timestamp, query',
      savedSearches: 'id, name, createdDate'
    });
    
    // AIDEV-NOTE: Future version with metadata indexing (uncomment when needed)
    // this.version(2).stores({
    //   documents: 'id, filename, uploadDate, processingStatus, metadata.appealReferenceNumber, metadata.lpa, metadata.decisionOutcome',
    //   searchIndex: 'docId, content, metadata.appealReferenceNumber, metadata.lpa, metadata.inspector',
    //   searchHistory: 'id, timestamp, query',
    //   savedSearches: 'id, name, createdDate'
    // });
  }

  async addDocument(document: Document): Promise<void> {
    await this.documents.put(document);
  }

  async addSearchIndex(searchIndex: SearchIndex): Promise<void> {
    await this.searchIndex.put(searchIndex);
  }

  async getAllDocuments(): Promise<Document[]> {
    return await this.documents.orderBy('uploadDate').reverse().toArray();
  }

  async getAllSearchIndices(): Promise<SearchIndex[]> {
    return await this.searchIndex.toArray();
  }

  async deleteDocument(docId: string): Promise<void> {
    await this.transaction('rw', [this.documents, this.searchIndex], async () => {
      await this.documents.delete(docId);
      await this.searchIndex.delete(docId);
    });
  }

  async addSearchHistory(query: string, resultCount: number): Promise<void> {
    // AIDEV-NOTE: Check for existing search history entry to prevent duplicates
    const existingHistory = await this.searchHistory
      .where('query')
      .equals(query)
      .first();
    
    if (existingHistory) {
      // Update existing entry with new timestamp and result count
      await this.searchHistory.update(existingHistory.id, {
        timestamp: new Date(),
        resultCount
      });
    } else {
      // Add new search history entry
      const history: SearchHistory = {
        id: `hist_${Date.now()}`,
        query,
        timestamp: new Date(),
        resultCount
      };
      
      await this.searchHistory.add(history);
    }
    
    // Keep only last 100 searches
    const count = await this.searchHistory.count();
    if (count > 100) {
      const oldest = await this.searchHistory.orderBy('timestamp').limit(count - 100).toArray();
      await this.searchHistory.bulkDelete(oldest.map(h => h.id));
    }
  }

  async getSearchHistory(): Promise<SearchHistory[]> {
    // AIDEV-NOTE: Get unique search history entries by filtering duplicates
    const allHistory = await this.searchHistory.orderBy('timestamp').reverse().toArray();
    
    // Use a Map to keep only the most recent entry for each unique query
    const uniqueHistory = new Map<string, SearchHistory>();
    
    for (const history of allHistory) {
      if (!uniqueHistory.has(history.query)) {
        uniqueHistory.set(history.query, history);
      }
    }
    
    // Convert back to array, sort by timestamp (most recent first), and limit to 20
    return Array.from(uniqueHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);
  }

  async cleanupDuplicateSearchHistory(): Promise<void> {
    // AIDEV-NOTE: Remove duplicate search history entries, keeping only the most recent for each query
    const allHistory = await this.searchHistory.orderBy('timestamp').reverse().toArray();
    
    // Group by query and keep only the most recent
    const queryToKeep = new Map<string, SearchHistory>();
    const idsToDelete: string[] = [];
    
    for (const history of allHistory) {
      if (!queryToKeep.has(history.query)) {
        // Keep the first (most recent) occurrence
        queryToKeep.set(history.query, history);
      } else {
        // Mark older duplicates for deletion
        idsToDelete.push(history.id);
      }
    }
    
    // Delete the duplicate entries
    if (idsToDelete.length > 0) {
      await this.searchHistory.bulkDelete(idsToDelete);
    }
  }

  async addSavedSearch(name: string, query: string): Promise<void> {
    const savedSearch: SavedSearch = {
      id: `saved_${Date.now()}`,
      name,
      query,
      createdDate: new Date()
    };
    
    await this.savedSearches.add(savedSearch);
  }

  async getSavedSearches(): Promise<SavedSearch[]> {
    return await this.savedSearches.orderBy('name').toArray();
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await this.savedSearches.delete(id);
  }

  async clearAllData(): Promise<void> {
    await this.transaction('rw', [this.documents, this.searchIndex, this.searchHistory, this.savedSearches], async () => {
      await this.documents.clear();
      await this.searchIndex.clear();
      await this.searchHistory.clear();
      await this.savedSearches.clear();
    });
  }
}

export const db = new PDFSearchDatabase();