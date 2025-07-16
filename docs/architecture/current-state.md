---
status: current
last-updated: 2025-01-14
---

# PinPoint Architecture: Current State

This document describes the current implementation state of the PinPoint architecture. It serves as the authoritative reference for the actual system as built.

## Overview

PinPoint is a multi-tenant issue tracking system for pinball arcade operators, built with modern TypeScript technologies and deployed on Vercel. The system provides comprehensive machine management, issue tracking, and team collaboration features with strict data isolation between organizations.

## Technology Stack (As Implemented)

| Component          | Technology                                | Status         |
| ------------------ | ----------------------------------------- | -------------- |
| **Language**       | TypeScript                                | ✅ Implemented |
| **Framework**      | Next.js 14 (App Router)                   | ✅ Implemented |
| **UI Library**     | Material UI (MUI) v7 (yes, it's released) | ✅ Implemented |
| **Database**       | PostgreSQL                                | ✅ Implemented |
| **ORM**            | Prisma with extensions                    | ✅ Implemented |
| **Authentication** | NextAuth.js (Auth.js v5)                  | ✅ Implemented |
| **API Layer**      | tRPC                                      | ✅ Implemented |
| **File Storage**   | Local (dev) / Vercel Blob (prod)          | ✅ Implemented |
| **External APIs**  | OPDB, PinballMap                          | 🔄 In Progress |
| **Deployment**     | Vercel                                    | ✅ Implemented |

## Multi-Tenancy Architecture

### Implementation Status: ✅ Fully Implemented

The multi-tenancy system is operational with the following components:

1. **Subdomain Routing**
   - Custom Next.js middleware intercepts all requests
   - Extracts subdomain from hostname
   - Looks up organization in database
   - Rewrites request with organization context
   - See: [subdomain-development-setup.md](../design-docs/subdomain-development-setup.md)

2. **Row-Level Security**
   - Prisma extension automatically adds `organizationId` filter to all queries
   - Applied to all tenant-aware models
   - Prevents cross-tenant data access at ORM level
   - See: `src/server/db/client.ts`

3. **Organization Context**
   - Stored in server session
   - Available to all tRPC procedures
   - Used for authorization checks

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

## API Architecture (tRPC)

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
npm run pre-commit    # Must pass before commits

# Database
npm run db:reset      # Reset and reseed
npm run db:push       # Push schema changes

# Testing
npm run test:coverage # Run tests with coverage report
```

### Multi-Agent Development

- Git worktrees for parallel development
- Shared database with careful scoping
- See: [MULTI_AGENT_WORKFLOW.md](../backend_impl_tasks/MULTI_AGENT_WORKFLOW.md)

## Quality Standards

- **0 TypeScript errors** - Enforced
- **0 ESLint errors** - Enforced
- **Test Coverage** - 50% global, 60% server/, 70% lib/
- **Pre-commit hooks** - Must pass
- **Code formatting** - Prettier enforced

## Current Limitations & Planned Improvements

### Beta Limitations

1. Frontend temporarily out of compilation (being rebuilt)
2. Role management UI not implemented (API complete)
3. Email delivery not connected (notifications stored)
4. No production deployment yet

### V1.0 Planned Features

1. New frontend with all Beta features
2. Configurable RBAC management
3. Email notification delivery
4. Production deployment on Vercel
5. Subdomain support for organizations

## Key Implementation Decisions

1. **ESM Modules**: Project uses `"type": "module"` for modern JavaScript
2. **No Migrations**: Pre-production uses `db:reset` for schema changes
3. **Typed Mocks**: Tests use `jest.fn<T>()` for type safety
4. **Global Models**: OPDB data shared across organizations
5. **Soft Deletes**: Comments use soft delete with audit trail

## References

- [Backend Implementation Plan](../planning/backend_impl_plan.md) - Updated plan for the backend
- [Technical Design Document](../design-docs/technical-design-document.md) - Detailed specifications
- [Backend Implementation Tasks](../backend_impl_tasks/) - Task breakdown
- [Roadmap](../planning/roadmap.md) - Release planning
