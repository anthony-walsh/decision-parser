/**
 * Search History Service - localStorage-based replacement for Dexie search history
 * 
 * Provides lightweight search history management without external dependencies.
 * Uses localStorage for persistence across browser sessions.
 * 
 * AIDEV-NOTE: Created as part of Dexie.js migration - replaces database-based search history
 */

import type { SearchHistory, SavedSearch } from '@/types';

const SEARCH_HISTORY_KEY = 'decision_parser_search_history';
const SAVED_SEARCHES_KEY = 'decision_parser_saved_searches';
const MAX_HISTORY_ITEMS = 50;
const MAX_SAVED_SEARCHES = 20;

export class SearchHistoryService {
  private static instance: SearchHistoryService | null = null;
  
  // Singleton pattern for consistent usage
  static getInstance(): SearchHistoryService {
    if (!SearchHistoryService.instance) {
      SearchHistoryService.instance = new SearchHistoryService();
    }
    return SearchHistoryService.instance;
  }

  /**
   * Add a search query to history
   * AIDEV-NOTE: Replaces db.addSearchHistory() from Dexie implementation
   */
  async addSearchHistory(query: string, resultCount: number): Promise<void> {
    try {
      const history = await this.getSearchHistory();
      
      // Remove existing entry for this query (avoid duplicates)
      const filteredHistory = history.filter(item => item.query !== query);
      
      // Add new entry at the beginning
      const newEntry: SearchHistory = {
        id: `search_${Date.now()}_${Math.random()}`,
        query: query.trim(),
        timestamp: new Date(),
        resultCount
      };
      
      filteredHistory.unshift(newEntry);
      
      // Keep only the most recent entries
      const trimmedHistory = filteredHistory.slice(0, MAX_HISTORY_ITEMS);
      
      // Save to localStorage
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmedHistory));
      
    } catch (error) {
      console.warn('Failed to add search history:', error);
      // Don't throw - search history is not critical functionality
    }
  }

  /**
   * Get search history sorted by most recent
   * AIDEV-NOTE: Replaces db.getSearchHistory() from Dexie implementation
   */
  async getSearchHistory(): Promise<SearchHistory[]> {
    try {
      const historyJson = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!historyJson) {
        return [];
      }
      
      const history = JSON.parse(historyJson);
      
      // Ensure data integrity and convert date strings back to Date objects
      return history
        .filter((item: any) => item && item.query && item.timestamp)
        .map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
        .sort((a: SearchHistory, b: SearchHistory) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        );
        
    } catch (error) {
      console.warn('Failed to load search history:', error);
      return [];
    }
  }

  /**
   * Clean up duplicate search history entries
   * AIDEV-NOTE: Replaces db.cleanupDuplicateSearchHistory() from Dexie implementation
   */
  async cleanupDuplicateSearchHistory(): Promise<void> {
    try {
      const history = await this.getSearchHistory();
      const seen = new Set<string>();
      const uniqueHistory: SearchHistory[] = [];
      
      for (const item of history) {
        if (!seen.has(item.query.toLowerCase())) {
          seen.add(item.query.toLowerCase());
          uniqueHistory.push(item);
        }
      }
      
      if (uniqueHistory.length !== history.length) {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(uniqueHistory));
      }
      
    } catch (error) {
      console.warn('Failed to cleanup search history:', error);
    }
  }

  /**
   * Clear all search history
   */
  async clearSearchHistory(): Promise<void> {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.warn('Failed to clear search history:', error);
    }
  }

  /**
   * Get saved searches
   * AIDEV-NOTE: Replaces db.getSavedSearches() from Dexie implementation
   */
  async getSavedSearches(): Promise<SavedSearch[]> {
    try {
      const savedJson = localStorage.getItem(SAVED_SEARCHES_KEY);
      if (!savedJson) {
        return [];
      }
      
      const saved = JSON.parse(savedJson);
      
      // Ensure data integrity and convert date strings back to Date objects
      return saved
        .filter((item: any) => item && item.query && item.name)
        .map((item: any) => ({
          ...item,
          createdDate: new Date(item.createdDate)
        }))
        .sort((a: SavedSearch, b: SavedSearch) => 
          b.createdDate.getTime() - a.createdDate.getTime()
        );
        
    } catch (error) {
      console.warn('Failed to load saved searches:', error);
      return [];
    }
  }

  /**
   * Save a search query for future use
   */
  async saveSearch(name: string, query: string): Promise<void> {
    try {
      const saved = await this.getSavedSearches();
      
      // Remove existing entry with same name (avoid duplicates)
      const filteredSaved = saved.filter(item => item.name !== name);
      
      // Add new entry
      const newEntry: SavedSearch = {
        id: `saved_${Date.now()}_${Math.random()}`,
        name: name.trim(),
        query: query.trim(),
        createdDate: new Date()
      };
      
      filteredSaved.unshift(newEntry);
      
      // Keep only the most recent entries
      const trimmedSaved = filteredSaved.slice(0, MAX_SAVED_SEARCHES);
      
      // Save to localStorage
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(trimmedSaved));
      
    } catch (error) {
      console.warn('Failed to save search:', error);
      throw new Error('Failed to save search query');
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(id: string): Promise<void> {
    try {
      const saved = await this.getSavedSearches();
      const filtered = saved.filter(item => item.id !== id);
      
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(filtered));
      
    } catch (error) {
      console.warn('Failed to delete saved search:', error);
      throw new Error('Failed to delete saved search');
    }
  }

  /**
   * Clear all saved searches
   */
  async clearSavedSearches(): Promise<void> {
    try {
      localStorage.removeItem(SAVED_SEARCHES_KEY);
    } catch (error) {
      console.warn('Failed to clear saved searches:', error);
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): { searchHistoryCount: number; savedSearchesCount: number; storageUsed: number } {
    try {
      const historyJson = localStorage.getItem(SEARCH_HISTORY_KEY) || '[]';
      const savedJson = localStorage.getItem(SAVED_SEARCHES_KEY) || '[]';
      
      const historyCount = JSON.parse(historyJson).length;
      const savedCount = JSON.parse(savedJson).length;
      const storageUsed = (historyJson.length + savedJson.length) * 2; // Approximate bytes (UTF-16)
      
      return {
        searchHistoryCount: historyCount,
        savedSearchesCount: savedCount,
        storageUsed
      };
    } catch (error) {
      console.warn('Failed to get storage stats:', error);
      return {
        searchHistoryCount: 0,
        savedSearchesCount: 0,
        storageUsed: 0
      };
    }
  }
}

// Export singleton instance for consistent usage
export const searchHistoryService = SearchHistoryService.getInstance();