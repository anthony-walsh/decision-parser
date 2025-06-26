# Absurd-SQL Migration Implementation Plan

## CONTEXT & OVERVIEW
This plan migrates the PDF document processing application from Dexie.js/IndexedDB to a hybrid architecture using absurd-sql (SQLite in browser) for hot storage and encrypted static JSON files for cold storage. The application processes UK Planning Appeal documents and requires strong security for sensitive legal content.

## CURRENT SYSTEM ANALYSIS
- **Current Storage**: Dexie.js with simple schema (documents, searchIndex, searchHistory, savedSearches)
- **PDF Processing**: Web Worker (`src/workers/pdfProcessor.ts`) extracts text using PDF.js
- **Search**: Fuzzysort-based fuzzy search with configurable thresholds
- **Target Scale**: 100,000 documents averaging 200KB each (~20GB total)
- **Browser Storage Limits**: 2-6GB maximum, current approach won't scale

## NEW ARCHITECTURE REQUIREMENTS

### Authentication System
- **Type**: Challenge-response authentication (no server dependency)
- **Setup**: Password setup on first app load
- **Verification**: Decrypt challenge to verify password
- **Recovery**: Password reset clears all data
- **Worker Integration**: Message-based auth protocol between main thread and workers

### Storage Tiers
- **Hot Storage**: SQLite FTS5 in Web Worker, 5,000 recent documents (~1GB)
- **Cold Storage**: Encrypted JSON batches in `/public/cold-storage/`, 95,000+ archived documents
- **Migration**: Automatic hot→cold based on age (90+ days) and access patterns

### Security Requirements
- **Encryption**: AES-GCM-256 with PBKDF2 key derivation (600,000 iterations)
- **Cold Storage**: All batches encrypted, unreadable without password
- **Key Management**: User password derives encryption key, no passwords stored
- **Memory Safety**: Secure cleanup of decrypted data

### Search Experience
- **Hot Results**: Instant (<100ms) with full SQLite FTS5 features
- **Cold Results**: Progressive loading (500-2000ms) with clear indicators
- **UX**: Show "Recent" vs "Archived" result badges
- **Fallback**: Error messages with retry for cold storage failures

## TECHNICAL SPECIFICATIONS

### Worker Architecture
```javascript
// Two separate workers
- hotStorageWorker.ts: SQLite FTS5 operations, recent documents
- coldStorageWorker.ts: Encrypted batch processing, archive search
- Main thread: Authentication, UI state, worker coordination

// Authentication flow
1. Main thread verifies password via challenge-response
2. Export key material to workers via postMessage
3. Workers import key for encryption/decryption operations
```

### Storage Schema
```sql
-- Hot Storage (SQLite)
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  filename TEXT,
  size INTEGER,
  upload_date TEXT,
  processing_status TEXT,
  metadata TEXT, -- JSON blob
  page_count INTEGER,
  last_accessed TEXT,
  access_count INTEGER
);

CREATE TABLE search_index (
  doc_id TEXT PRIMARY KEY,
  content TEXT,
  metadata TEXT
);

CREATE VIRTUAL TABLE content_fts USING fts5(
  doc_id,
  content,
  tokenize='porter ascii'
);
```

### Cold Storage Structure
```json
// /public/cold-storage/storage-index.json
{
  "totalDocuments": 95000,
  "batches": [
    {
      "batchId": "001",
      "url": "/cold-storage/documents-batch-001.json",
      "documentCount": 1000,
      "dateRange": {"start": "2024-01-01", "end": "2024-01-31"},
      "keywords": ["planning", "appeal", "council"],
      "size": "15MB"
    }
  ]
}

// /public/cold-storage/documents-batch-001.json
{
  "version": "1.0",
  "algorithm": "AES-GCM",
  "iv": "base64-encoded-iv",
  "data": "base64-encoded-encrypted-content",
  "checksum": "sha256-hash",
  "metadata": {
    "batchId": "001",
    "documentCount": 1000,
    "size": 15728640
  }
}
```

### Vue Store Refactoring
```javascript
// store/modules/documents.js - New structure
state: {
  hotStorage: {
    documents: [],
    isLoading: false,
    lastUpdated: null
  },
  coldStorage: {
    batches: [],
    isLoading: false,
    error: null
  },
  authentication: {
    isAuthenticated: false,
    isInitialized: false,
    hasChallenge: false
  }
}

// store/modules/search.js - New structure  
state: {
  query: '',
  results: {
    hot: [],
    cold: [],
    isHotComplete: false,
    isColdComplete: false,
    isLoading: false
  }
}
```

## IMPLEMENTATION PHASES

### Phase 1: Foundation & Authentication (2-3 weeks)
**Deliverables:**
- Set up absurd-sql in dual worker architecture
- Implement challenge-response authentication system
- Build encryption infrastructure with AES-GCM-256
- Create message-based auth protocol for workers

**Key Files to Create/Modify:**
- `src/services/AuthenticationService.js` - Challenge-response implementation
- `src/workers/hotStorageWorker.ts` - SQLite FTS5 operations
- `src/workers/coldStorageWorker.ts` - Encrypted batch processing
- `src/services/EncryptionService.js` - AES-GCM encryption utilities

### Phase 2: Hot Storage with SQLite FTS5 (2-3 weeks)
**Deliverables:**
- Replace Dexie with SQLite in hot storage worker
- Implement FTS5 with Porter stemming and advanced search
- Integrate with existing PDF processor workflow
- Optimize for <100ms search response times

**Key Files to Create/Modify:**
- `src/workers/hotStorageWorker.ts` - Complete SQLite implementation
- `src/services/HotStorageService.js` - Main thread interface
- Modify `src/workers/pdfProcessor.ts` - Route to hot storage

### Phase 3: Encrypted Cold Storage System (2-3 weeks)
**Deliverables:**
- Implement encrypted batch structure and processing
- Build cold storage worker with batch fetching/decryption
- Create progressive search with memory management
- Implement 100MB batch cache with LRU eviction

**Key Files to Create/Modify:**
- `src/workers/coldStorageWorker.ts` - Batch processing and search
- `src/services/ColdStorageService.js` - Main thread interface
- `public/cold-storage/storage-index.json` - Batch metadata
- Admin tool (separate project) for batch creation

### Phase 4: Document Lifecycle Management (2-3 weeks)
**Deliverables:**
- Automatic hot-to-cold migration based on age/access
- Document tier management with 5,000 hot storage limit
- Migration status tracking and user notifications
- Background process for tier management

**Key Files to Create/Modify:**
- `src/services/DocumentTierManager.js` - Migration logic
- `src/workers/migrationWorker.ts` - Background migration
- Update Vue store for migration status tracking

### Phase 5: Refactored Vue Store & Search UX (2-3 weeks)
**Deliverables:**
- Refactor Vuex store for hot/cold tier separation
- Enhanced search UI with progressive loading
- Authentication UI integration
- Clear visual distinction between recent/archived results

**Key Files to Create/Modify:**
- `src/store/modules/documents.js` - Refactored store structure
- `src/store/modules/search.js` - Hot/cold search state management
- `src/views/UnifiedSearchView.vue` - Enhanced search interface
- `src/components/AuthenticationSetup.vue` - Password setup UI
- `src/components/SearchResultCard.vue` - Result tier indicators

### Phase 6: Performance & Resource Management (1-2 weeks)
**Deliverables:**
- Memory management optimization for cold storage operations
- Browser resource management (wake locks, visibility handling)
- Performance monitoring and automatic cleanup
- User-facing performance indicators

**Key Files to Create/Modify:**
- `src/services/MemoryManager.js` - Memory monitoring and cleanup
- `src/services/PerformanceMonitor.js` - Performance tracking
- `src/utils/BrowserResourceManager.js` - Wake locks and visibility

### Phase 7: Build Configuration & Deployment (1-2 weeks)
**Deliverables:**
- Vite configuration for SQLite WASM files
- Static asset management for encrypted batches
- Worker loading configuration
- Production build optimization

**Key Files to Create/Modify:**
- `vite.config.js` - WASM and worker configuration
- `public/sql-wasm/` directory - SQLite WASM files
- `public/cold-storage/` directory - Encrypted batch storage

### Phase 8: Testing & Validation (2-3 weeks)
**Deliverables:**
- Authentication system testing and edge cases
- Scale testing with 100,000+ documents
- Memory usage validation during heavy operations
- Browser compatibility testing

**Key Files to Create/Modify:**
- `tests/unit/authentication.test.js` - Auth system tests
- `tests/integration/storage.test.js` - Storage tier tests
- `tests/performance/` directory - Performance test suite

## SUCCESS CRITERIA
- **Scale**: Handle 100,000+ documents efficiently across tiers
- **Security**: All cold storage encrypted, unreadable without password  
- **Performance**: <100ms hot search, <2s cold search for relevant batches
- **UX**: Seamless progressive search with clear tier indicators
- **Memory**: Stable operation under 400MB peak usage
- **Authentication**: Secure offline password system with reset capability

## CRITICAL IMPLEMENTATION NOTES

### Authentication Security
- Never store plaintext passwords or derived keys in localStorage
- Use challenge-response verification via successful decryption
- Clear sensitive data from memory after operations
- Implement secure key export/import between main thread and workers

### Memory Management
- Limit concurrent batch decryption to 3 batches maximum
- Implement automatic cleanup of decrypted data
- Monitor memory usage and force cleanup at 200MB threshold
- Use wake locks during heavy operations to prevent tab killing

### Search Performance
- Hot storage must respond in <100ms for good UX
- Cold storage should show progress indicators during batch processing
- Implement batch relevance scoring to avoid downloading irrelevant data
- Clear visual distinction between hot and cold results

### Error Handling
- Graceful degradation when cold storage is unavailable
- Retry mechanisms for network failures
- Clear error messages for authentication failures
- Fallback to hot-only search when cold storage fails

## ADMIN TOOL REQUIREMENTS
The admin tool (separate from main application) must:
- Process large document collections into encrypted batches
- Generate storage-index.json with batch metadata
- Upload encrypted batches to `/public/cold-storage/`
- Optimize batch organization for search performance
- Handle batch versioning and updates

This plan provides a complete roadmap for migrating to the hybrid SQLite + encrypted cold storage architecture while maintaining security, performance, and user experience requirements.