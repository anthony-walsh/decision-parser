# Medical Rota Management System - AI Development Guide

## AI Assistant Expertise & Context
You are an expert in:
- **Web Development**: CSS, JavaScript, Vue.js, Tailwind, Markdown
- **PDF Processing Applications**: Understanding of pdf processing
- **Project Type**: High volume PDF processing and searching

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

This project is a web based application to allow users to upload and search the contents of PDF files.


**Golden rule**: When unsure about implementation details or requirements, ALWAYS consult the developer rather than making assumptions.

---

## 2. Non-negotiable Golden Rules

| Rule | AI *may* do | AI *must NOT* do |
|------|-------------|------------------|
| **G-0** | Whenever unsure about something that's related to the project, ask the developer for clarification before making changes | ❌ Write changes or use tools when you are not sure about something project specific, or if you don't have context for a particular feature/decision |
| **G-1** | Generate code **only inside** relevant source directories | |
| **G-2** | Add/update **`AIDEV-NOTE:` anchor comments** near non-trivial edited code | ❌ Delete or mangle existing `AIDEV-` comments |
| **G-3** | Follow lint/style configs. Use the project's configured linter, if available, instead of manually re-formatting code | ❌ Re-format code to any other style |
| **G-4** | For changes >300 LOC or >3 files, **ask for confirmation** | ❌ Refactor large modules without human guidance |
| **G-5** | Stay within the current task context. Inform the dev if it'd be better to start afresh | ❌ Continue work from a prior prompt after "new task" – start a fresh session |

---

## 3. Quick Reference Guide

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
- **Vuetify 3**: Material Design component library
- **Vue Router 4**: Client-side routing with protection guards
- **Vuex 4**: Centralized state management

#### Build Tools & Development
- **Vite**: Fast build tool and development server
- **Node.js 16+**: Runtime environment
- **npm**: Package manager
- **Prettier**: Code formatting

#### Styling & Design
- **CSS Custom Properties**: Modern CSS variables for theming
- **Material Design Icons**: Comprehensive icon system
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: System preference based theming

### 📁 Key File Locations

| Purpose | Location | Description |
|---------|----------|-------------|
| **Components** | `src/components/` | Reusable UI components |
| **Views** | `src/views/dashboard/` | Page-level healthcare views |
| **Services** | `src/services/` | API calls and business logic |
| **Store** | `src/store/modules/` | Vuex state management |
| **Types** | `src/types/` | Type definitions |
| **Tests** | `tests/unit/` | Unit test files |

---

## 4. Development Commands

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

## 5. Coding Standards

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

## 6. Project Layout & Core Components

### Directory Organization
```
src/
├── components/          # Reusable UI components
│   ├── ModernCard.vue  # Flexible card component with variants
│   ├── StatCard.vue    # Statistics display component
│   ├── ThemeToggle.vue # Dark/light mode toggle
│   └── FavoriteIcon.vue
├── views/               # Page-level components
│   ├── dashboard/       # Dashboard-specific views
│   │   ├── DashboardHome.vue    # Role-based dashboard
│   │   ├── MyRotaView.vue       # Personal schedule
│   │   ├── RotaOverview.vue     # Rota management
│   │   ├── ShiftSwapsView.vue   # Shift swap approvals
│   │   ├── ShiftTypesView.vue   # Shift configuration
│   │   └── UsersView.vue        # User management
│   ├── Dashboard.vue    # Main dashboard layout
│   ├── Login.vue       # Authentication interface
│   └── Home.vue        # Landing page
├── services/            # Business logic and API calls
│   ├── auth.js         # Authentication service
│   ├── locations.js    # Location management
│   └── shifts.js       # Shift management
├── store/               # Vuex state management
│   ├── modules/
│   │   ├── auth.js     # Authentication state
│   │   ├── locations.js # Location state
│   │   ├── rotas.js    # Rota state
│   │   ├── shifts.js   # Shift state
│   │   └── theme.js    # Theme state
│   └── index.js        # Store configuration
├── router/              # Vue Router configuration
│   └── index.js        # Route definitions and guards
├── assets/              # Static assets
│   ├── base.css        # Design system tokens
│   ├── main.css        # Global styles
│   └── logo.svg
└── types/               # Type definitions
    └── UserType.js     # User role definitions
```

**Key domain models**:
- **Users**: Hospital staff with different roles (Admin, Manager, Staff)
- **Locations**: Hospital sites and departments within sites
- **Shifts**: Time slots that need to be filled (with types, requirements)
- **Rotas**: Schedules linking users to shifts across time periods
- **Shift Swaps**: Requests for staff to exchange allocated shifts
- **User Types**: Role-based permissions and access levels

---

## 7. Anchor Comments

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

## 8. Commit Discipline

*   **Granular commits**: One logical change per commit.
*   **Tag AI-generated commits**: e.g., `feat: optimise feed query [AI]`.
*   **Clear commit messages**: Explain the *why*; link to issues/ADRs if architectural.
*   **Review AI-generated code**: Never merge code you don't understand.

---

## 9. API Models & Codegen
TBD

---

## 10. Testing Strategy

### Current Testing Setup
- **Framework**: Vitest for unit tests
- **Location**: `tests/` directory with unit and integration subdirectories
- **Coverage**: Available via `npm run test:coverage`
- **Structure**: Tests mirror `src/` structure

### Testing Guidelines
- Write tests for all new components and services
- Focus on business logic in services and stores
- Test user interactions and edge cases
- Maintain high coverage for critical healthcare workflows

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

## 11. Security Considerations

### Healthcare Data Protection
- **Patient Privacy**: Ensure no patient data is logged or exposed
- **Access Control**: Role-based permissions strictly enforced
- **Session Management**: Secure authentication and session handling
- **Data Validation**: All inputs validated server-side

### Development Security
- No hardcoded credentials or secrets
- Environment variables for sensitive configuration
- Regular dependency updates for security patches

---

## 12. Directory-Specific AGENTS.md Files

*   **Always check for `AGENTS.md` files in specific directories** before working on code within them. These files contain targeted context.
*   If a directory's `AGENTS.md` is outdated or incorrect, **update it**.
*   If you make significant changes to a directory's structure, patterns, or critical implementation details, **document these in its `AGENTS.md`**.
*   If a directory lacks a `AGENTS.md` but contains complex logic or patterns worth documenting for AI/humans, **suggest creating one**.

---

## 13. Common Pitfalls

*   Large AI refactors in a single commit (makes `git bisect` difficult).

---

## 14. Versioning Conventions

Components are versioned independently. Semantic Versioning (SemVer: `MAJOR.MINOR.PATCH`) is generally followed, as specified in each component's `package.json` file.

*   **MAJOR** version update: For incompatible API changes.
*   **MINOR** version update: For adding functionality in a backward-compatible manner.
*   **PATCH** version update: For backward-compatible bug fixes.

---

## 15. Decision Trees for Common Choices

### When to Create a New Component vs Modify Existing

```
Need UI functionality?
├── Similar component exists? 
│   ├── YES → Extend existing component with props/slots
│   └── NO → Check if it's healthcare-specific
│       ├── YES → Create in components/ with AIDEV-NOTE
│       └── NO → Create generic component
└── Page-level functionality?
    └── Create in views/dashboard/ following existing patterns
```

### State Management: Local vs Store

```
Data needed by multiple components?
├── YES → Use Vuex store module
│   ├── Healthcare data → store/modules/ (e.g., rotas.js, shifts.js)  
│   └── UI state → store/modules/theme.js
└── NO → Local component state (ref/reactive)
    ├── Form data → Local state
    └── Temporary UI → Local state  
```

### Service Layer Organization

```
New API endpoint needed?
├── Healthcare domain → Existing service file
│   ├── Authentication → services/auth.js
│   ├── Staff/Rotas → services/shifts.js  
│   └── Hospitals → services/locations.js
└── New domain → Create new service file
    └── Follow existing patterns with error handling
```

---

## 16. Domain-Specific Terminology

*   **AIDEV-NOTE/TODO/QUESTION**: Specially formatted comments to provide inline context or tasks for AI assistants and developers.
*   **Rota Management**: Core business domain for healthcare staff scheduling
*   **Shift Patterns**: Recurring schedule templates used across healthcare settings
*   **Compliance Tracking**: Monitoring adherence to healthcare working time regulations

---

## 17. Meta: Guidelines for Updating AGENTS.md Files

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