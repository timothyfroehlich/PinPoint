- **API:** tRPC
- **Language:** TypeScript
- **Full-Stack Framework:** Next.js (with React)
- **UI Component Library:** Material UI (MUI)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** NextAuth.js (Auth.js v5)
- **Drag-and-Drop:** dnd-kit
- **Image Storage:** Cloudinary
- **Deployment:** Vercel
- **Organization:** The top-level tenant (e.g., "Austin Pinball Collective").
- **Location:** A physical venue belonging to an Organization.
- **Game Title:** A generic machine model (e.g., "Godzilla (Premium)").
- **Game Instance:** A specific, physical machine at a Location. Issues are tied to this.
- **Issue:** A reported problem or task for a Game Instance.
- **User:** A global account holder.
- **Member:** A User associated with an Organization with a specific role (`admin` or `member`).
- **Repo** timothyfroehlich/PinPoint

1. **Multi-Tenancy:** The application is a multi-tenant system using a shared database with row-level security. Nearly every database table containing tenant-specific data must have a non-nullable `organization_id` column. All database queries must be strictly scoped by this `organization_id` to ensure data isolation.
2. **Global Users:** User accounts are global. A `Membership` junction table links a `User` to an `Organization` and defines their role.
3. **Optimistic UI:** For highly interactive features like the Kanban board, implement optimistic UI updates to ensure a fluid user experience. The UI should update immediately, with the API call happening in the background. Failed API calls must revert the UI to its previous state and notify the user.
4. **Future-Facing Design:** The architecture must accommodate future features.
   - **Post-1.0:** An interactive Kanban board for issue management.
   - **v2.0:** A comprehensive parts and supplies inventory tracking module. New code should not preclude the clean integration of these future modules.

- **TypeScript First:** Use TypeScript for all new code. Leverage its static typing capabilities to ensure code quality and prevent runtime errors.
- **Code Quality:** Adhere to the project's ESLint and Prettier configurations for consistent code style.
- **API:** Backend logic should be implemented using tRPC, built upon Next.js API Routes.
- **Component Structure:** Follow existing patterns for React component structure and state management.
- **Prisma Schema:** When modifying the database, update the `schema.prisma` file. All tenant-specific tables must include the `organization_id` foreign key.

## **CRITICAL: Code Quality & Linting Workflow**

### **Mandatory Quality Checks During Development**

**🚨 ALWAYS run lints and formatters frequently while working on files - do NOT accumulate lint debt!**

1. **Before Starting Work**: Run `npm run validate` to ensure clean starting state
2. **During Development**: Run quality checks after each significant change:
   - `npm run typecheck` - Fix TypeScript errors immediately
   - `npm run lint` - Fix ESLint errors immediately
   - `npm run format:write` - Auto-fix formatting issues
3. **Before Every Commit**: Run `npm run pre-commit` - this is MANDATORY and must pass
4. **Test Code Quality**: Test files must follow the same quality standards as production code

### **Quality Standards (Zero Tolerance)**

- **0 TypeScript compilation errors** - Fix immediately, never commit with TS errors
- **0 ESLint errors** - Warnings acceptable with justification, but no errors
- **0 Prettier formatting issues** - Code must be consistently formatted
- **Proper typing** - No `any` types, no unsafe operations, use proper interfaces
- **Clean imports** - Use ES modules, avoid `require()`, properly type all imports
- **Modern Jest patterns** - Use `jest.fn<T>()` not `jest.Mocked<T>`, avoid `any` in test mocks
- **Test file quality** - Test files must meet same standards as production code

### **Quality Commands Reference**

- `npm run validate` - **Run before starting work** - Full validation suite
- `npm run validate:fix` - **Run during development** - Auto-fix issues
- `npm run pre-commit` - **Run before commits** - Mandatory quality gate
- `npm run typecheck` - TypeScript compilation check
- `npm run lint` - ESLint code quality check
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format:check` - Check Prettier formatting
- `npm run format:write` - Auto-fix formatting issues

### **Test Code Quality Requirements**

Test files must meet the same standards as production code:

- **Proper TypeScript typing** - Mock objects, test data, and assertions must be fully typed
- **No unsafe operations** - Use typed mocks instead of `any` types
- **Clean test structure** - Descriptive test names, proper setup/teardown, focused assertions
- **Modern Jest patterns** - Use `jest.fn<ReturnType, Parameters>()` for typed mocks instead of `jest.Mocked<T>`
- **ES module imports** - Always use `import()` for dynamic imports, never `require()` in test files
- **NextAuth v5 compatibility** - Use proper typing for Auth.js v5 session objects and providers
- **Write Tests First:** For new backend logic and critical UI components, write failing tests before writing the implementation code.
- **Testing Stack:** Use Jest for the test runner, React Testing Library for components, and Playwright for End-to-End (E2E) tests.
- **Playwright MCP:** Playwright is available as an MCP server for browser automation and E2E testing.
- **Coverage:** Ensure new features have adequate test coverage, including:
  - **Unit Tests:** For individual functions and components.
  - **Integration Tests:** For API endpoints and component interactions.
  - **E2E Tests:** For critical user workflows (e.g., submitting an issue, managing a game).
- **Multi-Tenancy Tests:** It is absolutely critical to have integration tests that verify data segregation between different organizations.
- **Temporary Files:** When a temporary file is needed to complete a task (e.g., to pass a complex string as a command-line argument), it should be created inside a `/tmp` directory at the root of the project. This directory should be added to the `.gitignore` file.

# Modern Development Workflow & Quality Assurance

## **Intelligent Development Server Management**

### **Primary Development Commands**

- `npm run dev:full` - **RECOMMENDED**: Start all development services with intelligent monitoring
- `npm run dev:clean` - Start with complete environment cleanup and fresh state
- `npm run dev:status` - Check health and status of all development services
- `npm run dev` - Legacy single-server start (still supported)
- `npm run dev:safe` - Legacy safe start with validation (still supported)

### **Enhanced Development Architecture**

**Service Orchestration:**

- **Concurrently** manages multiple processes with colored, labeled output
- **Nodemon** provides intelligent file watching with selective restart rules
- **Health monitoring** verifies services are responsive, not just running
- **Graceful shutdowns** prevent port conflicts and zombie processes

**Automatic Process Management:**

- **Database sessions** automatically clear on `npm run db:reset`
- **Selective restarts** - only restart affected services when files change
- **Port conflict resolution** - automatic cleanup and retry
- **Process health monitoring** - detect and recover from zombie processes

### **Before Starting Any Work**

1. **Environment Status Check**: Run `npm run dev:status` to see what's running
2. **Validate Environment**: Run `npm run validate` to ensure clean starting state
3. **Start Development Environment**:
   - **Recommended**: `npm run dev:full` (starts all services with monitoring)
   - **Fresh start**: `npm run dev:clean` (cleanup + start)
   - **Legacy**: `npm run dev:safe` (still supported)
4. **Verify All Services**: Automatic health checks confirm all services respond

### **Development Environment Services**

When running `npm run dev:full`, these services start automatically:

- **Next.js Server** (localhost:3000) - Main application with Turbo
- **Prisma Studio** (localhost:5555) - Database exploration and editing
- **TypeScript Watcher** - Continuous type checking with file watching
- **Health Monitor** - Automatic service health verification

### **During Development**

1. **Intelligent Restarts**: File changes trigger selective service restarts automatically
2. **Visual Feedback**: Colored, labeled output shows which service restarted and why
3. **Health Monitoring**: Services are verified as responsive, not just running
4. **Incremental Validation**: Run `npm run typecheck` after each significant change
5. **Test Immediately**: Verify functionality works before moving to next task
6. **Small Commits**: Commit working states frequently with descriptive messages

### **Before Committing (Mandatory)**

1. **Full Validation**: Run `npm run pre-commit` (includes typecheck, lint, build)
2. **Manual Testing**: Test the specific feature you implemented
3. **Service Verification**: Run `npm run dev:status` to ensure all services healthy
4. **Database Check**: If schema changed, run `npx prisma db push` and verify

### **Dependency Management Protocol**

1. **Never Update All Dependencies**: Update one major dependency at a time
2. **Read Migration Guides**: Always check changelog and migration docs first
3. **Test After Each Update**: Run full validation after each dependency change
4. **Pin Major Versions**: Use `~` not `^` for critical UI/framework dependencies
5. **Separate Commits**: Commit each successful dependency update separately

## **Quality Gates & Standards**

### **Code Quality Requirements**

- **TypeScript Strict Mode**: All code must pass `tsc --noEmit` with zero errors
- **ESLint Compliance**: Fix all linting errors, warnings acceptable with justification
- **Prettier Formatting**: Code must be consistently formatted
- **Build Success**: `npm run build` must complete without errors

### **Testing Requirements**

**CURRENT PHASE: Unit Tests Only**

- **New Features**: Must include unit tests for business logic (service layer, utilities, pure functions)
- **No Integration Tests**: We're iterating quickly and not ready for client-server integration tests yet
- **No E2E Tests**: End-to-end tests will come in a later phase
- **Multi-Tenancy**: Unit test business logic to verify data isolation between organizations

**FUTURE PHASES: Integration & E2E Testing**

- **API Endpoints**: Integration tests for tRPC procedures (coming later)
- **Critical Paths**: E2E tests for user workflows (coming later)

## **Database Handling**

- **Very Pre-Production**: We will be making frequent changes to the database schema
- **Well-structured Seed**: We'll make good use of @prisma/seed.ts to populate test data
- **No migrations**: We'll handle changes by resetting the database
- **Complete Reset**: Use `npm run db:reset` to completely wipe migrations, reset database, and reseed

## **Troubleshooting Guide**

### **Development Server Issues**

**Problem**: Server says "Ready" but doesn't respond
**Solutions**:

1. Check for TypeScript compilation errors: `npm run typecheck`
2. Verify health endpoint: `curl http://localhost:3000/api/health`
3. Kill all Node processes: `pkill -f node` then restart
4. Check for port conflicts: `netstat -tlnp | grep :3000`

**Problem**: Material-UI TypeScript errors
**Solutions**:

1. Check package.json for version compatibility
2. Verify import statements match current API
3. Consider pinning to known-working version
4. Check Material-UI migration guides

**Problem**: Next.js dynamic route errors
**Solutions**:

1. Verify params handling matches Next.js version API
2. Check if params should be Promise (Next.js 15+)
3. Ensure proper async/await usage in components

### **Database Issues**

**Problem**: Prisma schema out of sync
**Solutions**:

1. **Quick fix**: Run `npx prisma db push` to sync schema
2. **Complete reset**: Run `npm run db:reset` to wipe everything and start fresh
3. Regenerate client: `npx prisma generate`

**Problem**: Database has old/inconsistent data
**Solutions**:

1. **Recommended**: Run `npm run db:reset` for clean slate
2. Manual cleanup: Run `npm run seed` to add fresh data (preserves existing data)

## **Intelligent Development Features**

### **Selective Restart Logic**

**File Change Detection:**

- **Schema changes** (`prisma/schema.prisma`) → Full restart + Prisma regeneration
- **Environment changes** (`.env`) → Full restart with validation
- **Server code changes** (`src/server/`) → Graceful server restart only
- **Frontend changes** (`src/app/`) → No restart (Next.js HMR handles it)
- **Configuration changes** (`*.config.js`) → Full restart

### **Automatic Session Management**

**Development Sessions:**

- **Database strategy** used in development for automatic session clearing
- **Sessions clear automatically** when running `npm run db:reset`
- **No manual session management** required during development
- **Fresh login required** after database resets (intentional for testing)

### **Process Health Monitoring**

**Automatic Health Checks:**

- **HTTP health endpoint** verification (localhost:3000/api/health)
- **Prisma Studio** connectivity check (localhost:5555)
- **Database** connection verification
- **File watchers** active status monitoring

**Recovery Procedures:**

- **Zombie process detection** and automatic cleanup
- **Port conflict resolution** with automatic retry
- **Graceful restart** on service failure
- **Exponential backoff** for repeated failures

## **Enhanced Emergency Procedures**

### **Modern Development Server Issues**

**Problem**: Development environment not responding
**Solutions**:

1. **Check status**: `npm run dev:status` (shows health of all services)
2. **Graceful restart**: `npm run dev:clean` (cleanup + fresh start)
3. **Emergency stop**: `npm run kill:all` (intelligent process cleanup)
4. **Port cleanup**: `npm run port:free` (free stuck ports: 3000, 5555)

**Problem**: Services starting but not responding
**Solutions**:

1. **Health check**: `npm run health` (detailed service diagnostics)
2. **Fresh environment**: `npm run dev:clean` (complete reset)
3. **Manual verification**: Check individual service logs in colored output

**Problem**: Database sessions not clearing
**Solutions**:

1. **Database reset**: `npm run db:reset` (clears all sessions automatically)
2. **Verify strategy**: Check that development uses database session strategy
3. **Manual check**: Verify `Session` table is empty after reset

### **Legacy Emergency Procedures (Fallback)**

If modern tools fail, these legacy procedures still work:

**If Development is Completely Broken**

1. **Check Git Status**: `git status` to see what changed
2. **Revert Recent Changes**: `git checkout -- .` to discard unstaged changes
3. **Clean Install**: Delete `node_modules` and `package-lock.json`, run `npm install`
4. **Database Reset**: If needed, reset database and run `npm run seed`
5. **Validate Clean State**: Run `npm run validate` and `npm run build`

**If Dependencies Are Broken**

1. **Check for Breaking Changes**: Review package changelogs
2. **Pin to Previous Version**: Update package.json to last known working version
3. **Clean Reinstall**: `rm -rf node_modules package-lock.json && npm install`
4. **Document the Issue**: Add notes to this file about problematic versions

**Legacy Manual Procedures**

1. **Manual process kill**: `pkill -f node` then restart
2. **Port checking**: `netstat -tlnp | grep :3000`
3. **Clean install**: Delete `node_modules`, run `npm install`

## **Required Scripts & Commands**

### **Enhanced Development Scripts**

**Primary Development Commands:**

- `npm run dev:full` - **RECOMMENDED**: Start all services with intelligent monitoring
- `npm run dev:clean` - Fresh start with complete environment cleanup
- `npm run dev:status` - Check health and status of all development services
- `npm run health` - Detailed health diagnostics for all services
- `npm run kill:all` - Intelligent cleanup of all development processes
- `npm run port:free` - Free stuck development ports (3000, 5555)

**Legacy Development Scripts (Still Supported):**

- `npm run dev` - Start Next.js development server with Turbo
- `npm run dev:safe` - Validates before starting development server
- `npm run dev:check` - Check if development server is running properly

**Service-Specific Scripts:**

- `npm run dev:server` - Start only Next.js server with intelligent restart
- `npm run dev:db` - Start only Prisma Studio (localhost:5555)
- `npm run dev:typecheck` - Start only TypeScript watcher

**Production Scripts:**

- `npm run start` - Start production server (requires build first)
- `npm run preview` - Build and start production server for testing

### **Database Scripts**

- `npm run db:reset` - **Complete database reset**: Removes all migrations, force-resets database to match schema, and reseeds with fresh data
- `npm run db:push` - Syncs current schema to database (for incremental changes)
- `npm run db:generate` - Generate Prisma migrations during development
- `npm run db:migrate` - Deploy Prisma migrations to production
- `npm run db:studio` - Open Prisma Studio for database exploration
- `npm run seed` - Runs seed script only (assumes database schema is current)

### **Quality Assurance Scripts**

- `npm run validate` - Runs typecheck, lint, and format check
- `npm run validate:fix` - Runs validation and fixes issues automatically
- `npm run validate:test` - Runs validation plus all tests
- `npm run pre-commit` - **Mandatory before commits**: Full validation with fixes plus smoke test
- `npm run smoke-test` - Build verification to ensure basic functionality
- `npm run health-check` - Test server health endpoint

### **Code Quality Scripts**

- `npm run typecheck` - TypeScript compilation check (strict mode)
- `npm run lint` - ESLint code quality checks
- `npm run lint:fix` - ESLint with automatic fixes
- `npm run format:check` - Prettier formatting verification
- `npm run format:write` - Prettier automatic formatting
- `npm run build` - Production build verification

### **Testing Scripts**

- `npm run test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Run tests with coverage reporting

### **Dependency Management**

- `npm run deps:check` - Audit for high-severity security vulnerabilities
- `npm run deps:fix` - Automatically fix security vulnerabilities
- `npm run deps:update` - Update dependencies and run audit

### **Utility Scripts**

- `npm run clean` - Clean build artifacts and reinstall dependencies
- `npm run reset` - Full environment reset: clean, database push, and seed
- `npm run pinballmap:update-fixture` - Update test fixtures from PinballMap API
- `npm run prepare` - Setup husky for Git hooks (runs automatically)

## **Development Session Management**

### **Automatic Session Clearing**

**Database Session Strategy:**

- **Development environment** uses database sessions for automatic clearing
- **Sessions stored** in database `Session` table, not encrypted JWT tokens
- **Automatic cleanup** when running `npm run db:reset`
- **Fresh login required** after database resets (intentional for testing)

**Session Behavior:**

- **Development**: Sessions clear on database reset, fresh login required
- **Production**: Uses JWT sessions for persistence across server restarts
- **Testing**: Database sessions provide clean state for each test run

### **When Sessions Clear Automatically**

1. **Database reset** (`npm run db:reset`) - All sessions cleared
2. **Fresh environment start** (`npm run dev:clean`) - Option to reset database
3. **Schema changes** that trigger database regeneration
4. **Manual session cleanup** via Prisma Studio (localhost:5555)

### **Development Workflow Integration**

**Normal Flow:**

1. `npm run dev:full` starts all services via concurrently
2. Nodemon watches server files and restarts intelligently
3. Health checks verify everything is responsive
4. Graceful shutdowns prevent port conflicts
5. Session persistence works via database strategy

**Restart Scenarios:**

- **File change detected** → Nodemon runs pre-restart script → Graceful shutdown → Restart → Health check
- **Manual restart** → Same flow triggered manually
- **Port conflict** → Cleanup script frees ports → Restart

**Error Recovery:**

- **Process crash** → Concurrently restarts with exponential backoff
- **Port stuck** → Auto-cleanup and retry
- **Health check fails** → Diagnostic information logged

### **Comment Management**

- **Soft Delete**: Comments are soft-deleted (marked with `deletedAt`) when deleted
- **Auto-Cleanup**: Soft-deleted comments are automatically removed after 90 days
- **Manual Cleanup**: Admins can run `api.issue.cleanupDeletedComments.mutate()` to manually clean up old deleted comments
- **Permissions**:
  - Users can edit/delete their own comments
  - Admins can delete any comment but can only edit their own
  - Comment edits show "edited X time ago" timestamp

## **Playwright MCP Server Usage**

The Playwright MCP server provides browser automation capabilities for E2E testing and manual testing workflows. Key capabilities:

### **Browser Navigation & Control**

- `mcp__playwright__browser_navigate` - Navigate to URLs
- `mcp__playwright__browser_take_screenshot` - Capture visual state
- `mcp__playwright__browser_snapshot` - Get accessibility tree (better than screenshots for actions)
- `mcp__playwright__browser_resize` - Adjust browser window size

### **Element Interaction**

- `mcp__playwright__browser_click` - Click elements using ref from snapshots
- `mcp__playwright__browser_type` - Type text into form fields
- `mcp__playwright__browser_select_option` - Select dropdown options
- `mcp__playwright__browser_hover` - Hover over elements

### **Testing Workflows**

1. **Manual Testing**: Use Playwright to navigate through user flows and verify Google login works
2. **Screenshot Documentation**: Capture visual state for debugging or documentation
3. **Form Testing**: Interact with forms, buttons, and UI elements
4. **Multi-tenant Testing**: Verify organization isolation by logging in as different users

## **Critical Lessons Learned: ESLint Debt Prevention**

### **🚨 Never Accumulate Lint Debt - Fix Issues Immediately**

**Key Principle**: Fix linting issues as soon as they appear, not in bulk cleanup sessions.

### **Common Pitfalls That Lead to Lint Debt**

1. **Unsafe Mock Patterns**:

   ```typescript
   // ❌ BAD - Creates unsafe any types
   const mockDb = db as jest.Mocked<typeof db>;
   mockDb.user.findMany.mockResolvedValue(users); // Unsafe call

   // ✅ GOOD - Individual typed mocks
   const mockUserFindMany = jest.fn<Promise<User[]>, [any]>();
   mockUserFindMany.mockResolvedValue(users);
   ```

2. **Legacy require() Imports**:

   ```typescript
   // ❌ BAD - Forbidden in modern codebases
   const { authConfig } = require("../config");

   // ✅ GOOD - Modern ES module imports
   const configModule = await import("../config");
   const authConfig = configModule.authConfig;
   ```

3. **Untyped expect.objectContaining()**:

   ```typescript
   // ❌ BAD - Unsafe assignment
   where: expect.objectContaining({ id: "123" });

   // ✅ GOOD - Properly typed or disabled
   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
   where: expect.objectContaining({ id: "123" }) as unknown;
   ```

### **Modern Jest & NextAuth v5 Patterns**

**Jest Mock Best Practices**:

- Use `jest.fn<ReturnType, Parameters>()` for typed mocks
- Avoid `jest.Mocked<T>` patterns that create unsafe types
- Create individual mock functions instead of mocking entire modules
- Use `unknown` type instead of `any` where possible

**NextAuth v5 Test Patterns**:

- Dynamic imports for config files that change based on NODE_ENV
- Proper typing for provider objects and authorize functions
- ESLint disable directives for unavoidable dynamic typing scenarios

### **ESLint Rule Management**

**When to Disable Rules**:

- **Targeted disables**: Use `// eslint-disable-next-line` for specific unavoidable cases
- **Test-specific patterns**: Jest `expect` matchers that return `any` types
- **Dynamic imports**: NextAuth config loading based on environment

**Never Disable Rules**:

- **File-level disables**: Never disable rules for entire files
- **Core safety rules**: `no-unsafe-*` rules should only be disabled with justification
- **TypeScript strict rules**: Keep strict mode enabled always

### **Workflow Integration**

**During Development**:

1. **Real-time feedback**: Configure IDE to show ESLint errors immediately
2. **Incremental fixes**: Fix lint issues in the file you're currently working on
3. **Test quality**: Apply same standards to test files as production code
4. **Modern patterns**: Use latest Jest and NextAuth patterns from day one
5. **Documentation first**: Check Context7 for current library patterns before implementing fixes

**Before Committing**:

1. **Zero tolerance**: `npm run lint` must show 0 errors
2. **Full validation**: `npm run pre-commit` must pass completely
3. **Test coverage**: New tests must be properly typed and lint-clean

### **Prevention Strategies**

1. **IDE Configuration**: Set up ESLint to show errors inline while coding
2. **Git Hooks**: Pre-commit hooks prevent committing lint errors
3. **Modern Dependencies**: Keep Jest, NextAuth, and ESLint updated
4. **Knowledge Sharing**: Document patterns that work, avoid patterns that don't
5. **Regular Audits**: Monthly review of common lint issues across the codebase
6. **🔍 Use Context7 for Latest Documentation**: Always check current library patterns before implementing fixes

### **Critical: Always Check Latest Documentation with Context7**

**Before implementing fixes for library-specific issues, ALWAYS use Context7 to get the most current documentation**:

```
// Example workflow for Jest/NextAuth issues:
1. Identify the problematic library (Jest, NextAuth, React Testing Library, etc.)
2. Use Context7 to resolve the library ID: mcp__context7__resolve-library-id
3. Get current documentation: mcp__context7__get-library-docs
4. Focus on relevant topics: "testing mocks jest nextauth v5"
5. Apply the latest patterns, not outdated Stack Overflow solutions
```

**Why This Matters**:

- **NextAuth v4 → v5**: Massive API changes, old patterns cause lint errors
- **Jest v28 → v29**: New mock patterns, `jest.Mocked<T>` issues
- **React Testing Library**: Evolving best practices for component testing
- **TypeScript**: Stricter rules in newer versions

**Context7 Usage Examples**:

- `jest` → `/facebook/jest` for latest Jest patterns
- `nextauth` → `/nextauthjs/next-auth` for Auth.js v5 patterns
- `@testing-library/react` → Latest component testing practices
- `typescript` → Current TypeScript strict mode recommendations

**When to Use Context7**:

- Before refactoring test files with lint errors
- When upgrading major dependencies
- When ESLint rules change and require new patterns
- Before implementing new testing strategies

**Remember**: The goal is to never again have a "big pile of failing lints" - fix issues immediately as they appear during development, using the most current library documentation.

## **PinPoint Design Documentation (Notion)**

Key design documents are available in Notion workspace:

### **Planning Documents** (`/PinPoint/Planning/`)

- **Project Overview**: High-level project vision, user groups, basic architecture plan, cost estimates, future expansion plans
- **Feature Spec**: Detailed feature breakdown by development phase, core concepts, OPDB/PinballMap integration, MVP through post-1.0 features
- **Roadmap**: Milestone-based development plan from foundational backend through v1.0 release, current milestone status, future roadmap
- **Production Readiness Tasks**: Pre-deployment checklist and production preparation requirements

### **Core Architecture Documents** (`/PinPoint/Design Docs/`)

- **Technical Design Document**: Multi-tenant architecture, OPDB/PinballMap integration, technology stack decisions, database schema, API specifications, Kanban board implementation details
- **Testing Design Document**: Current unit-test-only approach, future integration/E2E testing strategy, test requirements by development milestone
- **Product Specification**: Complete feature requirements, user roles/permissions matrix, release 1.0 scope, post-1.0 Kanban board specifications

### **Implementation Guides** (`/PinPoint/Design Docs/`)

- **Subdomain Development Setup**: Multi-tenant subdomain routing, local development configuration, production deployment considerations
- **User Profile & Image System Implementation Plan**: Profile management and image handling architecture

These documents provide the definitive reference for project planning, architectural decisions, feature requirements, and implementation patterns. Consult them when making design decisions or implementing new features.

## **Notion MCP Server Integration**

The Notion MCP server provides comprehensive workspace management capabilities:

### **Document Management**

- `mcp__notion-mcp__API-post-search` - Search across workspace content
- `mcp__notion-mcp__API-retrieve-a-page` - Get specific page content
- `mcp__notion-mcp__API-get-block-children` - Read page content blocks
- `mcp__notion-mcp__API-post-page` - Create new pages
- `mcp__notion-mcp__API-patch-page` - Update page properties
- `mcp__notion-mcp__API-patch-block-children` - Add/modify page content

### **Database Operations**

- `mcp__notion-mcp__API-post-database-query` - Query databases with filters
- `mcp__notion-mcp__API-create-a-database` - Create new databases
- `mcp__notion-mcp__API-retrieve-a-database` - Get database schema

### **Collaboration Features**

- `mcp__notion-mcp__API-create-a-comment` - Add comments to pages
- `mcp__notion-mcp__API-retrieve-a-comment` - Read page comments

### **Use Cases for PinPoint Development**

1. **Design Documentation**: Access and update technical specifications during development
2. **Feature Planning**: Reference product specifications when implementing new features
3. **Architecture Decisions**: Consult technical design document for implementation patterns
4. **Testing Strategy**: Follow testing design document guidelines for test development
5. **Documentation Updates**: Keep design docs synchronized with code changes
