---
status: current
last-updated: 2025-07-22
---

# PinPoint Architecture: Current State

This document describes the current implementation state of the PinPoint architecture. It serves as the authoritative reference for the actual system as built.

## Overview

PinPoint is a multi-tenant issue tracking system for pinball arcade operators, built with modern TypeScript technologies and deployed on Vercel. The system provides comprehensive machine management, issue tracking, and team collaboration features with strict data isolation between organizations.

> ⚠️ **MIGRATION IN PROGRESS**: PinPoint is actively migrating from Prisma + NextAuth to Supabase + Drizzle with database-level Row Level Security.
>
> - **Current Stack**: Dual-ORM (Prisma + Drizzle) + Supabase Auth + Application-level security
> - **Target Stack**: Drizzle ORM + Supabase (Auth, Storage, RLS) + Database-level security
> - **Progress**: Phase 1 (Supabase Auth) ✅ Complete | Phase 2A (Drizzle Foundation) ✅ Complete | Phase 2B-E 🔄 In Progress
> - **Timeline**: 2-3 week direct conversion migration (Week 1 of 3)
>
> For migration details, see [Migration Guide](/docs/migration/supabase-drizzle/)

## Technology Stack (As Implemented)

| Component          | Technology                                | Status         |
| ------------------ | ----------------------------------------- | -------------- |
| **Language**       | TypeScript                                | ✅ Implemented |
| **Framework**      | Next.js 14 (App Router)                   | ✅ Implemented |
| **UI Library**     | Material UI (MUI) v7 (yes, it's released) | ✅ Implemented |
| **Database**       | PostgreSQL                                | ✅ Implemented |
| **ORM**            | Prisma + Drizzle (dual-ORM migration)     | 🔄 Migrating   |
| **Authentication** | Supabase Auth                             | ✅ Implemented |
| **API Layer**      | tRPC (exclusive)                          | ✅ Implemented |
| **File Storage**   | Local (dev) / Vercel Blob (prod)          | ✅ Implemented |
| **External APIs**  | OPDB, PinballMap                          | 🔄 In Progress |
| **Deployment**     | Vercel                                    | ✅ Implemented |

## Multi-Tenancy Architecture

### Current State: Single-Tenant Beta → Multi-Tenant V1.0

**Beta (Current)**: Single-tenant deployment with multi-tenant-ready architecture  
**V1.0 (Planned)**: Full multi-tenant deployment with subdomain routing

The multi-tenancy system architecture is implemented with the following components:

1. **Subdomain Routing** (V1.0 Ready)
   - ✅ Custom Next.js middleware implemented
   - ✅ Subdomain extraction and organization lookup
   - ✅ Request rewriting with organization context
   - 🔄 **Beta**: Single organization deployment (bypass routing)
   - 🚀 **V1.0**: Full subdomain routing activation
   - See: [subdomain-development-setup.md](../design-docs/subdomain-development-setup.md)

2. **Row-Level Security** (Fully Active)
   - ✅ Prisma extension automatically adds `organizationId` filter to all queries
   - ✅ Applied to all tenant-aware models
   - ✅ Prevents cross-tenant data access at ORM level
   - ✅ **Beta**: Single organization filtering
   - ✅ **V1.0**: Multi-organization isolation
   - See: `src/server/db/client.ts`

3. **Organization Context** (Architecture Ready)
   - ✅ Stored in server session
   - ✅ Available to all tRPC procedures
   - ✅ Used for authorization checks
   - 🔄 **Beta**: Single organization context (Austin Pinball Collective)
   - 🚀 **V1.0**: Dynamic organization context per subdomain

## Database Schema (Current Implementation)

### Core Models

| Model            | Purpose                          | Multi-Tenant |
| ---------------- | -------------------------------- | ------------ |
| **User**         | Global user accounts             | No           |
| **Organization** | Top-level tenant                 | No           |
| **Membership**   | User-Organization link with role | Yes          |
| **Location**     | Physical venue                   | Yes          |
| **Model**        | Machine type (from OPDB)         | No\*         |
| **Machine**      | Physical machine instance        | Yes          |
| **Issue**        | Problem report                   | Yes          |
| **Comment**      | Issue discussion                 | Yes          |
| **Attachment**   | Issue images                     | Yes          |

\*OPDB models are global, custom models are organization-scoped

### RBAC Implementation

- **Roles**: Admin, Technician, Member
- **Permissions**: Granular permissions (e.g., `issue:create`, `machine:delete`)
- **Default Roles**: Created automatically for new organizations
- **Beta Status**: Fixed roles, configurable in V1.0

## API Architecture

### tRPC-First Strategy

PinPoint follows a **tRPC-exclusive API strategy**. All application endpoints are implemented as tRPC procedures, with only the following exceptions:

1. **Authentication routes** (`/api/auth/*`) - Required by NextAuth.js
2. **tRPC handler** (`/api/trpc/*`) - The tRPC endpoint itself
3. **Health check** (`/api/health`) - For monitoring tools
4. **QR redirects** (`/api/qr/*`) - For HTTP redirect responses
5. **Dev utilities** (`/api/dev/*`) - Development-only endpoints

See [API Routes Documentation](./api-routes.md) for detailed information about these exceptions.

### Router Structure

```
src/server/api/routers/
├── auth.ts          # Authentication procedures
├── issue.ts         # Issue management
├── machine.ts       # Machine operations
├── location.ts      # Location management
├── organization.ts  # Organization settings
├── user.ts          # User profile management
└── upload.ts        # File upload handling
```

### Procedure Types

1. **`publicProcedure`** - No authentication required
2. **`protectedProcedure`** - Requires authenticated user
3. **`organizationProcedure`** - Requires organization membership + permissions

### Authorization Middleware

```typescript
// Checks performed by organizationProcedure:
1. User is authenticated
2. User has membership in current organization
3. User's role has required permission
4. Organization context matches request
```

### Dual-ORM Architecture (Migration Phase)

During the migration from Prisma to Drizzle, PinPoint maintains both ORMs in parallel:

#### tRPC Context Integration

```typescript
export interface TRPCContext {
  db: ExtendedPrismaClient; // Existing Prisma client
  drizzle: DrizzleClient; // New Drizzle client
  user: PinPointSupabaseUser | null;
  supabase: SupabaseServerClient;
  organization: Organization | null;
  // ... other properties
}
```

#### Benefits

- **Gradual Migration**: Convert procedures one at a time
- **Zero Downtime**: Both ORMs work simultaneously
- **Rollback Safety**: Can revert individual procedures if needed
- **Type Safety**: Full TypeScript support for both ORMs

#### Current Status (Phase 2A Complete)

- ✅ Complete Drizzle schema with 1:1 Prisma parity
- ✅ Both clients available in all tRPC procedures
- ✅ 39 tests validate dual-ORM functionality
- 🔄 Router migrations in progress (Phase 2B-E)

### Unified Dashboard Progressive Enhancement

PinPoint implements a unified public/authenticated dashboard using a progressive enhancement pattern. This ensures a seamless user experience by:

- **Public-First Content**: Public content loads first without authentication, providing immediate value.
- **Authentication Enhancement**: Authenticated content enhances the experience when a session exists.
- **Single Page, Multiple Audiences**: A single page serves both public and authenticated use cases, adapting based on the user's authentication state.
- **Graceful Degradation**: The system gracefully handles authentication failures or logouts by defaulting to the public view, avoiding "UNAUTHORIZED" screens.

This pattern addresses common authentication flow issues, such as broken logout experiences and forced logins, by prioritizing user experience and content accessibility.

#### Implementation Pattern

```typescript
const UnifiedDashboard = () => {
  const { data: session } = useSession();
  const { data: publicOrg } = api.organization.getCurrent.useQuery(); // Always available
  const { data: privateData } = api.organization.getPrivate.useQuery(
    undefined,
    { enabled: !!session } // Only when authenticated
  );

  return (
    <Layout>
      {/* Public content - always shown */}
      <PublicOrgInfo organization={publicOrg} />
      <PublicLocationList />

      {/* Authenticated content - progressive enhancement */}
      {session && (
        <>
          <AuthenticatedDashboard data={privateData} />
          <PersonalizedContent />
        </>
      )}
    </Layout>
  );
};
```

#### API Endpoint Strategy

- **Public Endpoints**: Use `publicProcedure`, return safe public data, still scoped to organization
- **Private Endpoints**: Use `protectedProcedure`, return detailed data for authenticated users
- **Multi-tenant Scoping**: Even public endpoints are scoped to organization via subdomain resolution

#### Benefits

- **User Experience**: No "broken" logout experience, fast initial page load, graceful authentication failures.
- **SEO & Accessibility**: Public content indexable, works without JavaScript for public features, progressive enhancement improves with better browsers/connection.
- **Development Benefits**: Easier testing, clearer separation between public and private features, simpler error handling.

## Authentication & Authorization

### Current Implementation

1. **Providers**
   - Magic Link (Email)
   - Google OAuth
   - Facebook OAuth
   - Dev login (development only)

2. **Session Management**
   - JWT sessions stored in cookies
   - Organization context stored in session
   - Automatic session refresh

3. **Permission Checks**
   - Middleware-based authorization
   - Permission constants in `src/lib/permissions.ts`
   - Role-permission mappings in database

## File Storage

### Development

- Local file system storage
- Files saved to `.uploads/` directory
- Served via `/api/uploads/[filename]`

### Production (Planned)

- Vercel Blob storage
- Client-side image compression
- Direct upload to blob storage

## Notification System

### Current Status: ✅ Implemented

1. **Database Models**
   - `Notification` table with recipient, type, and metadata
   - User preferences for email/push notifications
   - Notification frequency settings

2. **Trigger Points**
   - New issue on owned machine
   - Issue assigned to user
   - Issue status changes
   - Comment mentions

3. **Delivery** (🔄 Email integration pending)
   - In-app notifications implemented
   - Email delivery infrastructure ready
   - Push notifications planned for future

## Development Workflow

### Commands

```bash
# Start development
npm run dev:full      # Recommended: all services with monitoring
npm run dev:clean     # Fresh start with database reset

# Quality checks
npm run validate      # Run before starting work
npm run validate    # Must pass before commits

# Database
npm run db:reset:local:sb   # Reset and reseed
npm run db:push:local       # Push schema changes
npm run db:seed:local:sb          # Seed data only

# Testing
npm run test:coverage # Run tests with coverage report
```

### Multi-Agent Development

- Git worktrees for parallel development
- Test-Driven Development workflow with specialized agents
- See: [Orchestrator System](../orchestrator-system/) for agent coordination

## Quality Standards

See `CLAUDE.md` for complete quality standards and development guidelines.

## Current Limitations & Planned Improvements

### Beta (Single-Tenant) Limitations

1. **Single Organization**: Fixed deployment for Austin Pinball Collective
2. **No Subdomain Routing**: Organization context bypassed/hardcoded
3. **Frontend Rebuild**: New frontend with all features (in progress)
4. **Role Management UI**: Not implemented (API complete)
5. **Email Delivery**: Not connected (notifications stored)

### V1.0 (Multi-Tenant) Transition

**Architecture Ready**:

- ✅ Multi-tenant database schema complete
- ✅ Organization-scoped queries implemented
- ✅ Permission system with organization isolation
- ✅ Subdomain middleware ready for activation

**Deployment Changes**:

1. **Subdomain Activation**: Enable full subdomain routing
2. **Organization Registration**: Self-service organization creation
3. **Multi-Tenant Frontend**: Organization-aware UI components
4. **Production Deployment**: Multi-tenant Vercel deployment
5. **Email Integration**: Multi-tenant notification delivery

## Key Implementation Decisions

1. **ESM Modules**: Project uses `"type": "module"` for modern JavaScript
2. **No Migrations**: Pre-production uses `db:reset` for schema changes
3. **Typed Mocks**: Tests use `jest.fn<T>()` for type safety
4. **Global Models**: OPDB data shared across organizations
5. **Soft Deletes**: Comments use soft delete with audit trail

## References

- [API Routes Documentation](./api-routes.md) - Legitimate API routes and tRPC strategy
- [Backend Implementation Plan](../planning/backend_impl_plan.md) - Updated plan for the backend
- [Technical Design Document](../design-docs/technical-design-document.md) - Detailed specifications
- [Orchestrator System](../orchestrator-system/) - Multi-agent coordination system
- [Source Map](source-map.md) - File organization by feature
- [Test Map](test-map.md) - Test file relationships
- [Roadmap](../planning/roadmap.md) - Release planning
