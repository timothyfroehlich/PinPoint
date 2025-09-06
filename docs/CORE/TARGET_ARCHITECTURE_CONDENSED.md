# PinPoint Target Architecture (Condensed)

**Last Updated**: Unknown  
**Last Reviewed**: Unknown  

_Essential architectural patterns for PinPoint's server-first, multi-tenant platform_

## Core Technology Stack

**React 19 + Next.js 15 App Router**
- Server-first: Default to Server Components, minimal Client Components
- React cache() API for request-level memoization eliminating duplicate queries  
- Server Actions for mutations, direct DB queries in Server Components
- @tsconfig/strictest with path aliases (~/lib/, ~/components/)

**UI & Styling**
- shadcn/ui (primary): Server Component compatible, Radix primitives
- Tailwind CSS v4: CSS-based config, layer isolation for MUI coexistence
- Material UI v7: CSS layers for gradual migration, no new MUI components

**Database & Auth**
- Drizzle ORM: Schema-first, type-safe queries, organization-scoped  
- Supabase SSR: @supabase/ssr with mandatory middleware, RLS policies
- PostgreSQL: Multi-tenant isolation, comprehensive Row Level Security

## Authentication Architecture

**Four-Layer Security**
1. Supabase SSR with Next.js middleware for token refresh
2. Application auth context (tRPC/Server Actions) 
3. Multi-tenant organization scoping via app_metadata
4. Database RLS policies as final enforcement layer

**Key Patterns**
- createServerClient with getAll()/setAll() cookie synchronization
- Organization context from JWT app_metadata (admin-controlled)
- Request-level auth caching with React cache() API
- Subdomain-based tenant identification

## Database Architecture

**Multi-Tenant Isolation**
- organization_id column on all tenant tables with RLS policies
- Application-layer scoping: `eq(table.organization_id, ctx.organizationId)`  
- Defense-in-depth: App queries + RLS policies + DB constraints
- Zero cross-organization data access in normal operations

**Data Access Patterns**
- Data Access Layer (DAL): Direct Drizzle queries in Server Components
- React cache() wrappers for request-level deduplication
- Strategic column selection and relational loading with `with` clause
- Authentication context through requireAuthContext()

## Application Architecture

**Server-First Component Hierarchy**  
- Route pages: async Server Components with direct DB queries
- Client islands: Precise boundaries for interactivity ("use client")
- Hybrid components: Server shell + Client islands for complex UIs
- Server Actions: React 19 useActionState + progressive enhancement

**Data Flow Patterns**
- Server Components → DAL functions → Drizzle queries → PostgreSQL
- Server Actions → validation → mutations → revalidation
- Client islands receive server props, submit via Server Actions
- Background processing with runAfterResponse() wrapper

## Security Model

**Multi-Layered Defense**
1. Next.js middleware: Global auth + tenant routing
2. tRPC procedures: Graduated security (public/protected/org-scoped)
3. Server Actions: Form validation + auth context
4. PostgreSQL RLS: Database-level enforcement
5. Application queries: Organization scoping fallback

**Permission System**
- Role hierarchy: Owner > Admin > Technician > Member  
- Permission inheritance with admin override capabilities
- UI rendering based on user permissions and context
- Generic error messages preventing information disclosure

## Directory Structure

**App Router Organization**
- `src/app/`: Feature-based routes with Server Component defaults
- `src/components/`: Domain organization (issues/, machines/, locations/)
- `src/lib/dal/`: Data Access Layer for Server Component queries
- `src/lib/actions/`: Server Actions for form handling and mutations
- Clear server/client boundaries with "use client" marking

## Testing Architecture

**Nine-Archetype System**
- Unit Tests: Pure functions, zero dependencies
- Data Access Layer Tests: Organization-scoped query validation  
- Client Island Tests: RTL patterns for interactive components
- Server Action Tests: FormData processing and auth context
- Hybrid Component Tests: Server shell + Client island integration
- Integration Tests: Cross-archetype workflow validation
- End-to-End Tests: Playwright browser automation
- RLS Tests: pgTAP database security validation
- Schema Tests: Database constraint verification

**Infrastructure**
- PGlite worker-scoped instances for integration isolation
- SEED_TEST_IDS for predictable debugging across archetypes
- Auto-generated mocks derived from actual seed data
- Progressive coverage with archetype balance enforcement

## Key Architectural Principles

**Server-First Philosophy**
- Default to Server Components unless specific interactivity needed
- Direct database queries replacing client-side data fetching
- Progressive enhancement with JavaScript as enhancement layer
- Minimal client-side state, server state as source of truth

**Multi-Tenant Security** 
- Organization boundaries enforced at every data access point
- RLS policies as secondary enforcement preventing data leakage  
- Authentication required for all protected operations
- Input validation and sanitization at all boundaries

**Performance Optimization**
- Request-level caching with React cache() API
- Strategic component hierarchy minimizing bundle size
- Database query optimization with proper indexing
- Bundle optimization through tree shaking and code splitting

**Migration Strategy**
- Gradual client-to-server architecture transition
- Component library evolution (MUI → shadcn/ui over time)
- CSS layer isolation enabling smooth style transitions  
- Feature-complete functionality maintained throughout

## Development Workflow

**Quality Gates**
- All tests pass before commits (unit, RLS, smoke, E2E)
- Pre-commit hooks: Husky + shellcheck + ESLint security
- TypeScript strictest compliance with explicit return types
- Organization scoping validation in all multi-tenant queries

**Modern Stack Integration**
- Context7 for current library documentation and patterns
- Automated archetype compliance through `/create-test` command
- Background task processing with proper error isolation
- Real-time features as focused client islands within server pages

---

**Implementation Authority**: Every architectural decision must align with the full TARGET_ARCHITECTURE.md document. This condensed version provides quick reference - consult the complete document for detailed patterns and implementation guidance.