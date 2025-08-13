# PinPoint Source Code Map

This document maps source files by subsystem/feature to help agents quickly find all relevant code for a given area of functionality.

## Core Common Files

These files are referenced across multiple subsystems and should be understood for most development work:

- **Prisma Schema**: `prisma/schema.prisma` - Original database schema (deprecated, being migrated)
- **Drizzle Schema**: `src/server/db/schema/` - New modular Drizzle schemas
  - `auth.ts` - User, Account, Session, VerificationToken
  - `organizations.ts` - Organization, Membership, Role, Permission
  - `machines.ts` - Location, Model, Machine
  - `issues.ts` - Issue, IssueStatus, IssueHistory, Comment
  - `collections.ts` - Collection, Notification, PinballMapConfig
  - `index.ts` - Relations and exports
- **Database Clients**:
  - `src/server/db.ts` - Prisma client with multi-tenant extensions
  - `src/server/db/drizzle.ts` - Drizzle client with singleton pattern
- **Database Provider**: `src/server/db/provider.tsx` - Dual-ORM provider
- **Environment**: `src/env.js` - Environment variable validation
- **Root Config**: `CLAUDE.md`, `package.json`, `tsconfig.json` - Project configuration

## Authentication & Authorization

### Frontend Components

- `src/app/auth/` - Authentication pages
- `src/app/providers.tsx` - Auth provider setup
- `src/components/auth/` - Auth-related UI components

### Backend Implementation

- `src/server/api/routers/auth.ts` - Authentication tRPC procedures
- `src/server/api/trpc.ts` - Auth middleware and procedure definitions
- `src/server/api/trpc.base.ts` - tRPC context with dual-ORM support
- `src/lib/supabase/client.ts` - Supabase client configuration
- `src/lib/supabase/server.ts` - Supabase server-side utilities
- `middleware.ts` - Request middleware for subdomain routing

### Database Models

- `User` model in src/server/db/schema/
- `Organization` model in src/server/db/schema/
- `Membership` model in src/server/db/schema/

### Tests

- `src/test/context.ts` - Auth context mocking utilities
- `src/test/mockContext.ts` - Mock database and auth context

## Issue Management System

### Frontend Components

- `src/app/(authenticated)/issues/` - Issue management pages
- `src/components/features/issues/` - Issue-specific components
- `src/components/forms/IssueForm.tsx` - Issue creation/editing form

### Backend Implementation

- `src/server/api/routers/issue.ts` - Issue CRUD operations
- `src/lib/validations/issue.ts` - Issue validation schemas
- `src/lib/permissions.ts` - Permission constants and checks

### Database Models

- `Issue` model in src/server/db/schema/
- `IssueHistory` model in src/server/db/schema/ (audit trail)

### Tests

- `src/server/api/routers/issue.test.ts` - Issue router unit tests
- `src/integration-tests/issue-management.test.ts` - Full issue workflow tests

## Machine Management

### Frontend Components

- `src/app/(authenticated)/machines/` - Machine management pages
- `src/components/features/machines/` - Machine-specific components
- `src/components/forms/MachineForm.tsx` - Machine creation/editing

### Backend Implementation

- `src/server/api/routers/machine.ts` - Machine CRUD operations
- `src/lib/validations/machine.ts` - Machine validation schemas
- `src/lib/external/opdb.ts` - OPDB integration utilities

### Database Models

- `Machine` model in src/server/db/schema/
- `Model` model in src/server/db/schema/ (OPDB machine types)

### Tests

- `src/server/api/routers/machine.test.ts` - Machine router tests
- `src/integration-tests/machine-management.test.ts` - Machine workflow tests

## Location Management

### Frontend Components

- `src/app/(authenticated)/locations/` - Location management pages
- `src/components/features/locations/` - Location-specific components

### Backend Implementation

- `src/server/api/routers/location.ts` - Location CRUD operations
- `src/lib/validations/location.ts` - Location validation schemas

### Database Models

- `Location` model in src/server/db/schema/

### Tests

- `src/server/api/routers/location.test.ts` - Location router tests

## Comment System

### Frontend Components

- `src/components/features/comments/` - Comment components
- `src/components/forms/CommentForm.tsx` - Comment creation form

### Backend Implementation

- `src/server/api/routers/comment.ts` - Comment operations with soft delete
- `src/lib/validations/comment.ts` - Comment validation

### Database Models

- `Comment` model in src/server/db/schema/ (with soft delete fields)

### Tests

- `src/integration-tests/comment.integration.test.ts` - Comment router integration tests with real database operations
- `src/integration-tests/comment-soft-delete.test.ts` - Soft delete functionality

## File Upload & Attachment System

### Frontend Components

- `src/components/features/uploads/` - File upload components
- `src/components/forms/AttachmentForm.tsx` - File attachment handling

### Backend Implementation

- `src/server/api/routers/upload.ts` - File upload operations via tRPC
- `src/lib/upload.ts` - Upload utilities and storage abstraction

### Database Models

- `Attachment` model in src/server/db/schema/

### Tests

- `src/server/api/routers/upload.test.ts` - Upload security and functionality tests

## Notification System

### Frontend Components

- `src/components/features/notifications/` - Notification UI components
- `src/app/(authenticated)/notifications/` - Notification pages

### Backend Implementation

- `src/server/api/routers/notification.ts` - Notification CRUD and delivery
- `src/lib/notifications/` - Notification trigger logic and email integration

### Database Models

- `Notification` model in src/server/db/schema/
- `NotificationPreference` model in src/server/db/schema/

### Tests

- `src/integration-tests/notification.schema.test.ts` - Notification schema tests
- `src/server/api/routers/notification.test.ts` - Notification functionality tests

## Organization & Multi-Tenancy

### Frontend Components

- `src/app/(authenticated)/settings/` - Organization settings pages
- `src/components/features/organization/` - Org-specific components

### Backend Implementation

- `src/server/api/routers/organization.ts` - Organization management
- `src/server/db.ts` - Multi-tenant Prisma extension
- `middleware.ts` - Subdomain-to-organization mapping

### Database Models

- `Organization` model in src/server/db/schema/
- `Membership` model in src/server/db/schema/ (roles and permissions)

### Tests

- `src/integration-tests/multi-tenancy.test.ts` - Tenant isolation tests
- `src/server/api/routers/organization.test.ts` - Organization operations

## User Profile Management

### Frontend Components

- `src/app/(authenticated)/profile/` - User profile pages
- `src/components/features/user/` - User-specific components

### Backend Implementation

- `src/server/api/routers/user.ts` - User profile operations
- `src/lib/validations/user.ts` - User validation schemas

### Database Models

- `User` model in src/server/db/schema/

### Tests

- `src/server/api/routers/user.test.ts` - User profile tests

## External Integrations

### OPDB Integration

- `src/lib/external/opdb.ts` - OPDB API client and data transformation
- `src/server/api/routers/opdb.ts` - OPDB sync procedures

### PinballMap Integration

- `src/lib/external/pinballmap.ts` - PinballMap API integration
- `src/server/api/routers/pinballmap.ts` - PinballMap sync procedures

### Tests

- `src/integration-tests/opdb-sync.test.ts` - OPDB integration tests
- `src/integration-tests/pinballmap-sync.test.ts` - PinballMap integration tests

## Dashboard & Analytics

### Frontend Components

- `src/app/(authenticated)/dashboard/` - Main dashboard page
- `src/components/features/dashboard/` - Dashboard widgets and charts

### Backend Implementation

- `src/server/api/routers/analytics.ts` - Analytics data aggregation
- `src/lib/analytics/` - Dashboard data calculation utilities

### Tests

- `src/integration-tests/dashboard.test.ts` - Dashboard data accuracy tests

## Development & Build System

### Configuration Files

- `eslint.config.js` - ESLint configuration
- `vitest.config.ts` - Vitest testing configuration
- `playwright.config.ts` - E2E testing setup
- `prettier.config.js` - Code formatting rules
- `next.config.js` - Next.js configuration

### Development Scripts

- `scripts/` - Development and deployment scripts
- `start-database.sh` - Local PostgreSQL startup

### Tests

- `e2e/` - End-to-end Playwright tests
- `src/test/` - Test utilities and setup files
- `src/test/vitestMockContext.ts` - Mock context with dual-ORM support

## Database Testing (Phase 2A)

### Drizzle CRUD Validation

- `src/server/db/drizzle-crud-validation.test.ts` - Comprehensive CRUD operations
- `scripts/validate-drizzle-crud.ts` - CRUD validation script

### Drizzle Integration Testing

- `src/server/api/routers/__tests__/drizzle-integration.test.ts` - tRPC + Drizzle integration

### Test Coverage

- 27 CRUD tests: INSERT, SELECT, UPDATE, DELETE, transactions
- 12 integration tests: Context validation, schema exports, error handling
- Multi-tenant isolation validation
- Transaction rollback scenarios

---

_This map is maintained by the orchestrator agent and updated after each completed task._
