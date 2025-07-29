# PinPoint Migration Guide: From Prisma + NextAuth to Supabase + Drizzle

_A System Architect's Guide for New Developers_

---

## Introduction: What You Need to Know

Welcome to the PinPoint migration project. This guide will walk you through our planned transition from our current technology stack to a more modern, scalable architecture. As someone new to PinPoint and these technologies, this document will teach you not just what we're doing, but why we're doing it and how it affects every part of our application.

This isn't just a technical migration - it's an architectural evolution that will make PinPoint faster, more secure, and easier to develop on.

---

## Understanding PinPoint's Current Architecture

### What PinPoint Does

PinPoint is a multi-tenant SaaS application for pinball machine maintenance. Think of it like a help desk system, but specifically for arcade operators managing hundreds of pinball machines across multiple locations. Each organization (like "Austin Pinball Collective") has their own isolated data - their machines, their issues, their users.

### Current Technology Stack

**Database Layer:**

- **Prisma ORM**: This is our current "translator" between our TypeScript code and PostgreSQL database. When you write `prisma.issue.findMany()`, Prisma converts that to SQL and handles all the database communication.
- **PostgreSQL**: Our actual database running on Vercel's infrastructure.

**Authentication Layer:**

- **NextAuth.js**: Handles user login/logout, OAuth with Google/GitHub, and session management. When a user logs in, NextAuth creates a session and stores it in our database.

**API Layer:**

- **tRPC**: Our type-safe API layer. Instead of REST endpoints, we have TypeScript procedures that automatically share types between frontend and backend.

**Frontend:**

- **Next.js + React**: Server-side rendered React application
- **Material-UI**: Component library for consistent UI
- **React Query + tRPC**: Handles API calls and caching

### Current Multi-Tenant Security Model

This is crucial to understand: PinPoint serves multiple organizations, but they all share the same database. Security is currently enforced at the **application level** - every database query manually includes an `organizationId` filter to ensure Austin Pinball Collective can't see Houston Arcade's data.

For example, when getting issues, our current code does this filtering in every single query:

- "Get all issues WHERE organizationId = user's organization"
- "Get machine WHERE id = machineId AND organizationId = user's organization"

This works, but it's error-prone. Forget the organizationId filter in one place, and you've got a data leak.

---

## Understanding the New Technologies

### Supabase: The Backend-as-a-Service Platform

Think of Supabase as "Firebase for PostgreSQL developers." It provides:

**Authentication Service:**

- Pre-built login forms, OAuth integration, user management
- JWT-based sessions (more on this later)
- Built-in security features like email verification, password reset

**Database Hosting:**

- Managed PostgreSQL with built-in connection pooling
- Dashboard for viewing data, managing users
- Automatic backups and scaling

**Storage Service:**

- File uploads with automatic optimization
- CDN integration for fast global delivery
- Built-in image resizing and format conversion

**Row Level Security (RLS):**

- This is the big one. RLS moves security from application code to the database level
- The database itself enforces who can see what data
- PostgreSQL examines each query and automatically adds security filters

### Drizzle ORM: The Modern Database Toolkit

Drizzle is Prisma's more modern competitor:

**Type Safety:**

- Like Prisma, but with better TypeScript integration
- Generates types from your schema, not the other way around
- Catches more errors at compile time

**Performance:**

- Much smaller bundle size (7KB vs Prisma's 50KB+)
- Faster cold starts in serverless environments
- More control over generated SQL queries

**SQL-First Approach:**

- You write SQL-like queries that are still type-safe
- Easier to optimize performance when needed
- No "magic" - you see exactly what SQL is generated

### Row Level Security (RLS): Database-Level Security

This is the most important concept to understand. Currently, our application code is responsible for security:

**Current Approach (Application-Level Security):**

1. User makes request: "Get issue #123"
2. Our tRPC procedure runs: "SELECT \* FROM issues WHERE id = 123 AND organizationId = user's org"
3. If we forget the `AND organizationId = user's org` part, we have a security bug

**New Approach (Database-Level Security with RLS):**

1. User makes request: "Get issue #123"
2. Our tRPC procedure runs: "SELECT \* FROM issues WHERE id = 123"
3. PostgreSQL examines the user's JWT token, sees their organization
4. PostgreSQL automatically adds: "AND organizationId = user's org"
5. Even if our application code has bugs, the database prevents data leaks

This is much more secure because the database enforces isolation, not our application code.

---

## Why We're Making This Change

### Problems with Current Architecture

**Security Risks:**

- Every database query must manually include organizationId filtering
- One forgotten filter = potential data leak between organizations
- Hard to audit - security logic scattered across dozens of files

**Performance Issues:**

- Prisma's large bundle size hurts serverless cold starts
- NextAuth's complex session handling adds latency
- Manual filtering in application code vs database indexes

**Developer Experience:**

- Prisma's generated client sometimes produces confusing TypeScript errors
- NextAuth's callback system is complex and hard to debug
- Testing requires extensive mocking of database operations

### Benefits of New Architecture

**Bulletproof Security:**

- Database enforces multi-tenant isolation automatically
- Impossible to accidentally leak data between organizations
- Centralized security policies are easier to audit

**Better Performance:**

- Drizzle's smaller bundle size improves cold start times significantly
- Supabase's connection pooling reduces database connection overhead
- Database-level filtering is faster than application-level filtering

**Improved Developer Experience:**

- Cleaner, more predictable API patterns
- Better TypeScript integration throughout
- Easier testing with transaction-based test isolation

**Future-Ready Architecture:**

- Built-in real-time capabilities for live updates
- Edge deployment ready for global performance
- Integrated file storage and processing

---

## The Three-Phase Migration Strategy

### Why Staged Migration?

We're not doing a "big bang" rewrite because that's extremely risky. Instead, we're migrating in three independent phases, each adding value on its own:

1. **Phase 1**: Replace authentication system (keeps all existing queries)
2. **Phase 2**: Replace database ORM (keeps all existing security model)
3. **Phase 3**: Enable database-level security (removes manual filtering)

Each phase can be rolled back independently if issues arise.

### Phase 1: Supabase Authentication (Weeks 1-2)

**What Changes:**

- Replace NextAuth.js with Supabase Auth
- Keep all Prisma queries exactly the same
- Update frontend auth components

**Why Auth First:**
Authentication is database-agnostic - Supabase auth works identically whether you use Prisma, Drizzle, or raw SQL. This lets us prove Supabase integration works before touching any database code.

**What You'll Notice:**

- **Frontend**: New login/signup forms with better UX
- **Backend**: Sessions now come from Supabase instead of NextAuth
- **Database**: No changes - all existing queries work unchanged
- **Tests**: Existing tests still pass with minimal auth mock updates

**Benefits Unlocked:**

- Better login/logout user experience
- More reliable OAuth integration (Google, GitHub)
- Simplified session management
- Built-in features like email verification, magic links

**Rollback Plan:**
If Supabase auth fails, we simply switch environment variables back to NextAuth. Since database code is unchanged, rollback is low-risk.

### Phase 2: Drizzle Migration (Weeks 3-4)

**What Changes:**

- Replace Prisma ORM with Drizzle
- Keep Supabase Auth working (it's already proven)
- Keep existing security model (manual organizationId filtering)

**Migration Strategy:**
We'll run Prisma and Drizzle queries in parallel during development, comparing results to ensure they're identical. Once we're confident in equivalence, we switch over.

**What You'll Notice:**

- **Frontend**: No changes - same data, same components
- **Backend**: Query syntax changes but logic stays the same
- **Database**: No schema changes, same security filtering
- **Tests**: Updated to mock Drizzle instead of Prisma
- **Performance**: Noticeably faster serverless cold starts

**Benefits Unlocked:**

- Significantly faster application startup times
- Better TypeScript error messages
- More control over generated SQL queries
- Smaller bundle sizes for better performance

**Rollback Plan:**
If Drizzle migration fails, we revert to Prisma client while keeping Supabase auth. Each layer is independent.

### Phase 3: Row Level Security (Weeks 5-6)

**What Changes:**

- Enable PostgreSQL Row Level Security on all tenant tables
- Remove manual organizationId filtering from application code
- Trust the database to enforce security automatically

**Migration Strategy:**
We'll enable RLS policies alongside existing application filters, test thoroughly, then gradually remove the application-level filtering once we're confident RLS is working correctly.

**What You'll Notice:**

- **Frontend**: No changes - same data, same components
- **Backend**: Simpler queries without manual organizationId filtering
- **Database**: New RLS policies enforcing automatic isolation
- **Security**: Bulletproof - even buggy code can't leak data
- **Performance**: Potentially faster due to database-level optimization

**Benefits Unlocked:**

- Automatic security enforcement at database level
- Simpler application code without manual filtering
- Better audit trail and compliance
- Foundation for advanced features like real-time updates

**Rollback Plan:**
If RLS causes issues, we disable the policies and restore manual filtering. Drizzle and Supabase auth continue working normally.

---

## How Each Phase Affects Different Parts of the Application

### Frontend Impact

**Phase 1 (Supabase Auth):**

- **Login/Signup Pages**: New Supabase auth components with better UX
- **Session Management**: useAuth hook gets user data from Supabase instead of NextAuth
- **Protected Routes**: Same logic, different session source
- **User Profile**: May get additional user metadata from Supabase

**Phase 2 (Drizzle):**

- **Data Fetching**: No changes - tRPC procedures return same data structure
- **Type Safety**: Potentially better TypeScript autocompletion
- **Performance**: Faster page loads due to improved serverless performance

**Phase 3 (RLS):**

- **User Experience**: No visible changes
- **Security**: Users see exactly the same data, but it's more securely isolated
- **Real-time Features**: Foundation laid for future live updates

### Backend API Impact

**Phase 1 (Supabase Auth):**

- **tRPC Context**: Gets user session from Supabase instead of NextAuth
- **Permission Checks**: Same logic, different session object structure
- **Organization Resolution**: Same subdomain-based logic
- **User Management**: May leverage Supabase admin APIs for user operations

**Phase 2 (Drizzle):**

- **Database Queries**: Complete rewrite of query syntax but same logic
- **Type Generation**: Better TypeScript types for database operations
- **Transaction Handling**: Improved transaction patterns
- **Query Performance**: More visibility into generated SQL

**Phase 3 (RLS):**

- **Security Logic**: Remove manual organizationId filtering
- **Query Simplification**: Cleaner, simpler database queries
- **Error Handling**: Database-level security errors vs application errors
- **Audit Logging**: Better security audit trails

### Database Impact

**Phase 1 (Supabase Auth):**

- **Schema**: No changes to existing tables
- **User Management**: May use Supabase's auth.users table alongside our User table
- **Sessions**: Sessions stored in Supabase instead of local database
- **Performance**: Same query patterns, same indexes

**Phase 2 (Drizzle):**

- **Schema**: Same tables, potentially cleaner schema definitions
- **Migrations**: Switch to Drizzle's migration system
- **Query Patterns**: Same queries, different ORM generating them
- **Indexes**: Same indexes, potentially better optimization

**Phase 3 (RLS):**

- **Security Policies**: New RLS policies on all tenant tables
- **Indexes**: New indexes optimized for RLS policy performance
- **Query Plans**: Database handles security filtering automatically
- **Audit**: Database-level security logging

### Testing Impact

**Phase 1 (Supabase Auth):**

- **Auth Mocks**: Update test mocks for Supabase session structure
- **Integration Tests**: Verify auth flows work with existing procedures
- **User Flow Tests**: Test login/logout with new auth system

**Phase 2 (Drizzle):**

- **Database Mocks**: Rewrite database mocks for Drizzle query patterns
- **Query Testing**: Parallel testing to ensure Prisma/Drizzle equivalence
- **Transaction Tests**: Test new transaction patterns

**Phase 3 (RLS):**

- **Security Tests**: Comprehensive tests for cross-organization data isolation
- **RLS Policy Tests**: Test that policies work correctly
- **Integration Tests**: Verify all features work with database-level security

### DevOps and Deployment Impact

**Phase 1 (Supabase Auth):**

- **Environment Variables**: New Supabase credentials
- **Domain Configuration**: Configure auth callbacks for production domains
- **Monitoring**: Monitor Supabase auth performance and errors

**Phase 2 (Drizzle):**

- **Build Process**: Different ORM, potentially faster builds
- **Migration Process**: Switch to Drizzle's migration runner
- **Bundle Size**: Smaller bundles, better cold start performance

**Phase 3 (RLS):**

- **Database Migrations**: Apply RLS policies to production
- **Monitoring**: Monitor RLS policy performance
- **Security Auditing**: Enhanced security logging and monitoring

---

## Key Concepts You Need to Understand

### Multi-Tenancy Architecture

PinPoint serves multiple organizations from a single application and database. This is called "multi-tenancy." Each organization's data must be completely isolated from others.

**Current Approach**: Application ensures isolation by adding WHERE clauses
**New Approach**: Database automatically ensures isolation through RLS policies

### JWT Tokens and Claims

JSON Web Tokens (JWTs) are like secure "ID cards" that contain user information:

- **Current**: NextAuth creates custom session objects
- **New**: Supabase creates standardized JWT tokens with organization info
- **RLS Usage**: Database reads JWT to determine which data user can access

### Transaction-Based Testing

Instead of mocking everything, we'll use database transactions for tests:

- Start transaction
- Run test operations (create, update, delete)
- Roll back transaction (automatic cleanup)
- No test data pollution, more realistic testing

### Database Connection Pooling

Modern applications need many database connections:

- **Current**: Each serverless function creates its own connection
- **New**: Supabase provides connection pooling to reduce overhead
- **Benefit**: Faster queries, better resource utilization

---

## Success Criteria for Each Phase

### Phase 1 Success Criteria

- All existing functionality works with Supabase auth
- Users can log in and out normally
- All tRPC procedures receive correct user sessions
- Organization resolution from subdomain works correctly
- No user experience degradation

### Phase 2 Success Criteria

- All database queries return identical results to Prisma
- All existing tests pass with Drizzle mocks
- No data inconsistencies during parallel operation
- Measurable performance improvements in development

### Phase 3 Success Criteria

- Zero cross-organization data leaks in testing
- All features work with RLS enabled
- Manual organization filtering successfully removed
- Security audit shows proper database-level isolation

---

## Risk Management

### Rollback Safety

Each phase is designed to be independently rollback-safe:

- **Phase 1**: Revert to NextAuth, no database changes
- **Phase 2**: Revert to Prisma, keep Supabase auth
- **Phase 3**: Disable RLS, keep Drizzle and Supabase auth

### Testing Strategy

We're not deleting existing tests - we're evolving them:

- **Phase 1**: Update auth mocks, keep security tests
- **Phase 2**: Update database mocks, keep business logic tests
- **Phase 3**: Add RLS tests, keep all existing functionality tests

### Performance Monitoring

While we expect performance improvements, we'll monitor:

- **Phase 1**: Auth response times, login success rates
- **Phase 2**: Query response times, cold start improvements
- **Phase 3**: RLS policy performance, query optimization

---

## What This Means for You as a Developer

### Learning Curve

**Phase 1**: Learn Supabase auth patterns, JWT structure
**Phase 2**: Learn Drizzle query syntax, TypeScript integration
**Phase 3**: Learn RLS concepts, database security models

### Day-to-Day Development

**Initially**: More complex during migration period (two systems running)
**Eventually**: Simpler, more predictable patterns
**Long-term**: Better developer experience, fewer security concerns

### Debugging Changes

**Phase 1**: Auth issues debuggable through Supabase dashboard
**Phase 2**: Database queries more transparent with Drizzle
**Phase 3**: Security logic centralized in database policies

### New Capabilities

**Immediate**: Better auth UX, improved performance
**Medium-term**: Simplified security model, easier testing
**Long-term**: Real-time features, edge deployment, global scale

---

## Timeline and Next Steps

### 6-Week Timeline

- **Weeks 1-2**: Supabase Auth integration
- **Weeks 3-4**: Drizzle ORM migration
- **Weeks 5-6**: RLS implementation and optimization

### Getting Started

1. Set up local Supabase development environment
2. Study existing PinPoint authentication flows
3. Learn Supabase auth concepts and patterns
4. Begin Phase 1 implementation

### Resources for Learning

- Supabase documentation and tutorials
- Drizzle ORM guides and examples
- PostgreSQL RLS documentation
- PinPoint codebase exploration and documentation

---

## Conclusion: A Strategic Evolution

This migration isn't just changing tools - it's evolving PinPoint's architecture to be more secure, performant, and maintainable. By understanding these concepts and following the staged approach, we'll transform PinPoint into a modern, scalable application while minimizing risk.

The key insight is that we're not rebuilding everything at once. Each phase adds value independently, and if any phase fails, we can roll back without losing progress from previous phases.

This is how professional software teams handle major architectural changes: carefully, incrementally, and with proper safety nets at every step.
