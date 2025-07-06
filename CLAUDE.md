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
- **Write Tests First:** For new backend logic and critical UI components, write failing tests before writing the implementation code.
- **Testing Stack:** Use Jest for the test runner, React Testing Library for components, and Playwright for End-to-End (E2E) tests.
- **Coverage:** Ensure new features have adequate test coverage, including:
  - **Unit Tests:** For individual functions and components.
  - **Integration Tests:** For API endpoints and component interactions.
  - **E2E Tests:** For critical user workflows (e.g., submitting an issue, managing a game).
- **Multi-Tenancy Tests:** It is absolutely critical to have integration tests that verify data segregation between different organizations.
- **Temporary Files:** When a temporary file is needed to complete a task (e.g., to pass a complex string as a command-line argument), it should be created inside a `/tmp` directory at the root of the project. This directory should be added to the `.gitignore` file.

# Development Workflow & Quality Assurance

## **Mandatory Development Workflow**

### **Before Starting Any Work**

1. **Validate Environment**: Run `npm run validate` to ensure clean starting state
2. **Check Dependencies**: Run `npm run deps:audit` to identify potential issues
3. **Start Server Safely**: Use `npm run dev:safe` instead of `npm run dev`
4. **Verify Server Health**: Run `npm run smoke-test` to confirm server responds

### **During Development**

1. **Incremental Validation**: Run `npm run typecheck` after each significant change
2. **Test Immediately**: Verify functionality works before moving to next task
3. **Small Commits**: Commit working states frequently with descriptive messages
4. **Server Health Checks**: Regularly verify `http://localhost:3000/api/health` responds

### **Before Committing (Mandatory)**

1. **Full Validation**: Run `npm run pre-commit` (includes typecheck, lint, build)
2. **Manual Testing**: Test the specific feature you implemented
3. **Server Verification**: Ensure development server starts and responds
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

1. Run `npx prisma db push` to sync schema
2. Regenerate client: `npx prisma generate`
3. If migration needed: `npx prisma migrate dev`

## **Emergency Procedures**

### **If Development is Completely Broken**

1. **Check Git Status**: `git status` to see what changed
2. **Revert Recent Changes**: `git checkout -- .` to discard unstaged changes
3. **Clean Install**: Delete `node_modules` and `package-lock.json`, run `npm install`
4. **Database Reset**: If needed, reset database and run `npm run seed`
5. **Validate Clean State**: Run `npm run validate` and `npm run build`

### **If Dependencies Are Broken**

1. **Check for Breaking Changes**: Review package changelogs
2. **Pin to Previous Version**: Update package.json to last known working version
3. **Clean Reinstall**: `rm -rf node_modules package-lock.json && npm install`
4. **Document the Issue**: Add notes to this file about problematic versions

## **Required Scripts & Commands**

### **Development Scripts**

- `npm run dev:safe` - Validates before starting development server
- `npm run validate` - Runs typecheck, lint, and format check
- `npm run validate:fix` - Runs validation and fixes issues automatically
- `npm run pre-commit` - Full validation plus build check
- `npm run smoke-test` - Verifies server health

### **Dependency Management**

- `npm run deps:check` - Shows available updates
- `npm run deps:audit` - Security and outdated package audit

### **Quality Assurance**

- `npm run typecheck` - TypeScript compilation check
- `npm run build` - Production build verification
- `npm run test` - Run all tests (when implemented)
