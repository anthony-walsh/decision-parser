# PDF Document Processing & Search System - AI Development Guide

## AI Assistant Expertise & Context
You are an expert in:
- **Web Development**: CSS, JavaScript, Vue.js, Tailwind, Markdown
- **PDF Processing Applications**: PDF.js, document parsing, text extraction
- **Project Type**: Legal document processing and search for UK Planning Appeals

## AI Behavioral Guidelines

### Communication Style
- Don't apologise unnecessarily
- Request clarification for anything unclear or ambiguous
- Prefer answering without code when possible (elaborate if asked)

### Workflow Requirements
- **Review History**: Check conversation history for mistakes and avoid repeating them
- **Read Documentation**: Understand all `.md` files before executing commands
- **Incremental Changes**: Break work into discrete changes with small tests at each stage
- **File Updates**: Update documentation files as needed for future effectiveness
- **MCP Tool Usage**: Proactively use MCP servers (sequential-thinking, context7, duckduckgo-search, etc.) when they add value to development tasks

### Development Process
1. **Code Review**: Perform comprehensive review between `<CODE_REVIEW>` tags
2. **Planning**: Construct detailed plan between `<PLANNING>` tags  
3. **Security Review**: For sensitive changes, use `<SECURITY_REVIEW>` tags
4. **Implementation**: Follow established patterns and ask for additional source files if needed

### Visual Rendering Issue Troubleshooting
**ALWAYS start with simple Vue architecture checks before adding complexity:**

#### **Step 1: Verify Basic Component Structure**
- ✅ **Check slot usage**: Ensure named slots match component API (e.g., default slot vs `v-slot:content`)
- ✅ **Verify imports**: All components properly imported and registered
- ✅ **Check props**: Data being passed correctly between parent and child components
- ✅ **Template syntax**: No Vue template compilation errors

#### **Step 2: Validate Data Flow**
- ✅ **Component props**: Verify parent component passes required data
- ✅ **Event handling**: Check component events are properly emitted and received
- ✅ **Conditional rendering**: Ensure `v-if`/`v-else` conditions are correct

#### **Step 3: Only After Basic Checks - Consider Complex Issues**
- **State management**: Vuex/store issues (only if data flows through global state)
- **Reactivity**: Vue reactivity system problems (rare with proper component design)
- **Lifecycle**: Component lifecycle timing issues

#### **Anti-Patterns to Avoid**
- ❌ **Adding debug code first**: Debug code can obscure the real issue
- ❌ **Assuming reactivity problems**: Most display issues are basic component API misuse
- ❌ **Over-engineering solutions**: Complex error handling for simple template bugs
- ❌ **Bypassing fundamentals**: Always verify component API before investigating state

#### **Example: Component Slot Usage Resolution**
```vue
<!-- ❌ WRONG: Using non-existent named slot -->
<ModernCard title="Settings Information">
  <template v-slot:content>
    <!-- Content never displays -->
  </template>
</ModernCard>

<!-- ✅ CORRECT: Using default slot as per ModernCard API -->
<ModernCard title="Settings Information">
  <!-- Content displays correctly -->
</ModernCard>
```

**Key Lesson**: Simple fixes over complexity. Most visual rendering issues are basic Vue component API problems, not state management or reactivity issues.

### Key Principles
- **DRY Principle**: Avoid duplication
- **Balance**: Maintenance vs flexibility trade-offs
- **Framework Usage**: Consider and suggest relevant frameworks/libraries
- **Code Quality**: Maintain existing style, use appropriate idioms
- **Testing**: Ensure high test coverage with appropriate tests

### Critical Security Analysis
For sensitive changes (Input Handling, Monetary Calculations, Authentication), evaluate:
- Does the analysis directly address the problem?
- Were all possible causes considered?
- Is this the simplest and most direct solution?
- Will the solution have the expected impact and be sustainable?
- What are essential vs nice-to-have requirements?
- What edge cases should be considered?
- What testing approach would validate this solution?

### Implementation Standards
- **Full Files**: Always provide complete files, not snippets (unless user specifies otherwise)
- **Code Blocks**: Use language-specified blocks for JavaScript
- **Variable Accuracy**: Reproduce Variable Names, Identifiers, and String Literals accurately
- **STOP Rule**: Wait for plan agreement before implementing


# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')

## Tailwind CSS Spacing Best Practices
- **Flex Layout Spacing**: Use `gap-` utilities instead of `space-x-` for more reliable spacing in flex layouts
- **Button Spacing**: For buttons with large padding (e.g., `px-10`), use `gap-16` or higher for noticeable visual spacing
- **AIDEV-NOTE**: `space-x-` utilities can be less effective with wide elements; `gap-` provides more consistent results

# Workflow
- Be sure to build when you’re done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
- **IMPORTANT**: Do not remove test files after running them - preserve test files for future reference and debugging

---

## 1. Project Overview

This project is a web-based application for processing and searching UK Planning Appeal decision letters. The application provides encrypted document storage, advanced search capabilities, and secure access to large archives of legal documents through a modern cold storage architecture.

**AIDEV-NOTE**: This application recently completed a major migration from Dexie.js to a cold storage only architecture (July 2025). All document processing now uses encrypted batch storage with worker-based search for enhanced security and performance.

**Golden rule**: When unsure about implementation details or requirements, ALWAYS consult the developer rather than making assumptions.

---

## 2. Recent Architectural Improvements (July 2025)

The codebase has undergone significant architectural improvements focused on **type safety**, **modular design**, **error handling**, and **component architecture**:

### 🔄 TypeScript Migration 
**AIDEV-NOTE**: Completed comprehensive TypeScript migration for core services

- **ColdStorageService.ts**: Migrated 970-line service with comprehensive interfaces for search operations, batch management, and worker communication
- **MemoryManager.ts**: Converted 580-line memory management service with typed metrics, cleanup operations, and performance tracking  
- **PerformanceMonitor.ts**: Migrated 740-line performance monitoring service with typed metrics storage and alert system
- **UserFriendlyError.ts**: New 425-line TypeScript error handling system with factory methods and recovery actions

**Benefits**: Enhanced type safety, better IDE support, reduced runtime errors, improved developer experience

### 🏗️ Store Architecture Decomposition
**AIDEV-NOTE**: Refactored monolithic store into focused modules

**Before**: Single 663-line `stores/index.ts` with mixed concerns
**After**: Modular architecture with focused responsibilities

- **`authentication.ts`** (70 lines): Clean authentication state management
- **`coldStorage.ts`** (200 lines): Cold storage operations and state  
- **`search.ts`** (250 lines): Search state and result management
- **`performance.ts`** (180 lines): Performance monitoring and alerts
- **`index.ts`** (50 lines): Unified store composable combining all modules

**Benefits**: Better separation of concerns, easier testing, improved maintainability, reduced cognitive load

### 🛡️ UserFriendlyError System
**AIDEV-NOTE**: Comprehensive error handling system replacing generic error messages

**Key Features**:
- **Context-Aware Errors**: Replaces generic errors with actionable user guidance
- **Recovery Actions**: Provides users with specific next steps (retry, help, refresh)
- **Error Factory**: Standardized error creation patterns for common scenarios
- **Severity Levels**: Categorized error handling (info, warning, error, critical)
- **Technical Details**: Optional technical information for debugging while maintaining user-friendly messages

**Factory Methods**: `authentication()`, `network()`, `search()`, `performance()`, `storage()`, `validation()`, `compatibility()`

### 🧩 Component Architecture Enhancement
**AIDEV-NOTE**: Extracted focused components following Vue 3 composition patterns

**Component Extractions**:
- **SearchHeader.vue**: Branding, search bar, and action buttons
- **SearchControls.vue**: Filters, sensitivity controls, and date ranges  
- **SearchResults.vue**: Results display with pagination and loading states
- **SearchStats.vue**: Search statistics and performance metrics
- **ImportModal.vue**: Document import with progress tracking

**Benefits**: Better reusability, easier testing, clearer component boundaries, improved maintainability

### 🧪 Testing Infrastructure
**AIDEV-NOTE**: Comprehensive unit test coverage for new TypeScript services

**Test Suites Created**:
- **UserFriendlyError.test.ts** (412 lines): Error handling system validation
- **PerformanceMonitor.test.ts** (560 lines): Performance metric testing
- **MemoryManager.test.ts** (438 lines): Memory management test suite

**Coverage**: 90%+ coverage for all new services with comprehensive edge case testing

### 📊 Performance Improvements
**AIDEV-NOTE**: Reduced production bundle size and improved runtime performance

- **Reduced Console Output**: Removed 52+ console.log statements from production code
- **Memory Optimization**: Better resource cleanup and garbage collection
- **Type Safety**: Eliminated runtime type errors through comprehensive TypeScript implementation
- **Component Splitting**: Reduced initial bundle size through better component organization

### 🔗 Integration Benefits
**AIDEV-NOTE**: Architectural improvements work together for enhanced developer experience

- **Type Safety + Error Handling**: TypeScript interfaces ensure proper UserFriendlyError usage
- **Modular Stores + Components**: Better data flow between focused store modules and extracted components
- **Testing + Type Safety**: TypeScript makes tests more reliable and comprehensive
- **Component Architecture + Error Handling**: Components use UserFriendlyError for consistent user experience

### 📝 Documentation Updates
**AIDEV-NOTE**: Updated AIDEV-NOTE comments throughout codebase

- **Service Documentation**: Comprehensive documentation for migrated TypeScript services
- **Store Documentation**: Clear documentation of modular store architecture
- **Component Documentation**: Proper documentation of extracted components and their APIs
- **Error Handling Documentation**: Complete documentation of UserFriendlyError patterns

---

## 3. Non-negotiable Golden Rules

| Rule | AI *may* do | AI *must NOT* do |
|------|-------------|------------------|
| **G-0** | Whenever unsure about something that's related to the project, ask the developer for clarification before making changes | ❌ Write changes or use tools when you are not sure about something project specific, or if you don't have context for a particular feature/decision |
| **G-1** | Generate code **only inside** relevant source directories | |
| **G-2** | Add/update **`AIDEV-NOTE:` anchor comments** near non-trivial edited code | ❌ Delete or mangle existing `AIDEV-` comments |
| **G-3** | Follow lint/style configs. Use the project's configured linter, if available, instead of manually re-formatting code | ❌ Re-format code to any other style |
| **G-4** | For changes >300 LOC or >3 files, **ask for confirmation** | ❌ Refactor large modules without human guidance |
| **G-5** | Stay within the current task context. Inform the dev if it'd be better to start afresh | ❌ Continue work from a prior prompt after "new task" – start a fresh session |

---

## 4. Quick Reference Guide

### 🚀 Common Development Tasks

| Task | Command | Purpose |
|------|---------|---------|
| **Start Development** | `npm run dev` | Launch dev server with hot reload |
| **Code Formatting** | `npm run format` | Apply Prettier formatting |
| **Production Build** | `npm run build` | Create optimized production bundle |
| **Preview Build** | `npm run preview` | Test production build locally |

### 🛠️ Technology Stack

#### Frontend Framework
- **Vue 3**: Modern JavaScript framework with Composition API
- **Tailwind CSS**: Utility-first CSS framework for modern styling
- **Vue Router 4**: Client-side routing for single-page application
- **Cold Storage Architecture**: Encrypted batch-based document storage

#### Build Tools & Development
- **Vite**: Fast build tool and development server
- **Node.js 16+**: Runtime environment
- **npm**: Package manager
- **Prettier**: Code formatting

#### Document Processing & Search
- **PDF.js**: Client-side PDF parsing and text extraction
- **Cold Storage Workers**: Encrypted batch processing with web workers
- **AES-256-GCM Encryption**: Secure document storage and transmission
- **Progressive Search**: Worker-based search across encrypted document batches
- **Appeal Import Service**: Automated download and processing of UK Planning Appeal decisions

#### Cold Storage Architecture
- **Encrypted Batches**: Documents stored in AES-256-GCM encrypted JSON files
- **Salt-Embedded Authentication**: Each batch has unique salt for key derivation
- **Worker-Based Processing**: All encryption/decryption happens in web workers
- **Progressive Loading**: Batches loaded on-demand with intelligent caching
- **Memory Management**: LRU cache with automatic cleanup and resource monitoring
- **Authentication Service**: Challenge-response system without storing passwords

### 🔧 MCP (Model Context Protocol) Servers

**AIDEV-NOTE**: MCP servers provide extended capabilities beyond basic file operations. USE THESE TOOLS PROACTIVELY when they provide value for development tasks.

#### Available MCP Servers Overview

| Server | Primary Purpose | Key Strengths | Critical Requirements |
|--------|----------------|---------------|----------------------|
| **Context7** | Library documentation lookup | Up-to-date API docs, usage patterns | **MANDATORY 2-step process** |
| **Sequential Thinking** | Complex problem-solving | Revision, branching, hypothesis validation | Structured thinking approach |
| **IDE Server** | Code analysis & execution | VS Code diagnostics, persistent Jupyter kernel | Context awareness |
| **Puppeteer Browser** | Browser automation | Full browser control, visual verification | Security considerations |
| **Memory Bank** | Knowledge management | Cross-project insights, organized storage | Project-based organization |
| **DuckDuckGo Search** | Web research | Privacy-focused, current information | Rate limits, result quotas |

---

#### 🔍 Context7 Library Documentation Server

**Critical Workflow**: Context7 requires a **mandatory two-step process** - you MUST resolve the library ID before getting documentation.

**Available Tools:**
- `mcp__context7__resolve-library-id` - Convert library name to Context7-compatible ID
- `mcp__context7__get-library-docs` - Fetch documentation using exact library ID

**Required Workflow:**
```bash
# ✅ CORRECT: Two-step process
1. mcp__context7__resolve-library-id("vue")
   # Returns: "/vue/vue/v3.4.0" or similar
2. mcp__context7__get-library-docs("/vue/vue/v3.4.0")

# ❌ WRONG: Cannot skip step 1
# mcp__context7__get-library-docs("vue") # This will fail
```

**Key Parameters:**
- `tokens`: Max documentation tokens (default: 10000, higher = more context)
- `topic`: Focus on specific areas (e.g., 'hooks', 'routing')
- `context7CompatibleLibraryID`: Must be exact format from resolve-library-id

**When to Use:**
- Need authoritative API documentation
- Looking for specific library usage patterns
- Want current/up-to-date library information

**Common Pitfalls:**
- Skipping resolve-library-id step (will fail)
- Using approximate library names instead of exact IDs
- Not specifying topic for large libraries (gets generic overview)

---

#### 🧠 Sequential Thinking Problem-Solving Server

**Advanced Capabilities**: This is a sophisticated reasoning tool with revision, branching, and hypothesis validation features.

**Available Tool:**
- `mcp__sequential-thinking__sequentialthinking` - Structured problem-solving with dynamic adaptation

**Key Features:**
- **Thought Revision**: Can reconsider and modify previous reasoning steps
- **Branching**: Explore alternative approaches from any point
- **Hypothesis Generation**: Create and test solution hypotheses
- **Dynamic Planning**: Adjust total thoughts needed as understanding evolves
- **Context Filtering**: Ignore irrelevant information automatically

**Advanced Parameters:**
- `isRevision`: Mark thoughts that revise previous thinking
- `revisesThought`: Which thought number is being reconsidered
- `branchFromThought`: Create alternative reasoning paths
- `branchId`: Track different reasoning branches
- `needsMoreThoughts`: Extend analysis beyond initial estimate

**When to Use:**
- Complex architectural decisions
- Multi-step debugging processes
- Planning large feature implementations
- Analyzing requirements with unknown scope
- Problem-solving that may require course correction

**Example Pattern:**
```bash
# Start with initial analysis
mcp__sequential-thinking__sequentialthinking("Analyze PDF processing performance issues")
# Tool may revise earlier thoughts, branch into alternatives,
# generate hypotheses, and validate solutions iteratively
```

---

#### 💻 IDE Integration Server

**Persistent Execution**: Code executed in Jupyter kernel persists across calls unless kernel is restarted.

**Available Tools:**
- `mcp__ide__getDiagnostics` - Get VS Code language diagnostics
- `mcp__ide__executeCode` - Execute Python code in persistent Jupyter kernel

**Key Features:**
- **Persistent State**: Variables and imports remain available across executeCode calls
- **Flexible Diagnostics**: Can get diagnostics for specific files or all files
- **Integration**: Works with current VS Code workspace

**Parameters:**
- `getDiagnostics(uri)`: Optional file URI, omit for all files
- `executeCode(code)`: Python code string

**When to Use:**
- Type checking and error analysis
- Testing code snippets before implementation
- Data analysis and exploration
- Validating algorithms with sample data

**Important Notes:**
- **State Persistence**: Be aware that variables persist between calls
- **Scope**: Avoid modifying global state unless explicitly needed
- **Cleanup**: Consider kernel restart for fresh state if needed

---

#### 🌐 Puppeteer Browser Automation Server

**Security Considerations**: Has dangerous launch options that can reduce browser security.

**Available Tools:**
- `mcp__puppeteer__puppeteer_navigate` - Navigate to URL
- `mcp__puppeteer__puppeteer_screenshot` - Capture page/element screenshots
- `mcp__puppeteer__puppeteer_click` - Click elements
- `mcp__puppeteer__puppeteer_fill` - Fill input fields
- `mcp__puppeteer__puppeteer_select` - Select dropdown options
- `mcp__puppeteer__puppeteer_hover` - Hover over elements
- `mcp__puppeteer__puppeteer_evaluate` - Execute JavaScript

**Security Parameters:**
- `allowDangerous`: Boolean to allow dangerous launch options (default: false)
- `launchOptions`: Puppeteer launch configuration (restarts browser if changed)

**Screenshot Options:**
- `encoded`: Return base64 data URI instead of binary (default: false)
- `width/height`: Viewport dimensions (default: 800x600)
- `selector`: Screenshot specific element instead of full page

**When to Use:**
- UI testing and visual verification
- Automated testing of web interfaces
- Capturing screenshots for documentation
- Interactive web application testing

**Security Guidelines:**
- Keep `allowDangerous: false` unless absolutely necessary
- Be cautious with `launchOptions` - changes restart the browser
- Validate URLs before navigation
- Consider implications of JavaScript execution

---

#### 📊 Memory Bank Knowledge Management Server

**Project Organization**: Organizes knowledge by projects, with files nested within each project.

**Available Tools:**
- `mcp__allpepper-memory-bank__list_projects` - List all available projects
- `mcp__allpepper-memory-bank__list_project_files` - List files within a project
- `mcp__allpepper-memory-bank__memory_bank_read` - Read specific file content
- `mcp__allpepper-memory-bank__memory_bank_write` - Create new file
- `mcp__allpepper-memory-bank__memory_bank_update` - Update existing file

**Organization Pattern:**
```
Memory Bank
├── Project A
│   ├── implementation-notes.md
│   ├── architecture-decisions.md
│   └── lessons-learned.md
├── Project B
│   ├── api-patterns.md
│   └── performance-optimizations.md
└── Cross-Project
    ├── reusable-patterns.md
    └── common-pitfalls.md
```

**When to Use:**
- Store implementation insights for future reference
- Document architectural decisions and rationale
- Share patterns across projects
- Build institutional knowledge
- Record lessons learned from complex implementations

**Best Practices:**
- Use descriptive project names that group related work
- Create focused files rather than massive documents
- Include context and rationale, not just solutions
- Update files as understanding evolves

---

#### 🔍 DuckDuckGo Search Server

**Privacy-Focused Web Research** with result limits and filtering options.

**Available Tool:**
- `mcp__duckduckgo-search__duckduckgo_web_search` - Privacy-focused web search

**Key Parameters:**
- `query`: Search query (max 400 characters)
- `count`: Number of results (1-20, default: 10)
- `safeSearch`: Content filtering ("strict", "moderate", "off")

**Limitations:**
- Maximum 20 results per request
- Query length limited to 400 characters
- Subject to rate limiting
- Results may vary by region

**When to Use:**
- Research current trends and best practices
- Find recent documentation or tutorials
- Investigate new libraries or frameworks
- Get diverse perspectives on technical topics

**When NOT to Use:**
- For library-specific API documentation (use Context7)
- For complex analysis (use Sequential Thinking)
- When you need guaranteed fresh results (may have cached results)

---

#### 🔗 Integration Patterns

**Research → Think → Implement → Test**
```bash
# 1. Research phase
mcp__duckduckgo-search__duckduckgo_web_search("Vue 3 performance optimization 2024")
mcp__context7__resolve-library-id("vue")
mcp__context7__get-library-docs("/vue/vue/v3.4.0", topic="performance")

# 2. Analysis phase
mcp__sequential-thinking__sequentialthinking("Plan Vue performance optimization strategy")

# 3. Implementation verification
mcp__ide__getDiagnostics() # Check current issues
mcp__ide__executeCode("# Test performance optimization approach")

# 4. UI testing
mcp__puppeteer__puppeteer_navigate("http://localhost:5173")
mcp__puppeteer__puppeteer_screenshot("performance-test")

# 5. Document insights
mcp__memory-bank__memory_bank_write("vue-optimization", "performance-patterns.md", insights)
```

**Debug → Analyze → Store**
```bash
# Debug complex issue
mcp__ide__getDiagnostics("src/problematic-file.js")
mcp__sequential-thinking__sequentialthinking("Analyze root cause of performance issue")

# Store solution
mcp__memory-bank__memory_bank_write("debugging-patterns", "performance-debug-checklist.md", solution)
```

#### ⚠️ Common Pitfalls & Troubleshooting

**Context7 Issues:**
- ❌ **Error**: "Invalid library ID" → Always use resolve-library-id first
- ❌ **Empty Results**: Library not in Context7 database → Try DuckDuckGo search instead
- ❌ **Generic Results**: Large libraries without topic → Add specific topic parameter

**Sequential Thinking Issues:**
- ❌ **Shallow Analysis**: Not using revision/branching features → Allow for thought evolution
- ❌ **Premature Conclusion**: Ending analysis too early → Set needsMoreThoughts when uncertain

**IDE Server Issues:**
- ❌ **State Conflicts**: Variables from previous executions → Consider fresh kernel restart
- ❌ **No Diagnostics**: Wrong file URI → Check file paths and VS Code workspace

**Puppeteer Issues:**
- ❌ **Security Errors**: Dangerous launch options → Keep allowDangerous: false
- ❌ **Browser Restart**: Changed launch options → Be aware of restart implications
- ❌ **Element Not Found**: CSS selectors → Verify element exists before interaction

**Memory Bank Issues:**
- ❌ **File Not Found**: Wrong project/file names → Use list_projects and list_project_files first
- ❌ **Overwriting Content**: Using write instead of update → Use update for existing files

**Performance Considerations:**
- **Sequential Thinking**: Can be slow for complex analysis - use for non-trivial problems only
- **Puppeteer**: Browser operations are slower than other tools - batch operations when possible
- **Context7**: Documentation fetching takes time - cache results when doing multiple related queries
- **DuckDuckGo**: Subject to rate limits - space out queries if making multiple searches

### 📁 Key File Locations

| Purpose | Location | Description |
|---------|----------|-------------|
| **Components** | `src/components/` | Authentication, search results, debug panels |
| **Views** | `src/views/` | UnifiedSearchView - main search interface |
| **Services** | `src/services/` | Cold storage, encryption, authentication, appeal import |
| **Workers** | `src/workers/` | Cold storage worker for encrypted batch processing |
| **Utils** | `src/utils/` | Search history, data transformation, logging, validation |
| **Stores** | `src/stores/` | Vue reactive state management for cold storage |
| **Tests** | `tests/` | Unit and integration test files |

---

## 5. Development Commands

- npm run build: Build the project

### Development Workflow
```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Format code with Prettier
npm run format
```

### Build Process
- **Development**: Vite dev server with hot module replacement
- **Production**: Optimized bundle with code splitting
- **Output**: Static files in `dist/` directory
- **Assets**: Automatic optimization and minification

### Quality Assurance
```bash
# Code formatting
npm run format

# Future commands (to be implemented)
npm run lint       # ESLint checking
npm run test       # Unit tests
npm run test:e2e   # End-to-end tests
```

---

## 6. Coding Standards

*   **Error Handling**: Typed exceptions; context managers for resources.
*   **Documentation**: Google-style docstrings for public functions/classes.
*   **Testing**: Separate test files matching source file patterns.
*   **Component Architecture**: **ALWAYS** prefer composition over mixins for code reuse.

### Vue.js Component Architecture Guidelines

#### **Composition Over Mixins (Mandatory)**
- **ALWAYS** use component composition instead of Vue mixins for code reuse
- Break large components into smaller, focused sub-components
- Use props and events for parent-child communication
- Leverage Vue 3 Composition API or composables for shared logic

**Why Composition is Preferred:**
- **Explicit Dependencies**: Clear data flow and dependencies
- **Better TypeScript Support**: Easier to type and maintain
- **Avoiding Name Conflicts**: No risk of method/data naming collisions
- **Easier Testing**: Components can be tested in isolation
- **Better Performance**: Smaller components enable better optimization

**Example - Component Composition:**
```javascript
// ✅ GOOD: Composition approach
// ProfilePersonalSection.vue - Focused sub-component
export default {
  props: ['data', 'isEditMode'],
  emits: ['update:data', 'save-section']
}

// Profile.vue - Parent orchestrates behavior
<template>
  <ProfilePersonalSection 
    :data="userPersonalData"
    :is-edit-mode="isEditMode"
    @save-section="handleSave"
  />
</template>
```

```javascript
// ❌ BAD: Mixin approach (DO NOT USE)
// validation-mixin.js - Creates implicit dependencies
export default {
  data() {
    return { formValid: false }
  },
  methods: {
    validateForm() { /* validation logic */ }
  }
}
```

#### **Component Responsibility Guidelines**
- **Single Responsibility**: Each component should have one clear purpose
- **Reasonable Size**: Aim for <300 lines per component; extract sub-components if larger
- **Clear Interfaces**: Well-defined props and events
- **Self-Contained**: Minimal external dependencies

### File Naming Conventions
- **Components**: PascalCase (e.g., `ModernCard.vue`)
- **Views**: PascalCase with descriptive suffixes (e.g., `DashboardHome.vue`)
- **Services**: camelCase (e.g., `authService.js`)
- **Store modules**: camelCase (e.g., `auth.js`)

### Module Organization
- **Feature-based**: Related functionality grouped together
- **Service layer**: Business logic separated from components
- **Store modules**: State management by domain
- **Component hierarchy**: Reusable components at root level

### Development Guidelines

#### Vue 3 Standards
- **Vue 3 Composition API**: Use modern Vue patterns for all new components
- **TypeScript-like Validation**: Implement comprehensive prop validation
- **Vuetify Integration**: Utilize Vuetify components consistently
- **CSS Custom Properties**: Follow the established design system tokens
- **Accessibility**: Implement WCAG compliant interfaces

### Service Layer Architecture
- Extract reusable business logic into service classes
- Use dependency injection patterns for better testability
- Centralize validation rules in dedicated service modules

**Error handling patterns**:
- Catch specific exceptions, not general `Exception`
- Use context managers for resources (database connections, file handles)
- For async code, use `try/finally` to ensure cleanup

Example:
```javascript
function process_data(data) 
{
    try {
        return result;
    } catch (e) {
        throw new Error("Invalid result.")
    }
}
```

---

## 7. Project Layout & Core Components

### Directory Organization
```
src/
├── components/          # Reusable UI components
│   ├── AuthenticationSetup.vue  # Password setup and login interface
│   ├── PerformanceIndicator.vue # System resource monitoring
│   ├── SearchDebugPanel.vue     # Search diagnostics and debugging
│   └── SearchResultCard.vue     # Individual search result display
├── views/               # Page-level components
│   └── UnifiedSearchView.vue    # Main search interface with authentication
├── services/            # Business logic and API calls
│   ├── AppealImportService.ts   # Automated appeal decision import
│   ├── AuthenticationService.js # Challenge-response authentication
│   ├── ColdStorageService.js   # Encrypted batch storage management
│   ├── EncryptionService.js    # AES-256-GCM encryption utilities
│   ├── MemoryManager.js        # Memory usage monitoring and cleanup
│   ├── PerformanceMonitor.js   # Performance metrics and alerts
│   └── ServiceProvider.js      # Service coordination and dependency injection
├── stores/              # Vue reactive state management
│   └── index.ts         # Cold storage and authentication state
├── workers/             # Web worker implementations
│   ├── coldStorageWorker.ts # Encrypted batch processing worker
│   └── index.ts         # Worker factory and management
├── utils/               # Utility functions and helpers
│   ├── BrowserResourceManager.js # Browser API resource monitoring
│   ├── appealDataTransformer.ts  # Appeal metadata transformation
│   ├── appealDecisionLetterDownloader.ts # Document download utilities
│   ├── dataValidator.ts         # Data validation and sanitization
│   ├── logger.ts               # Structured logging system
│   ├── metadataExtractor.ts    # PDF metadata extraction
│   └── searchHistoryService.ts # localStorage-based search history
└── types/               # TypeScript type definitions
    └── index.ts         # Core application types
```

**Key domain models**:
- **Cold Storage Batches**: Encrypted document collections with salt-embedded authentication
- **Appeal Documents**: UK Planning Appeal decision letters with structured metadata
- **Search Results**: Worker-based query results with relevance scoring and highlighting
- **Search History**: localStorage-based search query history (no longer database-stored)
- **Authentication State**: Challenge-response authentication for encrypted batch access
- **Appeal Metadata**: LPA, inspector, decision outcome, reference numbers, dates

### **CRITICAL: Data Structure & Flow Patterns**

**⚠️ ALWAYS CHECK THIS WHEN INVESTIGATING DATA DISPLAY OR MISMATCH ISSUES ⚠️**

#### **Data Structure Inconsistency Pattern**
The application has **TWO DIFFERENT** data structure patterns that must be understood when debugging data display issues:

**1. Test Data Structure (Flat):**
```json
// public/cold-storage/test-batch-001.json
{
  "id": "test-doc-001", 
  "filename": "test-appeal-001.pdf",
  "content": "...",
  // ALL appeal fields at ROOT level
  "case_type": "Planning Appeal",
  "case_id": "APP/B1234/A/21/1234567", 
  "lpa_name": "Cotswold District Council",
  "decision_outcome": "Dismissed",
  "decision_date": "2021-04-15",
  // ... all other appeal metadata fields
  "metadata": {
    "extractedDate": "2025-06-27T23:00:00.000Z",
    "contentSummary": "Single storey extension refused"
  }
}
```

**2. Production Data Structure (Also Flat - Matches Test):**
```typescript
// appealDataTransformer.ts output (intentionally matches test format)
{
  id: "APP/B1234/A/21/1234567",
  filename: "APP_B1234_A_21_1234567.pdf", 
  content: "...",
  // ALL appeal fields at ROOT level (matches test batch)
  case_type: "Planning Appeal",
  lpa_name: "Cotswold District Council", 
  decision_outcome: "Dismissed",
  // Processing metadata nested separately
  metadata: {
    extractedDate: "...",
    transformed_at: "...",
    source_type: "appeal_decision_letter"
  }
}
```

#### **Data Flow Paths & Critical Points**

**Path 1: Test Data Flow (Development/Testing)**
```
Test Batch (Flat) → ColdStorageWorker → SearchResult → SearchResultCard ✅
└─ All fields at root: document.case_type, document.lpa_name
```

**Path 2: Production Data Flow (Appeal Import)**  
```
AppealImport → appealDataTransformer (Flat) → ColdStorageWorker → SearchResult → SearchResultCard ✅  
└─ All fields at root: document.case_type, document.lpa_name
```

#### **ColdStorageWorker Search Result Building**
```typescript
// src/workers/coldStorageWorker.ts:1216-1228
const { content: _, ...documentFields } = document;
results.push({
  ...documentFields, // Spreads ALL root-level fields (case_type, lpa_name, etc.)
  snippet,
  relevance,
  tier: 'cold'
});
```

#### **SearchResultCard Data Access Pattern**
```typescript
// src/components/SearchResultCard.vue:167-181
function getMetadataValue(field: string): string {
  // CHECKS BOTH nested metadata AND root-level document fields
  let value = (metadata.value as any)?.[field];           // Try nested first
  if (value === 'NOT_FOUND' && props.result?.document) {
    value = (props.result.document as any)?.[field];      // Fallback to root level
  }
  return value || 'NOT_FOUND';
}
```

#### **DEBUGGING CHECKLIST: Data Display Issues**

When SearchResultCard shows "NOT_FOUND" for metadata fields:

1. **✅ Verify Data Structure**: Console.log `props.result.document` in SearchResultCard
   - Are appeal fields at `document.case_type` (root) or `document.metadata.case_type` (nested)?

2. **✅ Check ColdStorageWorker Output**: Look at search results from worker
   - Does `...documentFields` spread include the expected fields?

3. **✅ Validate Source Data**: Check original batch/transform data
   - Test batch: Fields should be at root level
   - Transformed data: Fields should be at root level (matches test)

4. **✅ Component Access Logic**: Verify `getMetadataValue()` function
   - Should check both nested metadata AND root-level fields
   - Fallback logic must be working correctly

#### **Common Failure Patterns**

❌ **Assuming Nested Structure**: Components expecting `document.metadata.case_type` when data is at `document.case_type`

❌ **Type Definition Mismatch**: Types expecting nested when implementation uses flat

❌ **Transform Inconsistency**: Data transformer putting fields in different location than test data

**🎯 Golden Rule**: Test data format and production data format MUST match. Any data display component must handle the FLAT structure where appeal metadata lives at the document root level.**

---

## 8. Anchor Comments

Add specially formatted comments throughout the codebase, where appropriate, for yourself as inline knowledge that can be easily `grep`ped for. 

### Guidelines:

- Use `AIDEV-NOTE:`, `AIDEV-TODO:`, or `AIDEV-QUESTION:` (all-caps prefix) for comments aimed at AI and developers.
- Keep them concise (≤ 120 chars).
- **Important:** Before scanning files, always first try to **locate existing anchors** `AIDEV-*` in relevant subdirectories.
- **Update relevant anchors** when modifying associated code.
- **Do not remove `AIDEV-NOTE`s** without explicit human instruction.
- Make sure to add relevant anchor comments, whenever a file or piece of code is:
  * too long, or
  * too complex, or
  * very important, or
  * confusing, or
  * could have a bug unrelated to the task you are currently working on.

Example:
```javascript
// AIDEV-NOTE: perf-hot-path; avoid extra allocations (see ADR-24)
function render_feed(){

}
```

---

## 9. Commit Discipline

*   **Granular commits**: One logical change per commit.
*   **Tag AI-generated commits**: e.g., `feat: optimise feed query [AI]`.
*   **Clear commit messages**: Explain the *why*; link to issues/ADRs if architectural.
*   **Review AI-generated code**: Never merge code you don't understand.

---

## 10. API Models & Codegen
TBD

---

## 11. Testing Strategy

### Current Testing Setup
- **Framework**: Vitest for unit tests
- **Location**: `tests/` directory with unit and integration subdirectories
- **Coverage**: Available via `npm run test:coverage`
- **Structure**: Tests mirror `src/` structure

### Testing Guidelines
- Write tests for all new components and services
- Focus on business logic in services and stores
- Test user interactions and edge cases
- Maintain high coverage for critical document processing workflows

### Test Credentials and Data
**IMPORTANT**: For testing encrypted document search functionality

#### Development Authentication
- **Test Password**: `TestPassword123!`
- **Purpose**: Used for accessing encrypted test batch in development
- **Location**: Encrypted test batch at `public/cold-storage/test-batch-001-encrypted.json`
- **Contains**: 3 sample appeal decision documents with keywords: "character", "appeal", "planning", etc.

#### Password Requirements
The test password meets all authentication requirements:
- ✅ 12+ characters long
- ✅ Contains uppercase letter (T, P)
- ✅ Contains lowercase letters (est, assword)
- ✅ Contains numbers (123)
- ✅ Contains special characters (!)

#### Testing Encrypted Search
1. **Setup**: Navigate to application and enter `TestPassword123!` when prompted
2. **Authentication**: System will create challenge data and authenticate
3. **Search Test**: Try searching for "appeal", "character", or "planning"
4. **Expected Results**: Should return 1-3 documents from the encrypted test batch

**Note**: This password is for development/testing only. Production deployments require users to set their own secure passwords.

### Test Coverage Requirements
**CRITICAL**: Follow the systematic coverage methodology defined in `coverage.md`

1. **UNDERSTAND** current coverage percentages using `npm run test:coverage`
2. **ADD** unit tests for functions/methods without 100% coverage
3. **MOCK** all external dependencies (APIs, databases, services)
4. **RE-RUN** coverage analysis and repeat until thresholds are met

#### Coverage Thresholds
- **Functions**: 95% minimum
- **Statements**: 95% minimum
- **Branches**: 90% minimum
- **Lines**: 95% minimum

#### Coverage Commands
```bash
npm run test:coverage    # Generate coverage report
npm run test:watch      # Development mode testing
npm run test:run        # Single test run
```

### Code Review Process
1. **Test Coverage**: Verify all new code has appropriate test coverage
2. **Component Documentation**: Ensure reusable components are documented
3. **Accessibility**: Validate ARIA attributes and keyboard navigation
4. **Performance**: Check for unnecessary re-renders and optimizations

### Git Workflow
- **Feature Branches**: Create branches for all new features
- **Commit Messages**: Use conventional commit format
- **Pre-commit**: Run tests and coverage analysis before commits
- **Code Review**: Required for all changes to main branch

---

## 12. Security Considerations

### Document Data Protection
- **Document Privacy**: Ensure document content is processed locally and not transmitted
- **Local Storage**: All processing happens client-side using IndexedDB
- **No Server Dependencies**: Application runs entirely in browser
- **Data Validation**: All document uploads validated and sanitized

### Development Security
- No hardcoded credentials or secrets
- Environment variables for sensitive configuration
- Regular dependency updates for security patches

---

## 13. Directory-Specific AGENTS.md Files

*   **Always check for `AGENTS.md` files in specific directories** before working on code within them. These files contain targeted context.
*   If a directory's `AGENTS.md` is outdated or incorrect, **update it**.
*   If you make significant changes to a directory's structure, patterns, or critical implementation details, **document these in its `AGENTS.md`**.
*   If a directory lacks a `AGENTS.md` but contains complex logic or patterns worth documenting for AI/humans, **suggest creating one**.

---

## 14. Common Pitfalls

*   Large AI refactors in a single commit (makes `git bisect` difficult).

---

## 15. Versioning Conventions

Components are versioned independently. Semantic Versioning (SemVer: `MAJOR.MINOR.PATCH`) is generally followed, as specified in each component's `package.json` file.

*   **MAJOR** version update: For incompatible API changes.
*   **MINOR** version update: For adding functionality in a backward-compatible manner.
*   **PATCH** version update: For backward-compatible bug fixes.

---

## 16. Decision Trees for Common Choices

### When to Create a New Component vs Modify Existing

```
Need UI functionality?
├── Similar component exists? 
│   ├── YES → Extend existing component with props/slots
│   └── NO → Check if it's document processing specific
│       ├── YES → Create in components/ with AIDEV-NOTE
│       └── NO → Create generic component
└── Page-level functionality?
    └── Create in views/ following existing patterns
```

### State Management: Local vs Store

```
Data needed by multiple components?
├── YES → Use appropriate storage layer
│   ├── Document data → Cold storage (encrypted batches via workers)
│   ├── Search history → localStorage (searchHistoryService)
│   └── Authentication state → Vue reactive store
└── NO → Local component state (ref/reactive)
    ├── Form data → Local state
    └── Temporary UI → Local state  
```

### Service Layer Organization

```
New service functionality needed?
├── Document processing domain → Existing service file
│   ├── Cold Storage → services/ColdStorageService.js
│   ├── Authentication → services/AuthenticationService.js
│   ├── Appeal Import → services/AppealImportService.ts
│   ├── Encryption → services/EncryptionService.js
│   └── Performance → services/PerformanceMonitor.js
└── New domain → Create new service file
    └── Follow existing patterns with error handling
```

### MCP Tool Selection

```
Need additional capabilities?
├── Research needed?
│   ├── Library docs → mcp__context7__ tools
│   ├── Current trends → mcp__duckduckgo-search__
│   └── Complex analysis → mcp__sequential-thinking__
├── Code quality checks?
│   ├── Type errors → mcp__ide__getDiagnostics
│   ├── Code execution → mcp__ide__executeCode
│   └── Testing snippets → mcp__ide__executeCode
├── UI/Browser testing?
│   ├── Screenshots → mcp__puppeteer__screenshot
│   ├── Interactions → mcp__puppeteer__click/fill
│   └── JavaScript → mcp__puppeteer__evaluate
└── Knowledge management?
    ├── Store insights → mcp__memory-bank__write
    ├── Retrieve patterns → mcp__memory-bank__read
    └── Cross-project → mcp__memory-bank__list_projects
```

---

## 17. Domain-Specific Terminology

*   **AIDEV-NOTE/TODO/QUESTION**: Specially formatted comments to provide inline context or tasks for AI assistants and developers.
*   **Cold Storage**: Encrypted batch-based document storage architecture with AES-256-GCM encryption
*   **Appeal Processing**: Automated import and processing of UK Planning Appeal decision letters
*   **Salt-Embedded Authentication**: Encryption approach where batch-specific salts enable secure key derivation
*   **Worker-Based Search**: Non-blocking search operations performed in web workers for better performance
*   **Challenge-Response Auth**: Password verification system without storing actual passwords
*   **MCP (Model Context Protocol)**: Extended AI capabilities through server plugins for research, code analysis, browser automation, and knowledge management
*   **Context7**: Library documentation service for API reference and usage patterns
*   **Sequential Thinking**: Structured problem-solving approach for complex technical challenges
*   **Memory Bank**: Cross-project knowledge storage for implementation insights and patterns

---

## 18. Meta: Guidelines for Updating AGENTS.md Files

### Elements that would be helpful to add:

1. **Decision flowchart**: A simple decision tree for "when to use X vs Y" for key architectural choices would guide my recommendations.
2. **Reference links**: Links to key files or implementation examples that demonstrate best practices.
3. **Domain-specific terminology**: A small glossary of project-specific terms would help me understand domain language correctly.
4. **Versioning conventions**: How the project handles versioning, both for APIs and internal components.

### Format preferences:

1. **Hierarchical organisation**: Consider using hierarchical numbering for subsections to make referencing easier.
2. **Tabular format for key facts**: The tables are very helpful - more structured data in tabular format would be valuable.
3. **Keywords or tags**: Adding semantic markers (like `#performance` or `#security`) to certain sections would help me quickly locate relevant guidance.

[^1]: This principle emphasises human oversight for critical aspects like architecture, testing, and domain-specific decisions, ensuring AI assists rather than fully dictates development.

---

## AI Assistant Workflow: Step-by-Step Methodology

When responding to user instructions, the AI assistant (Claude, Cursor, GPT, etc.) should follow this process to ensure clarity, correctness, and maintainability:

1. **Consult Relevant Guidance**: When the user gives an instruction, consult the relevant instructions from `AGENTS.md` files (both root and directory-specific) for the request.
2. **Clarify Ambiguities**: Based on what you could gather, see if there's any need for clarifications. If so, ask the user targeted questions before proceeding.
3. **Break Down & Plan**: Break down the task at hand and chalk out a rough plan for carrying it out, referencing project conventions and best practices.
4. **Trivial Tasks**: If the plan/request is trivial, go ahead and get started immediately.
5. **Non-Trivial Tasks**: Otherwise, present the plan to the user for review and iterate based on their feedback.
6. **Track Progress**: Use a to-do list (internally, or optionally in a `TODOS.md` file) to keep track of your progress on multi-step or complex tasks.
7. **If Stuck, Re-plan**: If you get stuck or blocked, return to step 3 to re-evaluate and adjust your plan.
8. **Update Documentation**: Once the user's request is fulfilled, update relevant anchor comments (`AIDEV-NOTE`, etc.) and `AGENTS.md` files in the files and directories you touched.
9. **User Review**: After completing the task, ask the user to review what you've done, and repeat the process as needed.
10. **Session Boundaries**: If the user's request isn't directly related to the current context and can be safely started in a fresh session, suggest starting from scratch to avoid context confusion.

---

## General Points

### **Keep Learning**
- Follow Anthropic's official documentation updates
- Explore community resources and prompt collections
- Experiment with new techniques and approaches
- Stay updated on Claude's evolving capabilities


### Resources and Links

- **[Anthropic Documentation](https://docs.anthropic.com)** - Official prompting guides and best practices
- **[Awesome Claude Prompts](https://github.com/langgptai/awesome-claude-prompts)** - Community-curated prompt collection
- **[Claude Prompt Library](https://docs.anthropic.com/claude/prompt-library)** - Pre-made prompts for various use cases
- **[Interactive Tutorial](https://github.com/anthropics/prompt-eng-interactive-tutorial)** - Hands-on prompt engineering learning
- **[Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook)** - Code examples and advanced techniques