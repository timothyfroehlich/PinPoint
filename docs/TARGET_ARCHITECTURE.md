# PinPoint Target Architecture

_The definitive architectural blueprint for PinPoint's server-first, multi-tenant issue tracking platform_

## 1. Technology Foundation

### Core Technology Stack

**React 19 with React Server Components**
- Server-first architecture as default pattern
- Client Components only for specific interactivity needs (forms, real-time updates, user interactions)
- React cache() API for request-level memoization to eliminate duplicate database queries
- React Compiler enabled for automatic optimization and performance improvements

**Next.js 15 App Router**
- Server Actions for form handling and mutations replacing client-side API calls
- Streaming and Suspense for progressive loading experiences
- Route-based code splitting with Server Component defaults
- Static generation for public-facing content, dynamic rendering for authenticated areas

**TypeScript with Strictest Configuration**
- @tsconfig/strictest for maximum type safety and early error detection
- Explicit return types for complex functions to prevent inference errors
- Path aliases (~/lib/, ~/components/) for consistent imports across the codebase
- Discriminated unions and proper type guards for runtime safety

### UI and Styling Systems

**Tailwind CSS v4 (Primary Styling)**
- CSS-based configuration replacing JavaScript config files
- Design token system using CSS custom properties for theming
- Layer-based architecture for style isolation and conflict prevention
- Performance optimization through CSS-first compilation

**shadcn/ui Component System (New Development)**
- Server Component compatible design system built on Radix UI primitives
- Consistent design language with accessibility built-in
- Component composition patterns for maximum flexibility
- TypeScript-first component architecture with proper prop types

**Material UI v7 Coexistence (Transitional)**
- CSS layer isolation strategy preventing style conflicts
- Gradual component-by-component migration approach
- Maintained for existing components during transition period
- No new MUI components in future development

### Database and Authentication

**Supabase with Server-Side Rendering**
- @supabase/ssr for proper cookie management and session handling
- Mandatory Next.js middleware for token refresh and session management
- Row Level Security (RLS) policies as primary security enforcement mechanism
- Real-time subscriptions for collaborative features and notifications

**Drizzle ORM with PostgreSQL**
- Type-safe database queries with full TypeScript integration
- Schema-first development with generated types
- Direct database access in Server Components for optimal performance
- Organization-scoped queries enforced at the application layer

### Development and Quality Assurance

**Testing Architecture**
- Vitest for unit and integration testing with ESM support
- Playwright for end-to-end testing of critical user journeys
- pgTAP for database-level RLS policy validation
- Worker-scoped PGlite instances for isolated integration testing

**Build and Development Workflow**
- Husky for pre-commit hooks ensuring code quality
- ESLint with security plugins for static analysis
- Hot reloading with sub-50ms update times in development
- Type checking and linting as quality gates before deployment

### Architectural Principles

**Server-First Design Philosophy**
- Default to Server Components for all new development
- Progressive enhancement ensuring core functionality works without JavaScript
- Minimal client-side state management with server state as source of truth
- Direct database queries in Server Components replacing client-side data fetching

**Multi-Tenant Security Model**
- Organization scoping enforced at every data access point
- RLS policies as secondary security layer preventing data leakage
- Protected procedures and Server Actions requiring authentication
- Input validation and sanitization at all application boundaries

**Performance and Scalability**
- Request-level caching with React cache() API
- Static generation for marketing and documentation pages
- Database query optimization with proper indexing and query planning
- Bundle size optimization through tree shaking and code splitting

**Migration and Coexistence Strategy**
- Gradual transition from client-heavy to server-first architecture
- Component library migration from MUI to shadcn/ui over time
- CSS layer strategy enabling smooth style system transition
- Feature-complete functionality maintained throughout migration process

## 2. Authentication & Session Management

**What**: Complete auth flow architecture from anonymous to authenticated states
**How**: Analyze current Supabase SSR patterns in server.ts, combine with user journey flows (anonymous → registration → profile management)
**Content**: SSR cookie handling, organization context storage, session refresh patterns, OAuth callback handling, user metadata structure

## 3. Database Architecture & RLS Policies

**What**: Explicit RLS policy descriptions for all tables supporting multi-tenant isolation
**How**: Map all user journeys to required data access patterns, define organization scoping, role-based access for each table
**Content**: Per-table RLS policies (organizations, users, machines, issues, comments, locations, roles), cross-organization boundaries, data sovereignty rules

## 4. Application Architecture

**What**: Server-first component hierarchy and data flow patterns
**How**: Based on migration overview's server component design, DAL patterns, and Server Actions infrastructure
**Content**: Server Component defaults, Client Island boundaries, Hybrid component patterns, cache() usage, request lifecycle

## 5. Directory Structure Map

**What**: Logical organization of codebase following RSC patterns
**How**: Combine migration overview directory plans with current structure analysis
**Content**: src/app route organization, src/components architectural separation (server/client/hybrid), src/lib organization (dal/, actions/, auth/, validation/)

## 6. Security Model

**What**: Comprehensive access control and data protection patterns
**How**: Extract from NON_NEGOTIABLES, API security patterns, and user journey access requirements
**Content**: Organization scoping enforcement, role hierarchy (admin, technician, member, owner), input validation, error handling, audit trails

## 7. Data Flow Architecture

**What**: Complete request-to-response lifecycle patterns
**How**: Map user journeys to data flows, Server Actions for mutations, direct DB queries for reads
**Content**: Route → DAL → database patterns, form submission via Server Actions, real-time updates (comments, status), background processing

## 8. UI Component Strategy

**What**: Component system architecture and design patterns
**How**: Based on shadcn/ui adoption plan and MUI coexistence strategy from migration overview
**Content**: shadcn/ui as primary system, MUI transition patterns, responsive design with Tailwind v4, accessibility requirements, progressive enhancement

## 9. File Storage & Media Handling

**What**: Asset management architecture for images, QR codes, and documents
**How**: Analyze user journeys requiring file uploads (profile pictures, issue photos, QR codes), Supabase storage patterns
**Content**: Storage bucket organization, RLS for file access, upload workflows, image optimization, QR code generation and serving

## 10. User Journey Support Architecture

**What**: How core architectural decisions support all workflow patterns
**How**: Ensure every user journey from CUJs has clear architectural support without explicitly listing them
**Content**: Anonymous access patterns, registration flows, role transitions, issue lifecycle support, machine management, organization administration

## 11. RSC Testing & Quality Architecture

**What**: Integrated testing strategy designed specifically for server-first React Server Components architecture
**How**: Based on RSC Test System Integration plan, combining pgTAP database testing, PGlite worker-scoped integration tests, Vitest unit testing, and Playwright E2E automation with seed-data-driven mock generation
**Content**: Nine RSC-adapted test archetypes, server component testing patterns, server action validation, hybrid component testing, auto-generated mock system from seed data, progressive coverage strategy with quality gates

### Test Archetype System for RSC

**Server Component Tests (Archetype 2a)**: Server-executed view function testing with database integration, multi-tenant scoping validation, performance monitoring, N+1 query detection

**Server Action Tests (New Archetype)**: FormData processing validation, authentication context propagation, database mutation verification, cache revalidation testing, progressive enhancement scenarios

**Client Island Tests (Archetype 2b)**: Traditional React Testing Library patterns for minimal interactive components, server-passed props validation, user interaction testing

**Hybrid Component Tests (Archetype 2c)**: Server shell plus client island integration testing, hydration state matching, selective hydration verification, server/client boundary data flow

**Enhanced DAL Tests (Expanded Archetype 4)**: Direct database function testing for Server Components, complex relational queries with joins, React cache() API integration, organization-scoped query validation

**Unit Tests (Archetype 1)**: Pure function testing with no database dependencies, input validation, business logic, utility functions

**Repository Tests (Archetype 3)**: Drizzle ORM operations with PGlite, transaction patterns, schema constraint validation

**API Integration Tests (Archetype 5)**: Full tRPC stack testing with mock contexts, protected procedure validation

**E2E Tests (Archetype 6)**: Playwright browser automation for complete user journeys, RSC rendering validation, progressive enhancement testing

### Database Testing Infrastructure

**pgTAP Integration**: Row Level Security policy validation, database constraint testing, SQL-level security verification, multi-tenant boundary enforcement testing

**PGlite Worker Pattern**: Memory-safe per-test database instances, schema application and rollback patterns, integration test isolation, bypasses RLS for application-layer testing

**Seed Data Architecture**: SEED_TEST_IDS for predictable debugging, hardcoded organization/user/machine identifiers, multi-tenant test scenarios, cross-organization boundary validation

### Mock Generation and Test Data

**Seed Data to Mock Bridge**: Auto-generated TypeScript mock objects from database seed data structure, type-safe mock factories based on Drizzle schema, cross-archetype consistency ensuring identical test data across unit/integration/E2E tests

**Mock Factory System**: Generated mocks for users, organizations, machines, issues, and comments, relationship-aware mock generation, realistic test scenarios based on actual seed patterns

**Test Helpers and Utilities**: Server Component rendering helpers, Server Action FormData mocking, hybrid component test utilities, database state assertion helpers

### Quality Gates and Coverage Strategy

**Progressive Coverage Targets**: Weekly coverage increase goals with archetype balance requirements, ultra-low initial thresholds focusing on foundation functions, production-ready 60%+ coverage gates for deployment

**Archetype Balance Enforcement**: Automated validation ensuring coverage across all nine test archetypes, prevents over-concentration in single archetype types, validates comprehensive testing approach

**Performance and Security Gates**: Server Component query performance monitoring, multi-tenant scoping validation, Server Action security testing, progressive enhancement verification

**Pre-commit Quality Enforcement**: All tests must pass before commits, pre-commit hooks with husky and shellcheck, no `--no-verify` commits allowed, organization scoping compliance validation

## 12. Areas Requiring Refinement

**What**: Architecture decisions that need further definition
**How**: Identify gaps where user journeys or technical requirements need more specific architectural decisions
**Content**: Real-time notification system, advanced search/filtering, analytics architecture, background job processing, audit logging

---

_This document serves as PinPoint's architectural north star. Each section will be filled with concrete architectural decisions that guide implementation without specifying implementation details._