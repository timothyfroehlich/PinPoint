# PinPoint Target Architecture

**Last Updated**: September 2, 2025
**Last Reviewed**: September 2, 2025

_The definitive architectural blueprint for PinPoint's server-first, multi-tenant issue tracking platform_

## Table of Contents

1. [Technology Foundation](#1-technology-foundation)
2. [React Compiler Architecture](#2-react-compiler-architecture)
3. [Authentication & Session Management](#3-authentication--session-management)
4. [Organization Context Resolution](#4-organization-context-resolution)
5. [Database Architecture & RLS Policies](#5-database-architecture--rls-policies)
6. [Advanced Error Handling](#6-advanced-error-handling)
7. [Application Architecture](#7-application-architecture)
8. [Directory Structure Map](#8-directory-structure-map)
9. [Security Model](#9-security-model)
10. [Data Flow Architecture](#10-data-flow-architecture)
11. [UI Component Strategy](#11-ui-component-strategy)
12. [Progressive Enhancement Architecture](#12-progressive-enhancement-architecture)
13. [File Storage & Media Handling](#13-file-storage--media-handling)
14. [User Journey Support Architecture](#14-user-journey-support-architecture)
15. [RSC Testing & Quality Architecture](#15-rsc-testing--quality-architecture)
16. [Areas Requiring Refinement](#16-areas-requiring-refinement)

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

**Material Design 3 Color System (Primary Color Strategy)**

- Google's Material Color Utilities (`@material/material-color-utilities`) for scientific color generation
- HCT (Hue, Chroma, Tone) color space providing perceptually accurate color relationships
- Dynamic color palette generation from single purple source color (`#6750A4`)
- Automatic generation of primary, secondary, tertiary, and surface color families
- Built-in accessibility compliance with proper contrast ratios between all color pairs
- Surface color variants (surface-container-low, surface-container, etc.) for navigation and component backgrounds
- Light and dark theme variants generated from same source with consistent color relationships
- CSS custom properties integration with Tailwind v4's CSS-based configuration
- Color role system ensuring proper text/background contrast (on-primary, on-surface, etc.)
- 2025 specification compliance with latest Material Design 3 algorithms

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

## 2. React Compiler Architecture

### Core React Compiler Integration

**Build-Time Optimization Foundation**

- React Compiler provides automatic memoization without manual intervention through build-time code transformation
- Eliminates need for manual `useMemo`, `useCallback`, and `React.memo` patterns while maintaining optimal performance
- Analyzes component dependencies at build time and generates optimized code with runtime checks using `react/compiler-runtime`
- Only optimizes code that follows React's rules, safely skipping problematic components rather than failing builds

**Server Components Optimization Strategy**

- Perfect compatibility with Next.js 15 Server Components enabling automatic memoization of server-side data fetching
- Optimized component rendering on both server and client with intelligent caching strategies
- Compatible with async Server Components patterns and request-level memoization using React 19 cache() API
- Hybrid architecture support optimizing both server data fetching and client interactivity boundaries

### Automatic Performance Optimization Patterns

**Request-Level Memoization Integration**

- Seamless integration with React 19 cache() API for request-scoped caching in Server Components
- Eliminates duplicate database queries within single request lifecycle through compiler-generated cache wrappers
- Memory-efficient query patterns with automatic cleanup after request completion perfect for SSR environments
- Performance benefits include re-render prevention, computation memoization, and optimized memory management

**Intelligent Code Generation**

```typescript
// Compiler automatically transforms this:
function ExpensiveComponent({ organizationId }) {
  const processedData = heavyComputation(organizationId);
  return <div>{processedData}</div>;
}

// Into optimized version with runtime memoization:
function ExpensiveComponent({ organizationId }) {
  const $ = _c(2);
  let processedData;
  if ($[0] !== organizationId) {
    processedData = heavyComputation(organizationId);
    $[0] = organizationId;
    $[1] = processedData;
  } else {
    processedData = $[1];
  }
  return <div>{processedData}</div>;
}
```

### Build Integration and Configuration

**Next.js 15 Configuration Architecture**

```javascript
// next.config.js - React Compiler integration
const nextConfig = {
  experimental: {
    reactCompiler: true, // Enable automatic optimization
  },
};
```

**Production-Safe Compilation Strategy**

- `panicThreshold: 'none'` configuration skips problematic components instead of failing builds
- Selective compilation using `compilationMode: 'annotation'` for controlled rollout and gradual adoption
- Directory-based compilation control enabling phased deployment and feature flag integration
- Comprehensive error logging and monitoring integration for production deployment validation

### Development Experience and Debugging

**Three-Tiered Debugging Architecture**

- Build-time errors indicate severe Rules of React violations requiring immediate attention
- Runtime behavioral changes often reveal subtle Rules of React violations requiring investigation
- Performance monitoring tracks over-memoization cases and bundle size impact for optimization decisions

**Debugging Tools and Escape Hatches**

```javascript
// Temporary debugging escape hatch
function ProblematicComponent() {
  "use no memo"; // Disable compilation for debugging
  // Component implementation
}

// Detailed logging configuration
module.exports = {
  plugins: [
    [
      "babel-plugin-react-compiler",
      {
        logger: {
          logEvent(filename, event) {
            if (event.kind === "CompileError") {
              console.error(`Compilation failed: ${filename}`);
              console.error(`Reason: ${event.detail.reason}`);
            }
          },
        },
      },
    ],
  ],
};
```

### TypeScript Integration and Compatibility

**Full TypeScript Support Architecture**

- Seamless integration with TypeScript strictest configuration without requiring code changes
- Automatic type inference preservation while adding memoization optimizations
- Compatible with complex generic types and discriminated unions used throughout the codebase
- Type-safe optimization ensuring no runtime type errors introduced through compilation

**Component Type Preservation**

```typescript
interface ComplexProps {
  organizationId: string;
  onUpdate: (data: ComplexData) => Promise<void>;
  filters: IssueFilters;
}

// Compiler preserves all type information while optimizing
function TypedComponent({ organizationId, onUpdate, filters }: ComplexProps) {
  // Automatic optimization without losing type safety
  const processedData = processComplexData(organizationId, filters);
  return <ComplexUI data={processedData} onUpdate={onUpdate} />;
}
```

### Performance Monitoring and Bundle Impact

**Bundle Size Analysis and Management**

- Compiler runtime adds approximately 1.11kB to bundle size for memoization infrastructure
- Potential bundle reduction through elimination of manual memoization patterns
- Net bundle impact depends on existing memoization patterns and can be monitored through build analytics
- Selective compilation strategies available for bundle size optimization when needed

**Performance Metrics Integration**

```typescript
// Track compiler impact on performance
function trackCompilerMetrics() {
  performance.mark("component-render-start");
  // Component rendering with compiler optimizations
  performance.mark("component-render-end");

  const measure = performance.measure(
    "component-render",
    "component-render-start",
    "component-render-end",
  );

  // Monitor compiler performance impact
  reportMetrics("react-compiler", measure.duration);
}
```

### Error Handling and Production Resilience

**Comprehensive Error Architecture**

- Build-time error handling with graceful fallback to unoptimized code when compilation fails
- Runtime error boundaries specifically designed to handle compiler-related issues
- Production error monitoring with correlation IDs for tracking compiler-related runtime issues
- Automatic rollback mechanisms for problematic component optimizations in production

**Error Monitoring Integration**

```typescript
// Production error boundary for compiler issues
function CompilerErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        if (error.message.includes('compiler-runtime')) {
          reportCompilerIssue(error, errorInfo, {
            context: 'compiler-optimization',
            severity: 'medium'
          });
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### Production Deployment Strategy

**Incremental Adoption Architecture**

- Phase 1: Annotation mode with feature flags for controlled component-level rollout
- Phase 2: Directory-based compilation enabling module-level optimization deployment
- Phase 3: Full inference mode with comprehensive monitoring and automatic fallback capabilities
- Rollback readiness with immediate compilation disable capability for emergency situations

**Feature Flag Integration**

```typescript
// Production-ready feature flag implementation
export function shouldUseReactCompiler(): boolean {
  return (
    process.env.REACT_COMPILER_ENABLED === "true" &&
    !isBot(navigator.userAgent) && // Skip optimization for bots
    Math.random() < parseFloat(process.env.COMPILER_ROLLOUT_PERCENTAGE || "0.5")
  );
}
```

### Integration with PinPoint Architecture

**Server Component Optimization Alignment**

- Perfect integration with PinPoint's server-first architecture optimizing data access layer performance
- Automatic memoization of organization-scoped queries preventing duplicate database operations
- Request-level cache() API enhancement through compiler optimizations reducing server response times
- Multi-tenant data access optimization ensuring consistent performance across organizational boundaries

**Security and Multi-Tenant Considerations**

- Compiler optimizations maintain organization scoping boundaries without compromising security
- Authentication context memoization optimization while preserving security validation requirements
- RLS policy enforcement compatibility with compiler optimizations ensuring data isolation integrity
- Performance improvements that enhance rather than compromise multi-tenant security architecture

## 3. Authentication & Session Management

### Core Authentication Architecture

**Four-Layer Authentication Stack**

- **Layer 1**: Supabase SSR foundation with @supabase/ssr client management
- **Layer 2**: Next.js middleware for automatic token refresh and session synchronization
- **Layer 3**: Application authentication context (tRPC procedures, Server Actions)
- **Layer 4**: Multi-tenant organization scoping with automatic context resolution

**Session Management Pattern**

- Mandatory Next.js middleware for token refresh using createServerClient from @supabase/ssr
- Cookie synchronization using required getAll()/setAll() pattern (never individual cookie operations)
- Chunked cookie management for large sessions with automatic cleanup
- Request-level authentication caching using React 19 cache() API

### User Journey Authentication Flows

**Anonymous to Authenticated Transition**

- OAuth provider integration with mandatory auth callback route at /auth/callback
- Registration flow with automatic organization assignment via app_metadata
- Email verification with seamless redirect handling across development and production environments
- Progressive user profile completion with organization context establishment

**Organization Context Resolution**

- Subdomain-based tenant identification with automatic organization mapping
- User app_metadata storage for secure organization assignment (admin-controlled, not user-editable)
- Organization membership validation with role-based access control integration
- Automatic context repair for users with broken or missing organization associations

### Server-Side Rendering Authentication Patterns

**Supabase SSR Client Configuration**

- Server Components use createServerClient with proper cookie handling for read operations
- Browser Components use createBrowserClient for interactive authentication flows
- Server Actions implement authentication validation with form processing and revalidation
- Error boundaries handle authentication failures with appropriate redirects

**Cookie Handling and Security**

- Mandatory getAll()/setAll() cookie pattern prevents session desynchronization
- Secure cookie configuration with proper domain, path, and security flags
- Session persistence across server/client boundaries with automatic refresh
- Protection against cookie injection and session fixation attacks

### Multi-Tenant Authentication Architecture

**Organization Scoping Enforcement**

- User app_metadata contains secure tenant_id assignment managed by admin functions only
- Organization context propagation through Server Components and Server Actions
- RLS helper functions extract tenant context from JWT tokens for database policy enforcement
- Automatic scoping validation ensures users can only access their organization's resources

**Role-Based Access Control Integration**

- User roles stored in app_metadata with organization-scoped permissions
- Permission checking at application layer before database access
- Role hierarchy enforcement (owner > admin > technician > member)
- Permission inheritance and delegation patterns for organizational flexibility

### Performance and Security Optimizations

**Request-Level Authentication Caching**

- React 19 cache() API wrapper for getUser() calls preventing duplicate authentication requests
- Shared authentication context across Server Components within single request lifecycle
- Optimized auth checks with early returns for unauthenticated states
- Memory-efficient session validation with automatic cleanup

**Security Boundaries and Validation**

- Authentication verification required for all protected routes and API endpoints
- Input validation and sanitization for all authentication-related form submissions
- Secure redirect handling with whitelist validation and origin verification
- Session integrity checks with automatic logout on suspicious activity

### RSC Migration Authentication Patterns

**Server Component Authentication**

- Direct Supabase client usage in Server Components with async/await patterns
- Authentication prop passing from authenticated layout components to child components
- Organization context injection at layout level for automatic scoping
- Error handling with appropriate fallback states and redirect flows

**Client Island Authentication Boundaries**

- Minimal Client Components for interactive authentication features (login forms, profile updates)
- Server-passed authentication props to client islands for secure context sharing
- Hybrid authentication patterns combining server validation with client interactivity
- Progressive enhancement ensuring core functionality works without JavaScript

**Server Actions Authentication Integration**

- Form-based authentication flows with proper validation and error handling
- Background authentication processing with revalidatePath and redirect patterns
- Integration with data mutation workflows requiring authentication context
- Type-safe authentication context propagation through Server Action parameters

## 4. Organization Context Resolution

### Global (Root/Apex) Context

If no subdomain is present, the route operates in global context. No organization membership lookup or org-scoped queries should be performed. Only public/global data may be accessed. Org-scoped functions must assert presence of organizationId and fail loudly if absent.

### Multi-Tenant Organization Context Architecture

**Request-Time Organization Resolution Strategy**

- Subdomain-based tenant identification with automatic organization mapping for pre-authentication context establishment
- DNS-based tenant isolation providing inherent security boundaries and simplified routing without manual tenant filtering
- Wildcard subdomain architecture enabling scalable multi-tenant deployment with automatic certificate management
- Request-level organization context binding through Next.js middleware with header-based context propagation

**Advanced Subdomain-Based Resolution Patterns**

```typescript
// middleware.ts - Extract organization from subdomain
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const subdomain = host?.split(".")[0];

  // Set organization context in request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-organization-context", subdomain || "default");

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
```

### React 19 Cache Integration for Context Resolution

**Request-Scoped Organization Context Caching**

```typescript
import { cache } from "react";

// Request-scoped organization resolution with React 19 cache API
export const getOrganizationContext = cache(async () => {
  const headers = await import("next/headers");
  const orgContext = (await headers.headers()).get("x-organization-context");

  if (!orgContext) {
    throw new OrganizationContextError("No organization context found");
  }

  return await validateAndResolveOrganization(orgContext);
});

// Cached organization-aware data fetching
export const getOrganizationData = cache(async (orgId: string) => {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, orgId),
  });
});
```

**Performance Benefits of Request-Level Memoization**

- Eliminates duplicate authentication queries within single request lifecycle
- Organization context resolved once per request with automatic cache invalidation between requests
- Database query deduplication preventing N+1 organization validation patterns
- Memory-efficient context management with automatic cleanup after request completion

### Supabase SSR Integration with Organization Context

**Enhanced Authentication with Organization Binding**

```typescript
import { createServerClient } from "@supabase/ssr";

export async function createOrganizationAwareClient() {
  const cookies = await import("next/headers").then((m) => m.cookies());

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const organizationId = user?.app_metadata?.organizationId;

  if (!organizationId) {
    throw new OrganizationContextError("User lacks organization context");
  }

  return { supabase, organizationId, user };
}
```

**JWT-Based Organization Context Security**

- Organization assignment stored in app_metadata field controlled exclusively by service role preventing user tampering
- RLS policies automatically read organization context from JWT tokens for database-level enforcement
- Multi-organization user membership support with role-specific permissions per organizational context
- Automatic context validation and repair mechanisms for users with broken organization associations

### Server Components Organization Scoping

**Next.js 15 Server Components with Organization Context**

```typescript
// Server Component with organization scoping
export default async function IssuesPage() {
  const { organizationId } = await getOrganizationContext()
  const issues = await getOrganizationData(organizationId)

  return <IssuesList issues={issues} />
}

// Context propagation through component hierarchy
export default async function OrganizationLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { organization, user } = await getOrganizationContext()

  return (
    <div>
      <OrganizationHeader organization={organization} />
      <OrganizationProvider organizationId={organization.id}>
        {children}
      </OrganizationProvider>
    </div>
  )
}
```

**Client Island Integration for Organization-Aware Interactions**

```typescript
'use client'
export function OrganizationProvider({
  children,
  organizationId
}: {
  children: React.ReactNode
  organizationId: string
}) {
  const [orgContext] = useState(organizationId)

  return (
    <OrganizationContext.Provider value={orgContext}>
      {children}
    </OrganizationContext.Provider>
  )
}
```

### Database Query Scoping and RLS Integration

**Hybrid RLS Approach for Multi-Tenant Security**

```sql
-- Organization-scoped RLS policy
CREATE POLICY tenant_isolation ON issues
  FOR ALL
  TO authenticated
  USING (organization_id = current_setting('app.current_organization_id'));

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
```

**Application-Layer Enhancement with Drizzle Integration**

```typescript
// Drizzle with organization context binding
export async function withOrgRLS<T>(
  db: DrizzleClient,
  organizationId: string,
  fn: (tx: DrizzleClient) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Bind organization context for RLS
    await tx.execute(
      sql.raw(
        `SET LOCAL app.current_organization_id = '${organizationId.replace(/'/g, "''")}'`,
      ),
    );
    return await fn(tx);
  });
}
```

### Security Boundaries and Multi-Organization Management

**Defense-in-Depth Organization Validation**

```typescript
export async function validateOrganizationAccess(
  userId: string,
  requestedOrgId: string,
): Promise<OrganizationContext> {
  // Multi-layer validation pipeline
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.user_id, userId),
      eq(memberships.organization_id, requestedOrgId),
    ),
  });

  if (!membership) {
    throw new UnauthorizedError("No membership found");
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, requestedOrgId),
  });

  if (!organization?.is_active) {
    throw new OrganizationSuspendedError("Organization inactive");
  }

  return { organization, membership };
}
```

**Multi-Organization User Membership Handling**

```typescript
// Organization switching with subdomain-based routing
export async function switchOrganization(
  userId: string,
  targetOrgId: string,
): Promise<{ redirectUrl: string }> {
  await validateOrganizationAccess(userId, targetOrgId);
  await updateUserOrganization(userId, targetOrgId);

  const org = await getOrganization(targetOrgId);
  const redirectUrl = `https://${org.subdomain}.${process.env.BASE_DOMAIN}`;

  return { redirectUrl };
}
```

### Context Repair and Error Recovery Architecture

**Graceful Context Recovery Mechanisms**

```typescript
export async function repairOrganizationContext(
  user: User,
): Promise<OrganizationContext | null> {
  try {
    // Try current app_metadata first
    const orgId = user.app_metadata?.organizationId;
    if (orgId) {
      const context = await validateOrganizationAccess(user.id, orgId);
      return context;
    }

    // Find user's default organization
    const defaultMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.user_id, user.id),
        eq(memberships.is_active, true),
      ),
      orderBy: desc(memberships.created_at),
    });

    if (defaultMembership) {
      await updateUserOrganization(user.id, defaultMembership.organization_id);
      return await validateOrganizationAccess(
        user.id,
        defaultMembership.organization_id,
      );
    }

    return null;
  } catch (error) {
    console.warn("Context repair failed:", error);
    return null;
  }
}
```

**Progressive Degradation for Context Failures**

```typescript
export async function getOrganizationContextWithFallback(): Promise<OrganizationContext | null> {
  try {
    return await getOrganizationContext();
  } catch (error) {
    if (error instanceof OrganizationContextError) {
      const user = await getCurrentUser();
      if (user) {
        return await repairOrganizationContext(user);
      }
    }

    console.error("Organization context resolution failed:", error);
    return null;
  }
}
```

### Performance Optimization and Monitoring

**Request-Level Performance Patterns**

- React 19 cache() API eliminates duplicate organization resolution queries within single request
- Connection pool optimization with organization context persistence across connection reuse
- Strategic organization context propagation minimizing validation overhead while maintaining security
- Database query optimization with organization-first filtering and proper indexing strategies

**Organization Context Monitoring Integration**

```typescript
// Track organization context resolution performance
export async function monitoredOrganizationResolution(
  requestId: string,
): Promise<OrganizationContext> {
  const startTime = performance.now();

  try {
    const context = await getOrganizationContext();

    const duration = performance.now() - startTime;
    trackMetric("organization_context_resolution", duration, {
      requestId,
      organizationId: context.organization.id,
      success: true,
    });

    return context;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackMetric("organization_context_resolution", duration, {
      requestId,
      success: false,
      error: error.message,
    });
    throw error;
  }
}
```

### Integration with PinPoint Multi-Tenant Architecture

**Seamless Security Layer Integration**

- Organization context resolution integrates seamlessly with existing RLS policies providing defense-in-depth security
- Authentication layer enhancement without compromising existing security boundaries or validation requirements
- Multi-tenant data access patterns enhanced with automatic organization context injection and validation
- Performance optimization through request-level caching while maintaining strict organizational isolation requirements

**Scalability and Operational Excellence**

- Subdomain-based routing enables horizontal scaling with organization-specific deployment strategies when needed
- Monitoring and observability integration providing insights into organization context resolution performance and failure patterns
- Automated error recovery mechanisms ensuring system resilience during organizational membership changes
- Integration points for external systems while preserving organizational boundaries and security requirements

## 5. Database Architecture & RLS Policies

### Core Database Architecture

**Multi-Tenant PostgreSQL Foundation**

- PostgreSQL with Supabase SSR integration for authentication and real-time capabilities
- Drizzle ORM as exclusive database abstraction layer with full TypeScript integration
- Organization-first schema design with strict tenant isolation at database level
- Performance-optimized indexing strategy with organization_id primary filtering on all multi-tenant tables

**Schema-First Development Pattern**

- Database schema defines source of truth for all data structures and relationships
- Generated TypeScript types ensure compile-time safety and API consistency
- Immutable schema approach during pre-beta development phase with code adapting to schema
- Comprehensive relational integrity with foreign key constraints respecting organization boundaries

### Multi-Tenant Isolation Architecture

**Organization Boundary Enforcement**

- Primary isolation mechanism through organization_id column on all multi-tenant tables with dedicated indexing
- Compound foreign key relationships ensuring cross-table organization consistency
- Application-layer organization context propagation through Server Components and Server Actions
- Defense-in-depth security with RLS policies as secondary enforcement layer

**Data Sovereignty Model**

- Complete tenant data isolation preventing cross-organization data access or leakage
- User membership model allowing single user access to multiple organizations with role-specific permissions
- Organization-scoped configuration and customization including custom roles, issue statuses, and priorities
- Cross-organization boundary validation in all data access patterns with explicit denial of unauthorized access

### Comprehensive Row-Level Security Policies

**Authentication-Based Access Control**

- All multi-tenant tables require authenticated user context through Supabase JWT token validation
- Organization context extraction from JWT claims app_metadata for automatic tenant scoping
- Session-based security with automatic token refresh and validation through Next.js middleware
- Unauthenticated access patterns for anonymous issue reporting with automatic organization assignment

**Per-Table RLS Policy Specifications**

**Organizations Table**

- Policy: Authenticated users access only organizations where they hold active membership
- Enforcement: Membership table lookup validation with role-based filtering
- Anonymous Access: Public organization discovery for subdomain resolution and registration flows
- Administrative Control: Organization owners and admins can modify organization settings and membership

**Users Table**

- Policy: Users access their own profile data plus users within shared organizations based on membership permissions
- Enforcement: Compound membership validation across all user organizations with role-based visibility controls
- Profile Management: Self-profile editing with organization context preservation and cross-organization profile consistency
- Privacy Controls: User preference enforcement for notification settings and profile visibility

**Memberships Table**

- Policy: Users access only their own membership records plus members of organizations they belong to with appropriate role permissions
- Enforcement: Role hierarchy validation with admin and owner level access to organization membership management
- Membership Lifecycle: Creation requires invitation or self-registration with organization approval workflows
- Role Transitions: Membership role changes require appropriate permissions with admin override capabilities

**Roles and Permissions Tables**

- Policy: Organization-scoped role definitions accessible to members with role visibility permissions
- Enforcement: System roles (Admin, Member) globally accessible with custom roles requiring organization membership
- Permission System: Global permission definitions with organization-specific role assignments and custom role creation
- Role Hierarchy: Owner > Admin > Technician > Member permission levels with inheritance and delegation patterns

**Machines Table**

- Policy: Organization-scoped machine access with location-based filtering for technicians and public visibility for members
- Enforcement: Location membership validation for technician access with organization-wide visibility for administrative roles
- QR Code Access: Anonymous QR code scanning with automatic organization context resolution and issue reporting capabilities
- Machine Ownership: Organization-level machine management with location assignment and maintenance scheduling

**Issues Table**

- Policy: Organization-scoped issue access with creator visibility, assignee access, and role-based administrative permissions
- Enforcement: Issue creator, assigned technician, and administrative role access with organization membership validation
- Anonymous Reporting: Anonymous issue creation with QR code scanning and automatic organization assignment
- Issue Lifecycle: Status progression controls with role-based approval workflows and administrative override capabilities

**Comments Table**

- Policy: Issue-based comment access following parent issue permissions with commenter identification and administrative moderation
- Enforcement: Parent issue access validation with comment creator identification and organization membership verification
- Comment Moderation: Administrative deletion and editing capabilities with audit trail preservation and role-based moderation controls
- Privacy Controls: Comment visibility based on issue permissions with organization-wide administrative oversight

**Locations Table**

- Policy: Organization-scoped location access with technician assignment validation and member visibility for issue reporting
- Enforcement: Location membership for technicians with organization-wide visibility for members and administrative roles
- PinballMap Integration: Public location data synchronization with organization-specific location management and customization
- Geographic Access: Location-based filtering for mobile technician workflows with GPS-based proximity access controls

**Collections and Collection Types Tables**

- Policy: Organization-scoped collection management with creator permissions and administrative oversight capabilities
- Enforcement: Collection creator access with organization-wide visibility for members and administrative management for owners
- Collection Types: Organization-specific categorization with global type definitions and custom type creation capabilities
- Machine Relationships: Collection machine assignments respecting organization boundaries with cross-collection machine management

**Notifications Table**

- Policy: User-specific notification access with organization context validation and cross-organization notification aggregation
- Enforcement: Recipient user validation with organization membership context and role-based notification filtering
- Notification Types: System notifications, issue updates, and organizational announcements with user preference enforcement
- Delivery Controls: Real-time delivery through Supabase subscriptions with email and in-app notification coordination

**Attachments and File Storage Tables**

- Policy: Issue-based attachment access following parent issue permissions with file ownership validation and organization storage quotas
- Enforcement: Parent entity access validation with file creator identification and organization membership verification for file access
- Storage Security: Organization-scoped file storage with access control through Supabase Storage RLS integration
- File Lifecycle: Automatic cleanup and archival based on parent entity lifecycle with administrative control over file management

### Cross-Organization Data Access Rules

**Strict Tenant Isolation**

- Zero cross-organization data access in normal operations with explicit denial of unauthorized cross-tenant queries
- User context switching between organizations requires explicit membership validation and role verification
- Global reference data (permissions, model definitions) accessible across organizations with proper attribution and versioning
- Integration data (PinballMap) shared across organizations with organization-specific configuration and customization layers

**Administrative Override Patterns**

- Super-admin roles for platform administration with audit logging and limited scope for debugging and support
- Cross-organization reporting capabilities for platform analytics with anonymized data aggregation and privacy preservation
- Data portability support for organization migration with complete data export and import validation
- Compliance and audit access patterns for regulatory requirements with restricted scope and comprehensive logging

### Database Performance and Security Architecture

**Query Optimization Strategy**

- Organization-first filtering in all multi-tenant queries with automatic query plan optimization and index utilization
- React cache API integration for request-level deduplication preventing duplicate database queries within single request lifecycle
- Strategic relational loading with explicit column selection and join optimization for complex multi-table queries
- Pagination patterns with offset-based limits and efficient counting strategies for large datasets

**Security Monitoring and Validation**

- Comprehensive audit trail for all data modifications with user identification and organization context preservation
- RLS policy validation through pgTAP automated testing ensuring multi-tenant boundary enforcement correctness
- Query performance monitoring with N+1 query detection and automatic optimization recommendations
- Database constraint enforcement with foreign key validation and data integrity verification across organization boundaries

**Backup and Recovery Architecture**

- Organization-scoped backup strategies with point-in-time recovery capabilities and cross-region redundancy
- Data retention policies with organization-specific customization and automated archival of inactive data
- Disaster recovery procedures with organization priority handling and progressive restoration capabilities
- Data privacy compliance with organization-level data purging and export capabilities for regulatory requirements

## 4. Application Architecture

### Core Server-First Component Hierarchy

**React Server Components as Default Pattern**

- All route pages and layout components implement Server Components with async function patterns
- Default pattern: `export default async function PageComponent()` for all new page development
- Server Components handle authentication validation, data fetching, and initial rendering server-side
- Client Components ("use client") limited to specific interactivity boundaries requiring user interaction

**Page Component Architecture**

- Route entry points perform server-side authentication checks using `getSupabaseUser()` before rendering
- Server Components execute redirect logic and error handling at the route level
- Metadata generation handled server-side with `generateMetadata` functions for SEO optimization
- Server pages pass server-fetched data as props to child components for optimal performance

### Client Island Architecture

**Precise Client Component Boundaries**

- Interactive forms using React 19 `useActionState` and `useFormStatus` for enhanced user experience
- Navigation interactions including mobile toggles, user menus, and dropdown components
- Complex stateful UI requiring real-time updates, filtering, or user selection management
- shadcn/ui interactive components requiring client-side event handling and state management

**Client Island Integration Patterns**

- Client Components receive server-passed props for initial state and configuration
- Form submissions handled through Server Actions with progressive enhancement
- Client state management limited to UI interactions with server state as source of truth
- Real-time features implemented as focused client islands within server-rendered pages

### Data Access Layer (DAL) Architecture

**Request-Level Caching and Performance**

- All DAL functions wrapped with React 19 `cache()` API for request-level memoization
- Authentication context functions (`requireAuthContext()`, `getServerAuthContext()`) cached per request
- Default value queries (`getDefaultStatus()`, `getDefaultPriority()`) use cache() for performance optimization
- Cross-layer cache consistency prevents duplicate database queries within single request lifecycle

**Organization-Scoped Query Patterns**

- Every multi-tenant query enforces organization boundary validation with `eq(table.organization_id, organizationId)`
- DAL functions receive organization context through authenticated context resolution
- Selective column queries with explicit `columns` specification for performance optimization
- Optimized relational loading using Drizzle `with` clause for complex multi-table data requirements

**Authentication Integration and Error Handling**

- DAL functions use `requireAuthContext()` for automatic user and organization context resolution
- Descriptive error messages for not found scenarios and access denied situations
- Type-safe database operations with proper TypeScript integration throughout data layer
- Performance monitoring with N+1 query prevention through strategic relational loading

### Server Actions Infrastructure

**React 19 Compatibility and Form Handling**

- Server Actions return `ActionResult<T>` types compatible with `useActionState` hook patterns
- Enhanced Zod schema validation with detailed field-level error messages for user feedback
- Progressive enhancement ensuring core functionality works without JavaScript execution
- Form processing with comprehensive validation, organization scoping, and error recovery

**Background Processing and Cache Management**

- `runAfterResponse()` pattern for analytics, notifications, and non-critical operations
- Granular cache invalidation using `revalidatePath()` and `revalidateTag()` for optimal performance
- Parallel database queries using `Promise.all()` for default values and optimization scenarios
- Background task integration with proper error handling and logging for debugging

### Hybrid Component Patterns

**Server Component Data + Client Component Interaction**

- Server Components handle data fetching with direct database access through DAL functions
- Client Components receive server-fetched data as props for interactive features and user experiences
- Form integration where server pages provide data context to client forms for submission workflows
- Navigation systems combining server-rendered structure with client islands for mobile and user interactions

**Progressive Enhancement Architecture**

- Core functionality implemented server-side ensuring accessibility and performance without JavaScript
- Client enhancements layered on server foundation for improved user experience and interactivity
- Server Action submission as fallback with client-side enhancement for immediate feedback
- Hybrid routing with server-side redirects and client-side navigation for optimal user flows

### Request Lifecycle and Data Flow

**Complete Request-Response Cycle**

- Route entry through Server Component page with immediate authentication validation
- Authentication context resolution using cached `requireAuthContext()` for organization scoping
- Direct database queries via DAL with organization boundary enforcement and error handling
- Server-side rendering with selective client hydration for interactive components only
- Client mutations submit to Server Actions for validation, database updates, and cache invalidation

**Authentication and Organization Context Propagation**

- Server Components receive authentication context through layout hierarchy and prop passing
- Organization context automatically resolved and propagated through authenticated DAL functions
- Session management handled at middleware level with automatic token refresh and validation
- Multi-tenant boundary enforcement at every data access point through application and database layers

### Component Organization and Architecture

**Feature-Based Component Hierarchy**

- Route components in `src/app/` directory following Next.js App Router Server Component conventions
- Feature components in `src/components/` organized by domain with clear server/client separation
- UI components in `src/components/ui/` using shadcn/ui system for interactive elements
- Layout components combining server navigation with precise client islands for user interactions

**Migration and Coexistence Strategy**

- MUI components maintained during transition period with CSS layer isolation strategy
- New development exclusively uses shadcn/ui components with Tailwind CSS v4 styling
- Component-by-component migration approach ensuring no functionality loss during transition
- Clear architectural boundaries preventing style conflicts between MUI and Tailwind systems

### Performance and Scalability Architecture

**Request-Level Optimization Patterns**

- React 19 cache() API eliminates duplicate database queries within single request execution
- Strategic component hierarchy minimizing client-side JavaScript bundle size and execution
- Server Component defaults reducing client-side state management complexity and memory usage
- Direct database access patterns bypassing unnecessary API layer abstraction and network overhead

**Scalability and Maintainability**

- Clear separation of concerns between server data access and client interactivity boundaries
- Type-safe component interfaces with explicit prop typing and validation throughout hierarchy
- Consistent architectural patterns enabling predictable development and debugging workflows
- Component composition patterns supporting feature development without architectural complexity

## 5. Directory Structure Map

### Core Directory Architecture

**App Router Foundation (src/app/)**

- Feature-based route organization with clear Server Component defaults
- Client Provider isolation in dedicated \_trpc/ and \_components/ directories
- Authentication callback handling in dedicated auth/ directory
- API route handlers organized by function (health, QR codes, tRPC endpoints)
- Static asset management with proper Next.js App Router conventions

**Server-First Component Hierarchy (src/components/)**

- Server Component defaults with explicit Client Component marking ("use client")
- Domain-driven organization by business feature (issues/, machines/, locations/)
- Architectural separation between server/client/hybrid component patterns
- UI component system with shadcn/ui integration and MUI coexistence strategy
- Layout component isolation with dedicated client/ subdirectory for client islands

**Library Organization (src/lib/)**

- Data Access Layer (dal/) for direct Server Component database queries
- Server Actions (actions/) for form handling and mutations
- Authentication utilities (auth/) with server/client context separation
- Validation schemas and business logic organized by domain
- Utility functions with clear server/client boundaries and shared helpers

### App Router Structure (src/app/)

**Route Organization Patterns**

- Feature-based directory structure aligned with user journey workflows
- Server Component page.tsx files as default rendering pattern
- Layout components providing organization context and authentication state
- Loading and error boundaries for progressive enhancement and resilience
- Dynamic route segments with type-safe parameter validation

**Client Provider Architecture**

- \_trpc/Provider.tsx for client-side tRPC state management during transition period
- providers.tsx for root-level client context composition (auth, theme, notifications)
- Explicit "use client" boundaries preventing server/client context leakage
- Provider tree optimization with minimal client-side state requirements

**Authentication Flow Integration**

- auth/callback/route.ts for OAuth provider callback handling
- Server-side session management with automatic token refresh middleware
- Protected route patterns with authentication context propagation
- Organization context resolution and role-based access control integration

### Component Architectural Boundaries (src/components/)

**Server/Client Separation Strategy**

- Default to Server Components unless explicit interactivity requirements demand client-side execution
- Client islands pattern with dedicated client/ subdirectories for clear boundary identification
- Hybrid component composition with Server Component shells containing Client Component islands
- Props-based data flow from Server Components to Client Components preventing hydration mismatches

**UI Component System Integration**

- shadcn/ui components as primary design system with server/client flexibility
- migration-bridge.tsx utilities for gradual MUI to shadcn/ui transition
- Tailwind CSS utility classes with CSS layer isolation preventing style conflicts
- Component composition patterns enabling reusable server and client component combinations

**Domain-Driven Component Organization**

- Business feature grouping (issues/, machines/, locations/) over technical concerns
- Shared component libraries for cross-domain functionality
- Form component specialization with Server Actions integration
- Layout components managing authentication state and navigation structure

### Data Access Layer Architecture (src/lib/dal/)

**Server Component Integration Patterns**

- Direct Drizzle ORM queries bypassing client-side data fetching layers
- React 19 cache() API wrapper functions for request-level query memoization
- Organization-scoped query functions enforcing multi-tenant security boundaries
- Type-safe database operations with schema-first development alignment

**Authentication Context Integration**

- requireAuthContext() and getServerAuthContext() for authenticated Server Component queries
- Automatic organization context resolution from user session metadata
- Permission validation and role-based data filtering at query level
- Error handling with appropriate authentication redirects and access control

**Query Optimization and Performance**

- Request-level caching preventing duplicate database queries within single request lifecycle
- Strategic relational loading with explicit column selection for optimal query performance
- Pagination helpers and query builders for large dataset management
- Database connection pooling and query performance monitoring integration

### Server Actions Infrastructure (src/lib/actions/)

**Form Handling and Mutation Architecture**

- "use server" directive enforcement for proper server-side execution boundaries
- Type-safe form validation with Zod schema integration and error handling
- Progressive enhancement ensuring form functionality without JavaScript
- Background task processing with revalidation patterns for cache invalidation

**Authentication and Authorization Integration**

- Server Action authentication validation with automatic redirect handling
- Organization context propagation ensuring multi-tenant security in mutations
- Role-based permission checking before data modification operations
- Input validation and sanitization preventing injection attacks and malicious data

**State Management and Revalidation**

- revalidatePath() and revalidateTag() patterns for granular cache invalidation
- Server Action result types compatible with React 19 useActionState hook
- Error boundary integration with proper error state management and user feedback
- Optimistic updates coordination between Server Actions and Server Component re-rendering

### Authentication System Organization (src/lib/auth/)

**Server/Client Context Architecture**

- Server-side authentication context utilities for Server Components and Server Actions
- Client-side authentication integration for interactive components requiring user state
- Development authentication helpers with secure credential management
- Session state synchronization between server and client execution contexts

**Supabase SSR Integration Patterns**

- createServerClient() usage patterns with proper cookie handling synchronization
- Middleware integration for automatic token refresh and session management
- Authentication callback processing with secure redirect handling and state validation
- Role-based access control integration with organization membership validation

### Test System Architecture (src/test/)

**Testing Organization (Note)**

- Historic reference to an archetype-oriented approach. For current standards, use `docs/CORE/TESTING_GUIDE.md` (test types, naming, placement) and templates under `src/test/` where useful.
- Auto-generated mock system derived from seed data for consistent test scenarios
- Test helper utilities for Server Component, Server Action, and hybrid component testing
- Integration test patterns with worker-scoped database instances for isolation

**Mock and Data Management**

- SEED_TEST_IDS constants for predictable test debugging across tests
- Generated mock factories based on actual database schema and seed data patterns
- Test database management with PGlite worker instances preventing test interference
- Cross-type test data sharing ensuring realistic scenarios across multiple test types

### Migration-Specific Directory Organization

**RSC Migration Progress Tracking**

- Phase-based architectural evolution with clear Server/Client Component migration boundaries
- shadcn/ui component adoption with gradual MUI component replacement strategy
- CSS layer isolation enabling style system coexistence during transition periods
- Migration utility functions and bridge components facilitating incremental architectural changes

**Coexistence Strategies**

- MUI component preservation with explicit deprecation path for gradual replacement
- Tailwind CSS integration with existing design system through CSS layer architecture
- Client Component identification and systematic conversion to Server Component alternatives
- Legacy code preservation ensuring functionality during architectural evolution

### Directory Naming Conventions and Organization Principles

**File and Directory Naming Standards**

- kebab-case for directories following Next.js App Router conventions
- camelCase for TypeScript files with clear component and utility identification
- Historic note: explicit test-type identification in filenames (e.g., \*.unit.test.ts)
- Domain-driven naming aligned with business feature organization rather than technical implementation

**Architectural Boundary Enforcement**

- Clear separation between server-side (dal/, actions/) and client-side utilities
- Explicit Client Component marking with "use client" directive and client/ subdirectory organization
- Authentication context separation between server and client execution environments
- Test organization standards preventing architectural boundary violations during testing

**Import Path Organization**

- TypeScript alias usage (~/lib/, ~/components/) eliminating deep relative imports
- Barrel export patterns in index.ts files for clean import statements
- Dependency flow enforcement preventing circular imports and architectural violations
- Path mapping configuration supporting development tooling and bundle optimization

### Quality Assurance and Development Workflow Integration

**Static Analysis and Code Organization**

- ESLint configuration enforcing Server Component defaults and Client Component explicit marking
- TypeScript strictest patterns with proper import organization and type safety
- Pre-commit hooks validating directory structure compliance and architectural boundary respect
- Automated code organization validation preventing architectural degradation during development

**Development Experience Optimization**

- Hot reloading configuration respecting Server/Client Component boundaries
- Development server integration with proper authentication context and database connection management
- Build optimization with proper code splitting aligned with architectural boundaries
- Bundle analysis and performance monitoring integrated with directory structure organization

## 6. Advanced Error Handling

### Multi-Layer Error Classification and Propagation

**Type-Safe Error Classification Architecture**

```typescript
// ~/lib/types/errors.ts - Comprehensive error classification system
export const ErrorSeverity = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

export interface ClassifiedError {
  type: "validation" | "authorization" | "database" | "external" | "system";
  severity: ErrorSeverity;
  userMessage: string;
  internalMessage: string;
  context?: Record<string, unknown>;
  organizationId?: string;
}

// Security-conscious error classes
export class ValidationError extends Error implements ClassifiedError {
  readonly type = "validation";
  readonly severity = ErrorSeverity.LOW;

  constructor(
    public readonly userMessage: string,
    public readonly internalMessage: string = userMessage,
    public readonly context?: Record<string, unknown>,
  ) {
    super(internalMessage);
    this.name = "ValidationError";
  }
}

export class AuthorizationError extends Error implements ClassifiedError {
  readonly type = "authorization";
  readonly severity = ErrorSeverity.HIGH;
  readonly userMessage = "Access denied";

  constructor(
    public readonly internalMessage: string,
    public readonly organizationId?: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(internalMessage);
    this.name = "AuthorizationError";
  }
}
```

**Multi-Layer Error Propagation Strategy**

- Layer 1: Input validation with field-level error reporting and structured validation feedback
- Layer 2: Business logic validation with context-aware error classification and organizational scoping
- Layer 3: Database constraint enforcement with transaction rollback and retry mechanisms
- Layer 4: External service integration with circuit breaker patterns and graceful degradation
- Layer 5: System-level error boundaries with monitoring integration and automatic recovery attempts

### Server Components Error Boundary Architecture

**Hybrid Server/Client Error Handling Pattern**

```typescript
// Global error boundary for unhandled server errors
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="error-fallback">
          <h2>Something went wrong!</h2>
          {process.env.NODE_ENV === 'development' && (
            <pre className="error-details">{error.message}</pre>
          )}
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  )
}

// Progressive error boundaries at multiple levels
async function ServerDataComponent({ orgId }: { orgId: string }) {
  try {
    const data = await getOrganizationData(orgId)
    return <ClientErrorBoundary data={data} />
  } catch (error) {
    return <ErrorFallback message="Unable to load data" />
  }
}
```

**Client Island Error Integration**

```typescript
'use client'
function ClientErrorBoundary({ data }: { data: any }) {
  const [error, setError] = useState<Error | null>(null)

  if (error) {
    return (
      <div className="error-boundary">
        <h3>Something went wrong</h3>
        <button onClick={() => setError(null)}>Retry</button>
        <button onClick={() => window.location.reload()}>Refresh Page</button>
      </div>
    )
  }

  return <DataDisplay data={data} onError={setError} />
}
```

### Server Actions Error Handling and User Feedback

**React 19 useActionState Integration Pattern**

```typescript
"use server";
export async function createIssue(
  prevState: any,
  formData: FormData,
): Promise<{ message?: string; errors?: Record<string, string[]> }> {
  // Security-conscious input validation
  const validatedFields = createIssueSchema.safeParse({
    title: formData.get("title"),
    organizationId: formData.get("organizationId"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Invalid input provided",
    };
  }

  try {
    // Organization-scoped operation with error handling
    await createIssueForOrganization(validatedFields.data);
    redirect("/issues");
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error("Database error:", error); // Server-side logging only
      return { message: "Unable to create issue. Please try again." };
    }

    if (error instanceof AuthorizationError) {
      return { message: "You do not have permission to perform this action." };
    }

    // Generic fallback prevents information disclosure
    return { message: "An unexpected error occurred." };
  }
}
```

**Enhanced Form Error Handling with Progressive Enhancement**

```typescript
'use client'
export function CreateIssueForm() {
  const [state, formAction, pending] = useActionState(createIssue, { message: '' })

  return (
    <form action={formAction}>
      <input name="title" required />
      {state?.errors?.title && (
        <div className="field-error" role="alert" aria-live="polite">
          {state.errors.title.join(', ')}
        </div>
      )}

      {state?.message && (
        <div className="form-error" role="alert" aria-live="polite">
          {state.message}
        </div>
      )}

      <button disabled={pending} type="submit">
        {pending ? 'Creating...' : 'Create Issue'}
      </button>
    </form>
  )
}
```

### Security-Conscious Error Messaging

**Production Error Sanitization Architecture**

```typescript
// ~/lib/errors/error-sanitizer.ts
export function sanitizeErrorForClient(error: unknown): {
  message: string;
  code?: string;
  digest?: string;
} {
  if (process.env.NODE_ENV === "development") {
    // Full error details in development
    return {
      message: error instanceof Error ? error.message : "Unknown error",
      code: error instanceof ClassifiedError ? error.type : undefined,
    };
  }

  // Production: only safe, generic messages
  if (error instanceof ValidationError) {
    return { message: error.userMessage };
  }

  if (error instanceof AuthorizationError) {
    return {
      message: error.userMessage,
      code: "authorization_error",
    };
  }

  if (error instanceof DatabaseError) {
    return {
      message: "A system error occurred. Please try again later.",
      digest: generateErrorDigest(error), // For log correlation
    };
  }

  // Generic fallback prevents information leakage
  return {
    message: "An unexpected error occurred.",
    digest: generateErrorDigest(error),
  };
}

function generateErrorDigest(error: unknown): string {
  const errorString = error instanceof Error ? error.stack : String(error);
  return crypto
    .createHash("sha256")
    .update(errorString)
    .digest("hex")
    .slice(0, 8);
}
```

**Multi-Tenant Error Context Isolation**

- Organization-scoped error logging preventing cross-tenant information leakage
- Error context sanitization removing sensitive organizational data from client responses
- Audit trail generation for security events while protecting organizational boundaries
- Error correlation across organizational boundaries for system-wide issue detection while maintaining data isolation

### Database Error Handling and Transaction Safety

**Transaction Wrapper with Retry Logic**

```typescript
// ~/lib/dal/transaction-wrapper.ts
export async function safeTransaction<T>(
  operation: (tx: typeof db) => Promise<T>,
  options: {
    organizationId: string;
    maxRetries?: number;
    backoffMs?: number;
  },
): Promise<{ data?: T; error?: ClassifiedError }> {
  const { organizationId, maxRetries = 3, backoffMs = 1000 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await db.transaction(async (tx) => {
        // Verify organization context within transaction
        await verifyOrganizationAccess(tx, organizationId);
        return await operation(tx);
      });

      return { data };
    } catch (error) {
      console.error(`Transaction attempt ${attempt} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        organizationId,
        attempt,
      });

      if (isDatabaseConstraintError(error)) {
        if (attempt === maxRetries) {
          return {
            error: new DatabaseError(
              "Database operation failed after retries",
              error instanceof Error ? error.message : String(error),
              { organizationId, attempts: maxRetries },
            ),
          };
        }

        // Exponential backoff before retry
        await new Promise((resolve) =>
          setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1)),
        );
        continue;
      }

      // Non-retryable error
      return {
        error:
          error instanceof ClassifiedError
            ? error
            : new DatabaseError("Unexpected database error", String(error), {
                organizationId,
              }),
      };
    }
  }
}
```

### TypeScript Strictest Error Handling Patterns

**Type-Safe Error Guards and Validation**

```typescript
// ~/lib/types/guards.ts - Strict type validation for error handling
export function isValidOrganizationContext(
  context: unknown,
): context is { organizationId: string; userId: string } {
  return (
    typeof context === "object" &&
    context !== null &&
    "organizationId" in context &&
    "userId" in context &&
    typeof (context as any).organizationId === "string" &&
    typeof (context as any).userId === "string" &&
    (context as any).organizationId.length > 0 &&
    (context as any).userId.length > 0
  );
}

// Safe operation wrapper with comprehensive error handling
export async function safeOrganizationOperation<T>(
  context: unknown,
  operation: (ctx: { organizationId: string; userId: string }) => Promise<T>,
): Promise<{ data?: T; error?: ClassifiedError }> {
  if (!isValidOrganizationContext(context)) {
    return {
      error: new AuthorizationError("Invalid organization context", undefined, {
        providedContext: context,
      }),
    };
  }

  try {
    const data = await operation(context);
    return { data };
  } catch (error) {
    if (error instanceof ClassifiedError) {
      return { error };
    }

    return {
      error: new DatabaseError(
        "Database operation failed",
        error instanceof Error ? error.message : String(error),
        { organizationId: context.organizationId },
      ),
    };
  }
}
```

### Real-Time Error Monitoring and Recovery

**Structured Error Logging Architecture**

```typescript
// ~/lib/monitoring/error-logger.ts
interface ErrorLogEntry {
  timestamp: string;
  level: "error" | "warn" | "info";
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    digest?: string;
  };
  context: {
    organizationId?: string;
    userId?: string;
    requestId?: string;
    userAgent?: string;
    url?: string;
  };
  metadata?: Record<string, unknown>;
}

export class StructuredLogger {
  async logError(
    error: unknown,
    context: Partial<ErrorLogEntry["context"]> = {},
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              digest:
                error instanceof ClassifiedError
                  ? generateErrorDigest(error)
                  : undefined,
            }
          : undefined,
      context: {
        requestId: generateRequestId(),
        ...context,
      },
      metadata,
    };

    // Send to monitoring service with organizational context isolation
    await this.sendToMonitoring(entry);

    if (process.env.NODE_ENV === "development") {
      console.error("Structured Error Log:", JSON.stringify(entry, null, 2));
    }
  }
}
```

### Progressive Enhancement Error Fallbacks

**Graceful Degradation Error Boundaries**

```typescript
// ~/components/error-boundaries/progressive-error-boundary.tsx
'use client'
interface ProgressiveErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  level: 'page' | 'section' | 'component'
}

export function ProgressiveErrorBoundary({
  children,
  fallback: Fallback,
  level
}: ProgressiveErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const retry = useCallback(() => {
    setError(null)
    setRetryCount(count => count + 1)
  }, [])

  if (error) {
    if (Fallback) {
      return <Fallback error={error} retry={retry} />
    }

    // Progressive fallback based on error boundary level
    switch (level) {
      case 'page':
        return (
          <div className="page-error">
            <h1>Page Unavailable</h1>
            <p>This page is temporarily unavailable.</p>
            <button onClick={retry}>Retry</button>
            <a href="/">Return Home</a>
          </div>
        )

      case 'section':
        return (
          <div className="section-error">
            <p>This section couldn't load.</p>
            <button onClick={retry}>Try Again</button>
          </div>
        )

      case 'component':
        return (
          <div className="component-error">
            <span>Unable to load</span>
          </div>
        )
    }
  }

  return (
    <ErrorBoundary onError={(error) => {
      const logger = new StructuredLogger()
      logger.logError(error, {
        errorBoundaryLevel: level,
        retryCount
      })
    }}>
      {children}
    </ErrorBoundary>
  )
}
```

### Accessible Error User Experience Patterns

**Screen Reader Optimized Error Display**

```typescript
// ~/components/ui/error-display.tsx
interface ErrorDisplayProps {
  error: ClassifiedError
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  showDetails = false
}: ErrorDisplayProps) {
  const getErrorIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return '🚨'
      case ErrorSeverity.HIGH: return '⚠️'
      case ErrorSeverity.MEDIUM: return '⚠️'
      case ErrorSeverity.LOW: return 'ℹ️'
    }
  }

  return (
    <div
      className={`error-display error-display--${error.severity}`}
      role="alert"
      aria-live="polite"
    >
      <div className="error-display__header">
        <span className="error-display__icon" aria-hidden="true">
          {getErrorIcon(error.severity)}
        </span>
        <h3 className="error-display__title">
          {error.userMessage}
        </h3>
      </div>

      {showDetails && process.env.NODE_ENV === 'development' && (
        <details className="error-display__details">
          <summary>Technical Details</summary>
          <pre>{error.internalMessage}</pre>
          {error.context && (
            <pre>{JSON.stringify(error.context, null, 2)}</pre>
          )}
        </details>
      )}

      <div className="error-display__actions">
        {onRetry && (
          <button
            className="error-display__retry-button"
            onClick={onRetry}
          >
            Try Again
          </button>
        )}
        {onDismiss && (
          <button
            className="error-display__dismiss-button"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
```

### Integration with PinPoint Multi-Tenant Architecture

**Organization-Scoped Error Handling**

- Error classification and handling respects organizational boundaries preventing cross-tenant information leakage
- Multi-tenant error monitoring with organization-specific dashboards and alerting capabilities
- Performance impact minimization through request-level error handling optimization and cache integration
- Security-first error design ensuring no sensitive organizational data exposed through error messages or logging

**Scalability and Reliability Integration**

- Error handling patterns designed for high-availability multi-tenant environments with automatic recovery mechanisms
- Integration with existing authentication and authorization layers maintaining security boundaries during error scenarios
- Performance monitoring integration tracking error rates and resolution patterns across organizational boundaries
- Comprehensive audit trail generation supporting compliance requirements while maintaining organizational data isolation

## 7. Security Model

### Multi-Layered Defense Architecture

**Five-Layer Security Stack**

- **Layer 1**: Next.js middleware for global authentication enforcement and subdomain-based tenant routing
- **Layer 2**: tRPC procedures with graduated security levels (public, protected, organization-scoped, RLS-enforced)
- **Layer 3**: Server Actions with form-based authentication validation and organization context propagation
- **Layer 4**: PostgreSQL Row-Level Security (RLS) policies as database-level enforcement preventing data leakage
- **Layer 5**: Application-layer organization scoping with fallback security when RLS constraints are insufficient

**Defense-in-Depth Philosophy**

- Multiple independent security layers preventing single points of failure
- Database constraints as final validation layer catching application logic errors
- Security-first development patterns with secure defaults throughout architecture
- Comprehensive audit capabilities enabling security monitoring and compliance validation

### Multi-Tenant Security Architecture

**Hard Multi-Tenancy with Database Enforcement**

- PostgreSQL RLS policies enforcing organizational boundaries at data access level
- JWT token app_metadata containing tamper-proof organization context (admin-controlled only)
- Subdomain-based tenant identification with automatic organization mapping and validation
- Zero cross-organization data access in normal operations with explicit boundary enforcement

**Organization Context Management**

- Supabase app_metadata storage for secure organization assignment controlled exclusively by service role
- Organization context extraction from JWT claims for RLS policy evaluation and application scoping
- Multi-organization user membership support with role-specific permissions per organization
- Context validation and automatic repair mechanisms for users with broken organization associations

**Tenant Isolation Enforcement Points**

- Database RLS policies: Primary isolation mechanism preventing cross-tenant data access
- Application queries: Secondary isolation with organization_id filtering on all multi-tenant tables
- Service factory pattern: Organization-scoped database access with automatic context injection
- API boundaries: Organization validation before business logic execution in all protected procedures

### Role-Based Access Control (RBAC) System

**Hierarchical Permission Architecture**

- **Permission Categories**: Issues (view, create, edit, delete, assign, bulk_manage), Machines (view, create, edit, delete), Locations, Attachments, Administrative (organization:manage, role:manage, user:manage, admin:view_analytics)
- **Permission Dependencies**: Automatic inheritance with dependency resolution (edit requires view, delete requires edit)
- **System Roles**: Admin (all permissions), Unauthenticated (limited anonymous access), Custom roles (organization-specific)
- **Role Hierarchy**: Owner > Admin > Technician > Member with clear permission inheritance and delegation patterns

**Permission Enforcement Architecture**

- **tRPC Layer**: requirePermission() middleware validating permissions before procedure execution
- **Server Actions**: Permission validation integrated into form handling and mutation processing
- **UI Components**: Permission-based rendering with PermissionButton and conditional display logic
- **Database Layer**: RLS policies as final permission enforcement preventing unauthorized data access

**Organization-Scoped Role Management**

- Role definitions stored per organization enabling customized permission structures
- Role template system with predefined configurations (Member, Technician, Admin, Owner)
- Permission service with centralized permission checking and dependency expansion logic
- Admin override capabilities allowing administrative roles to bypass standard permission restrictions

### Authentication and Session Security

**Supabase SSR Integration with Enhanced Security**

- @supabase/ssr client management with mandatory Next.js middleware for automatic token refresh
- Cookie synchronization using required getAll()/setAll() pattern preventing session desynchronization
- Chunked cookie management for large sessions with automatic cleanup and garbage collection
- Request-level authentication caching using React 19 cache() API eliminating duplicate authentication queries

**Session Management and Protection**

- HTTP-only secure cookies with proper domain, path, and security flag configuration
- SameSite cookie protection against cross-site request forgery attacks
- Session integrity validation with automatic logout on suspicious activity or token tampering
- Authentication context propagation through Server Components and Server Actions without exposing sensitive data

**Multi-Organization Authentication Flows**

- OAuth provider integration with mandatory auth callback route handling at /auth/callback
- User registration with automatic organization assignment via app_metadata field
- Organization membership validation with role-based access control integration
- Progressive user profile completion with secure organization context establishment

### Input Validation and Data Security

**Multi-Layer Validation Architecture**

- **Schema Definition**: Zod schemas defining strict data structure validation and type coercion
- **API Validation**: tRPC input validation with custom schemas preventing malformed data processing
- **Server Actions**: Form validation with structured error handling and field-level error reporting
- **Database Constraints**: Drizzle schema constraints providing final validation layer and data integrity

**Validation Pattern Implementation**

- Enhanced Server Action validation with comprehensive error formatting and user feedback
- Type-safe form processing with automatic input sanitization and whitespace trimming
- SQL injection prevention through parameterized queries via Drizzle ORM with no raw SQL execution
- Cross-site scripting (XSS) prevention through React's built-in escaping combined with input validation

**Data Sanitization Strategy**

- Automatic input trimming and type coercion with validation feedback
- Structured data transformation preventing malicious payload injection
- File upload validation with type checking and size limit enforcement
- Content validation ensuring data integrity before database storage

### Error Handling and Information Security

**Secure Error Response Architecture**

- Generic error messages for authentication and authorization failures preventing information disclosure
- Structured error classification system with safe error codes and user-friendly messages
- No stack traces or internal system details exposed to client applications
- Operation context tracking for server-side debugging without client information leakage

**Error Classification and Context Management**

- SECURITY_ERRORS constants defining safe error response patterns
- Error boundary integration with appropriate fallback states and redirect flows
- Comprehensive error logging for audit trails without exposing sensitive data
- Integration with monitoring systems for security event detection and alerting

### Database Security and Query Protection

**PostgreSQL Row-Level Security Implementation**

- RLS policies enabled on all organizational tables with JWT-based policy evaluation
- Anonymous user access blocked from organizational data with public access limited to discovery
- Cross-tenant query filtering automatically applied preventing data leakage
- Policy testing with pgTAP ensuring RLS enforcement correctness and comprehensive coverage

**Query Security and Injection Prevention**

- Drizzle ORM providing parameterized queries throughout application preventing SQL injection attacks
- Limited raw SQL usage restricted to RLS session variable setting with proper escaping
- Input validation before database interaction ensuring data integrity and preventing malicious queries
- Database connection pooling with security monitoring and query performance analysis

**Organization Boundary Enforcement**

- Primary isolation through organization_id column indexing on all multi-tenant tables
- Compound foreign key relationships ensuring cross-table organization consistency
- Application-layer organization context propagation with automatic scoping validation
- Database-level constraints preventing accidental cross-organization data relationships

### API Security and Request Protection

**tRPC Security Procedure Architecture**

- **publicProcedure**: Anonymous access with optional organization context for discovery workflows
- **protectedProcedure**: Authenticated users with session validation and basic security checks
- **organizationProcedure**: Full RBAC with permission checking and organization context enforcement
- **orgScopedProcedure**: Simplified RLS-based scoping for high-performance queries
- **anonOrgScopedProcedure**: Anonymous access with organization context for QR code workflows

**Request Processing Security Pipeline**

- Multi-layer request validation with input schema verification and authentication context resolution
- Rate limiting integration points with tRPC batching and deduplication for performance optimization
- Request correlation ID tracking for audit trails and security monitoring
- Background task processing isolation preventing security context leakage in asynchronous operations

**CORS and Header Security**

- Development and production CORS configuration with proper origin validation
- Security header enforcement including Content Security Policy and frame protection
- Request origin validation preventing cross-origin attacks and unauthorized access
- API endpoint protection with proper authentication and authorization validation

### Audit, Monitoring, and Compliance Architecture

**Comprehensive Audit Trail System**

- Operation-level tracing with correlation IDs for security event tracking and forensic analysis
- Authentication event logging with user context and organization information
- Permission check audit trails enabling compliance reporting and access control validation
- Database modification tracking with user identification and organization context preservation

**Security Event Monitoring and Alerting**

- Structured logging system with security-specific event classification and priority handling
- Performance monitoring integration detecting slow operations and potential attack patterns
- Error rate monitoring with structured error classification enabling anomaly detection
- Resource access monitoring identifying organization boundary violations and suspicious activity

**Compliance and Data Protection**

- Data retention policies with organization-specific customization and automated archival capabilities
- Cross-organization data access audit trails for regulatory compliance and privacy protection
- User data portability support for organization migration with complete data export validation
- Privacy compliance mechanisms including data purging and export capabilities for regulatory requirements

### File Storage and Upload Security

**Supabase Storage Integration Security**

- Organization-scoped file storage with access control through Supabase Storage RLS integration
- File ownership validation ensuring users can only access authorized files within organization boundaries
- Upload authentication patterns with file type validation and virus scanning integration points
- Storage quota management preventing resource abuse with organization-level limits and monitoring

**File Access Control Architecture**

- Issue-based attachment access following parent issue permissions with inheritance validation
- File creator identification and organization membership verification for secure file access
- Automatic cleanup and archival based on parent entity lifecycle with administrative override capabilities
- Integration with main RLS policies ensuring file access follows organizational security boundaries

### Security Testing and Validation Architecture

**Multi-Type Security Testing**

- RLS policy validation through pgTAP automated testing ensuring multi-tenant boundary enforcement
- Integration testing with worker-scoped database instances preventing cross-test data contamination
- Server Component security testing validating authentication context propagation and organization scoping
- End-to-end security testing with Playwright automation covering complete user authentication journeys

**Continuous Security Validation**

- Pre-commit security hooks validating organizational scoping patterns and authentication requirements
- Static analysis integration detecting security anti-patterns and potential vulnerabilities
- Performance monitoring for security-related queries detecting N+1 attacks and resource abuse
- Database constraint validation ensuring referential integrity across organization boundaries

### Security Architecture Evolution and Enhancement

**Current Security Strengths**

- Comprehensive multi-tenant isolation with database-level enforcement and application-layer validation
- Sophisticated RBAC system with hierarchical permissions and organization-specific role customization
- Defense-in-depth architecture with multiple independent security layers and fallback mechanisms
- Comprehensive audit capabilities supporting compliance requirements and security monitoring

**Identified Enhancement Opportunities**

- API-level rate limiting implementation for request throttling and abuse prevention
- Complete file upload security system with comprehensive validation and scanning integration
- Intrusion detection system with automated threat response and security event correlation
- Enhanced security header configuration with comprehensive Content Security Policy implementation

**Security-First Development Patterns**

- Secure defaults throughout architecture with explicit opt-in for reduced security features
- Security validation integrated into development workflow with automated testing and validation
- Clear security boundary identification enabling predictable security model understanding
- Documentation and training integration ensuring security-aware development practices

## 7. Data Flow Architecture

### Core Request-Response Lifecycle Architecture

**Server-First Request Processing Pipeline**

- Next.js middleware intercepts all requests for authentication token refresh and subdomain-based organization resolution
- Supabase SSR client validates JWT tokens and extracts organization context from user metadata enabling automatic multi-tenant scoping
- Server Components receive authenticated context and organization scoping through props and cached authentication utilities
- Direct database queries through Drizzle ORM Data Access Layer (DAL) functions eliminating client-side data fetching overhead
- React 19 cache() API provides request-level memoization preventing duplicate database queries within single request lifecycle
- Server-rendered HTML response with minimal client-side hydration for specific interactive components only

**Authentication Context Propagation Flow**

- Middleware level: Automatic Supabase session refresh with subdomain organization mapping and cookie synchronization patterns
- Server Component level: Cached authentication context through getServerAuthContext() preventing duplicate authentication queries
- Data Access Layer: requireAuthContext() function providing organization-scoped query execution with automatic security enforcement
- Server Actions: Shared authentication utilities with getActionAuthContext() maintaining consistent security boundaries across all mutations

### Server Actions Data Flow Architecture

**Form Submission and Mutation Pipeline**

- React 19 useActionState integration providing optimistic updates and structured error handling with progressive enhancement
- Zod schema validation with field-level error reporting and type-safe input processing before database operations
- Authentication context validation ensuring user permissions and organization membership before any data modifications
- Direct Drizzle ORM database operations with organization scoping enforced at query level preventing cross-tenant data access
- Background processing through runAfterResponse() wrapper enabling analytics logging and notification delivery without blocking user response

**Cache Invalidation and Revalidation Patterns**

- Granular path-based invalidation using revalidatePath() for specific page updates (issue lists, detail pages, dashboard views)
- Tag-based cache invalidation through revalidateTag() enabling cross-cutting invalidation across related data (all issues, user profiles, organization data)
- Shared revalidation utilities (revalidateIssues(), revalidateDashboard()) ensuring consistent cache management across Server Actions
- Strategic cache warming through parallel database queries for default values and frequently accessed data

**Server Action Error Handling and Response Architecture**

- ActionResult<T> type pattern compatible with useActionState hook providing structured success and error responses
- Field-level validation errors with user-friendly messages and proper form field association for enhanced user experience
- Generic security error messages preventing information disclosure while providing appropriate user guidance for resolution
- Background task error isolation ensuring main workflow completion despite non-critical operation failures

### Data Access Layer (DAL) Architecture

**Organization-Scoped Query Patterns**

- All multi-tenant queries automatically scoped by organization context through requireAuthContext() preventing cross-organization data access
- React cache() wrapper functions providing request-level deduplication for expensive database operations and authentication queries
- Explicit column selection and strategic relational loading using Drizzle with clause for optimal query performance
- Type-safe database operations with full TypeScript integration through Drizzle ORM schema inference and compile-time validation

**Performance-Optimized Query Architecture**

- Request-level caching with React 19 cache() API eliminating duplicate queries for shared data within single request lifecycle
- Strategic JOIN operations with explicit column selection reducing data transfer and memory usage during complex queries
- Pagination helpers and query builders for large dataset management with efficient offset-based limits and count strategies
- Default value caching for frequently accessed organizational settings (default statuses, priorities, roles) improving response times

**Database Security and Multi-Tenant Isolation**

- Primary isolation through organization_id column filtering on all multi-tenant tables with automatic index utilization
- Secondary security enforcement through PostgreSQL Row Level Security policies providing defense-in-depth protection
- Compound foreign key relationships ensuring cross-table organization consistency and preventing orphaned data relationships
- Query-level organization validation with descriptive error messages for debugging while maintaining security boundaries

### Real-Time Data Flow and Collaborative Architecture

**Current Implementation Patterns**

- Client Component boundaries for interactive features requiring real-time updates (issue status changes, comment additions, user presence)
- tRPC query invalidation patterns with manual refetch() operations for immediate data synchronization after mutations
- Server Actions triggering client-side cache invalidation through revalidation patterns maintaining data consistency

**Real-Time Infrastructure Foundation**

- Supabase real-time subscription capabilities integrated with organization-scoped channel patterns preventing cross-tenant data leakage
- Database schema designed with notification and subscription patterns supporting collaborative features and live updates
- WebSocket connection management with automatic reconnection and organization context validation for secure real-time access
- Optimistic update patterns with conflict resolution strategies enabling responsive user experience during collaborative editing

**Collaborative Feature Data Flows**

- Issue comment real-time synchronization with organization boundary enforcement and role-based visibility controls
- Machine status updates with immediate propagation to all connected users within organization scope
- User presence indicators and activity tracking respecting privacy settings and organizational visibility preferences
- Notification delivery system with real-time and email coordination based on user preferences and urgency levels

### Background Processing and Async Data Flows

**Post-Response Processing Architecture**

- runAfterResponse() wrapper function enabling non-critical operations after user response delivery improving perceived performance
- Analytics event logging for user actions, performance metrics, and business intelligence without blocking critical workflows
- Notification delivery pipeline processing user notifications, email queuing, and external system integrations asynchronously
- Audit trail generation with comprehensive operation logging supporting compliance requirements and security monitoring

**Future Background Processing Foundation**

- Architecture ready for Next.js unstable_after API when available providing native background processing capabilities
- Queue-based processing patterns for heavy operations like bulk data imports, report generation, and system maintenance
- External service integration points for third-party APIs, webhooks, and data synchronization maintaining organizational boundaries
- Resource-intensive operations (file processing, data analysis, backup generation) isolated from user-facing response times

### File Storage and Asset Data Flow

**Upload Processing Pipeline Architecture**

- Client-side file validation and preprocessing with Canvas API for immediate user feedback and optimal user experience
- Base64 or buffer transmission through tRPC with comprehensive type-safe validation and structured error handling
- Server-side image processing with WebP conversion, resizing, and quality optimization based on asset type requirements
- Storage abstraction layer through ImageStorageProvider interface enabling seamless migration between storage backends

**Organization-Scoped Asset Management**

- File storage paths include organization context preventing cross-tenant file access and maintaining strict data boundaries
- Permission-based upload operations requiring specific roles and organization membership validation before file processing
- Asset lifecycle management with automatic cleanup based on parent entity deletion and administrative override capabilities
- Database metadata integration with relational integrity ensuring file references remain consistent throughout application

### Error Handling and Data Consistency Architecture

**Multi-Layer Error Propagation Patterns**

- Server Component error boundaries with appropriate fallback states and user-friendly error messages preventing application crashes
- Server Action structured error responses with field-level validation feedback compatible with useActionState patterns
- DAL function descriptive error messages with operation context while maintaining security boundaries and preventing information disclosure
- Background task error isolation with comprehensive logging ensuring main workflow completion despite non-critical failures

**Data Consistency and Transaction Management**

- Database transaction patterns for complex multi-step operations ensuring atomic data modifications and rollback capabilities
- Optimistic concurrency control with version checking preventing conflicting modifications during simultaneous user operations
- Cache consistency management with proper invalidation timing ensuring users see updated data immediately after modifications
- Cross-organizational boundary validation preventing accidental data relationships and maintaining strict multi-tenant isolation

### Performance Optimization and Scalability Architecture

**Request-Level Performance Optimization**

- React cache() API integration preventing duplicate authentication checks, default value queries, and expensive database operations
- Strategic component hierarchy minimizing database queries through proper data passing and shared context utilization
- Parallel database queries using Promise.all() for default values and independent data requirements optimizing response times
- Memory-efficient query patterns with explicit column selection and optimal JOIN strategies reducing data transfer overhead

**Scalable Data Flow Patterns**

- Connection pooling optimization with query performance monitoring and automatic scaling recommendations
- Database indexing strategy aligned with query patterns ensuring optimal performance as data volume grows
- Caching layer architecture supporting horizontal scaling with proper cache invalidation and consistency management
- Query optimization monitoring with N+1 query detection and automatic optimization recommendations preventing performance degradation

### Integration and Extension Data Flow Architecture

**Third-Party Service Integration Patterns**

- External API communication with organization context preservation and proper authentication token management
- Webhook delivery system with organization scoping and security validation ensuring external systems receive appropriate data
- Data import/export capabilities supporting organizational data portability while maintaining security boundaries and audit trails
- Integration with external authentication providers (SAML, LDAP) while preserving organization membership and role assignments

**Extension and Customization Data Flow**

- Plugin architecture foundation with organization-scoped configuration and data access patterns enabling custom integrations
- Custom field support in database schema with type-safe query patterns maintaining performance and consistency
- Organization-specific workflow configuration with data validation and business rule enforcement at application layer
- API extensibility patterns supporting external integrations while maintaining security boundaries and audit requirements

## 8. UI Component Strategy

### Server-First Component Architecture

**React Server Components as Foundation**

- Default pattern: Server Components for all new development with async function patterns for data access
- Server Components handle authentication validation, data fetching, and initial rendering server-side
- Direct database queries through Data Access Layer (DAL) eliminating client-side data fetching overhead
- Metadata generation handled server-side with generateMetadata functions for SEO optimization

**Client Island Architecture Pattern**

- Strategic Client Component boundaries marked with "use client" directive for specific interactivity requirements
- Interactive forms using React 19 useActionState and useFormStatus hooks for enhanced user experience
- Navigation interactions including mobile toggles, user menus, and dropdown components requiring state management
- Real-time features implemented as focused client islands within server-rendered page shells

**Hybrid Component Integration**

- Server shell + Client islands composition for optimal performance and interactivity balance
- Client Components receive server-passed props for initial state and configuration data
- Form submissions handled through Server Actions with progressive enhancement fallbacks
- Client state management limited to UI interactions with server state as authoritative source of truth

### Primary Design System: shadcn/ui

**Component Foundation Architecture**

- shadcn/ui as primary design system built on Radix UI primitives with accessibility built-in
- Server Component compatible design system enabling server-first rendering without client-side dependencies
- Component composition patterns providing maximum flexibility through prop-based customization
- TypeScript-first component architecture with proper prop types and variant definitions

**Available Component Library**

- Core Components: Button, Card, Input, Avatar, Separator providing foundation for all UI development
- Form Components: Enhanced form controls with built-in validation states and error handling
- Layout Components: Responsive grid and container systems with mobile-first design patterns
- Interactive Components: Dropdowns, modals, and navigation elements with proper focus management

**Design Token System**

- HSL-based color system with semantic naming for consistent theme application across components
- CSS custom properties enabling dynamic theming and dark mode support throughout application
- Typography scale with Tailwind typography classes providing consistent text hierarchy
- Spacing system using Tailwind spacing scale with utility-first approach for layout consistency

**Component Variant Architecture**

- Class Variance Authority (CVA) integration for type-safe component variant definitions
- Systematic variant patterns enabling consistent component APIs across design system
- Conditional styling patterns supporting responsive design and state-based appearance changes
- Composable variant system allowing complex component combinations without style conflicts

### Tailwind CSS v4 Integration Strategy

**CSS-First Configuration Architecture**

- CSS-based configuration files replacing JavaScript config for improved performance and maintainability
- Design token system implemented through CSS custom properties for runtime theme switching
- Layer-based architecture providing style isolation and conflict prevention during framework transitions
- Performance optimization through CSS-first compilation reducing build times and bundle sizes

**Responsive Design Implementation**

- Mobile-first responsive design with Tailwind breakpoint system ensuring optimal experiences across devices
- Container queries integration for component-level responsive behavior independent of viewport size
- Fluid typography and spacing scales adapting automatically to screen size and user preferences
- Progressive enhancement ensuring core functionality works across all device capabilities

**Utility-First Styling Strategy**

- Utility classes as primary styling mechanism reducing CSS bundle size and eliminating dead code
- Component-level style composition through utility combinations preventing style duplication
- Custom utility creation for domain-specific styling needs maintaining design system consistency
- Build-time purging removing unused styles for optimal production performance

### Material UI Coexistence Strategy

**CSS Layer Isolation Implementation**

- Isolated CSS layers (mui, tailwind-components, tailwind-utilities) preventing style conflicts during transition
- Layer specificity management ensuring proper style resolution without !important overrides
- Component-level isolation strategies enabling gradual migration without breaking existing functionality
- Migration bridge components facilitating smooth transitions between MUI and shadcn/ui implementations

**Gradual Migration Approach**

- Existing MUI components maintained during transition period without forced replacement requirements
- New development exclusively uses shadcn/ui components establishing future architectural direction
- Component-by-component replacement strategy ensuring no functionality loss during migration process
- Feature-complete compatibility maintained throughout transition enabling continuous deployment

**Legacy Component Preservation**

- MUI v7 components continue functioning with proper theme provider and SSR configuration
- Existing component APIs preserved preventing breaking changes in application logic
- Theme synchronization between MUI and shadcn/ui systems ensuring visual consistency during coexistence
- Performance monitoring ensuring legacy components don't impact overall application performance

### Form Architecture and Validation

**React 19 Form Patterns**

- useActionState hook integration providing optimistic updates and error handling for enhanced user experience
- useFormStatus hook enabling loading states and submission feedback without additional state management
- Server Actions as primary form submission mechanism replacing client-side API calls
- Progressive enhancement ensuring form functionality without JavaScript for accessibility and performance

**Validation Architecture**

- Zod schema integration providing type-safe validation with detailed field-level error messages
- Real-time validation feedback using React 19 hooks for immediate user guidance
- Server-side validation enforcement preventing malicious or malformed data submission
- Error boundary integration with graceful error handling and user-friendly error messaging

**Form Component Patterns**

- shadcn/ui form components (Input, Textarea, Select, Button) as standard form building blocks
- Accessibility-first design with proper ARIA attributes, label associations, and keyboard navigation support
- TypeScript integration with inferred form data types and validation schema alignment
- Consistent styling patterns with error states, loading indicators, and success feedback

### Layout and Navigation Architecture

**Server-Rendered Layout Foundation**

- Server Components handling primary layout structure with authentication context and organization scoping
- Nested layout patterns supporting page-specific layouts while maintaining shared navigation and footer elements
- SEO-optimized layout generation with proper meta tags, structured data, and OpenGraph integration
- Performance-optimized layout caching using React 19 cache() API preventing duplicate layout queries

**Navigation Component Strategy**

- Server-rendered primary navigation with client islands for interactive elements (user menus, mobile toggles)
- Responsive navigation patterns adapting to screen size with mobile-first drawer implementation
- Authentication-aware navigation showing appropriate options based on user permissions and organization context
- Breadcrumb and context-aware navigation helping users understand their location within application hierarchy

**Mobile-Responsive Architecture**

- Touch-friendly interface patterns with appropriate touch targets and gesture support
- Progressive web app (PWA) considerations for mobile installation and offline capability
- Performance-optimized mobile loading with critical CSS inlining and resource prioritization
- Mobile-specific layout adaptations ensuring optimal usability across device types and orientations

### Interactive Component Patterns

**Client Island Implementation**

- Minimal Client Components focused on specific interactivity requirements (forms, real-time updates, user interactions)
- Granular client-side hydration reducing JavaScript bundle size and improving performance
- State management patterns using React hooks for local component state without external state management complexity
- Event handling patterns with proper cleanup and memory management preventing performance degradation

**Progressive Enhancement Strategy**

- Core functionality implemented server-side ensuring accessibility and performance without JavaScript
- Enhanced interactions layered on server foundation providing improved user experience when available
- Graceful degradation patterns ensuring application works across different browser capabilities and network conditions
- Performance budgets for client-side JavaScript preventing excessive bundle size and execution time

**Real-Time Component Integration**

- Supabase real-time subscriptions for collaborative features and live data updates
- Client island patterns for real-time components maintaining server-first architecture principles
- Optimistic updates with conflict resolution for improved perceived performance during collaborative editing
- Background synchronization patterns ensuring data consistency across multiple concurrent users

### Accessibility and Quality Standards

**WCAG Compliance Architecture**

- Semantic HTML foundation providing screen reader compatibility and assistive technology support
- Keyboard navigation patterns ensuring all interactive elements are accessible without mouse input
- Color contrast and typography standards meeting WCAG AA requirements across all design tokens
- Focus management patterns providing clear visual indicators and logical tab order throughout application

**Component Testing Strategy**

- React Testing Library integration for Client Component testing with user-centric testing patterns
- Visual regression testing for design system components ensuring consistent appearance across updates
- Accessibility testing automation with axe-core integration catching accessibility violations during development
- Cross-browser testing ensuring consistent functionality across modern browser environments

**Performance Standards**

- Component bundle size monitoring with automated alerts for excessive client-side JavaScript
- Rendering performance metrics with Core Web Vitals tracking for real user monitoring
- Memory leak prevention through proper component cleanup and ref management patterns
- Loading performance optimization with strategic component lazy loading and code splitting

### Component Organization and Architecture

**Directory Structure Patterns**

- Feature-based component organization (issues/, machines/, locations/) aligning with domain-driven development
- UI component isolation (src/components/ui/) for design system components with clear reusability boundaries
- Layout component separation with server/client boundaries clearly marked through directory structure
- Form component specialization with Server Actions integration maintaining architectural consistency

**Import and Dependency Management**

- TypeScript path aliases (~/components/, ~/lib/) eliminating deep relative imports and improving maintainability
- Barrel export patterns in index.ts files providing clean import statements and better tree-shaking
- Dependency flow enforcement preventing circular imports and architectural boundary violations
- Component composition patterns supporting feature development without architectural complexity

**Code Splitting and Bundle Optimization**

- Route-based code splitting with Next.js App Router automatic optimization
- Component-level lazy loading for non-critical interactive components reducing initial bundle size
- Dynamic imports for heavy dependencies loaded only when needed improving startup performance
- Bundle analysis integration monitoring component contribution to overall application size

### Design System Evolution and Maintenance

**Component Library Governance**

- Design token synchronization across shadcn/ui and custom component implementations
- Version management strategy for design system updates ensuring backward compatibility during transitions
- Component documentation patterns with Storybook integration for design system visibility and testing
- Breaking change management with deprecation notices and migration guides for component updates

**Customization and Extension Patterns**

- Theme customization architecture supporting organization-specific branding within design system constraints
- Custom component creation guidelines maintaining design system consistency while enabling feature-specific needs
- Component override patterns for edge cases requiring design system deviation with proper documentation
- Community component integration strategy for extending design system capabilities through vetted third-party components

**Quality Assurance Integration**

- Automated component auditing with design system compliance validation preventing architectural drift
- Performance regression testing for component updates ensuring optimization goals are maintained
- Visual design consistency monitoring with automated screenshot comparison detecting unintended changes
- Accessibility compliance automation with continuous integration blocking releases for accessibility violations

## 9. Progressive Enhancement Architecture

### Server-First Progressive Enhancement Foundation

**Core Progressive Enhancement Philosophy**

- Server-first architecture where baseline functionality works without JavaScript ensuring accessibility and performance by default
- Progressive layer of enhancements providing improved user experience for users with modern browsers and fast connections
- Default to Server Components with selective client-side hydration minimizing JavaScript execution overhead and bundle size
- Content-first rendering ensuring users see meaningful content immediately with enhancement layers loading progressively

**React 19 Server Components Integration**

```typescript
// Server Component - Works without JavaScript
export default async function IssuesPage() {
  const issues = await getIssues(); // Server-side data fetching

  return (
    <div>
      {/* Static content renders first */}
      <IssuesList issues={issues} />

      {/* Progressive enhancement with Client Components */}
      <Suspense fallback={<FilterSkeleton />}>
        <IssueFilters /> {/* Client Component for interactivity */}
      </Suspense>
    </div>
  );
}

// Client Component - Hydrates selectively
'use client'
function InteractiveNote({ note }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article>
      {/* Static content always visible */}
      <h3>{note.title}</h3>
      <p>{note.preview}</p>

      {/* Enhanced functionality */}
      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Collapse' : 'Expand'}
      </button>
      {expanded && <div>{note.fullContent}</div>}
    </article>
  );
}
```

### Form Functionality Without JavaScript

**Server Actions Progressive Enhancement**

```typescript
// Server Action - works without JavaScript
'use server'
async function createIssue(formData: FormData) {
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;

  // Validate and save with organization scoping
  const issue = await db.issues.create({
    title,
    description,
    organizationId: getOrgId()
  });

  // Progressive enhancement: redirect vs. return data
  redirect(`/issues/${issue.id}`);
}

// Form Component - Progressive enhancement ready
export default function CreateIssueForm() {
  return (
    <form action={createIssue}>
      <div>
        <label htmlFor="title">Issue Title</label>
        <input
          id="title"
          name="title"
          required
          type="text"
        />
      </div>

      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          required
        />
      </div>

      {/* Works without JavaScript */}
      <button type="submit">Create Issue</button>
    </form>
  );
}
```

**Enhanced Form with Client-Side Features**

```typescript
'use client'
import { useActionState } from 'react';

export default function EnhancedCreateIssueForm() {
  const [state, formAction, pending] = useActionState(createIssue, null);

  return (
    <form action={formAction}>
      {/* Same form fields with progressive enhancement */}

      {/* Progressive enhancement features */}
      {state?.errors?.title && (
        <p role="alert" className="error">{state.errors.title}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? 'Creating...' : 'Create Issue'}
      </button>

      {/* Optimistic UI */}
      {pending && <div>Your issue is being created...</div>}
    </form>
  );
}
```

### Client Island Architecture and Hydration Boundaries

**Strategic Hydration Boundary Implementation**

```typescript
// Server Component shell
export default async function DashboardPage() {
  const [stats, recentIssues] = await Promise.all([
    getStats(),
    getRecentIssues()
  ]);

  return (
    <main>
      {/* Static content - no hydration needed */}
      <StatsDisplay stats={stats} />

      {/* Hydration boundary #1: Search functionality */}
      <Suspense fallback={<SearchSkeleton />}>
        <SearchIsland />
      </Suspense>

      {/* Static list with progressive enhancement */}
      <IssuesList issues={recentIssues} />

      {/* Hydration boundary #2: Interactive filters */}
      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersIsland />
      </Suspense>
    </main>
  );
}

// Selective hydration with Activity boundaries
function TabContainer() {
  const [activeTab, setActiveTab] = useState('issues');

  return (
    <>
      <TabButtons activeTab={activeTab} onChange={setActiveTab} />

      {/* Each tab is an independent hydration island */}
      <Activity mode={activeTab === "issues" ? "visible" : "hidden"}>
        <IssuesTab />
      </Activity>

      <Activity mode={activeTab === "reports" ? "visible" : "hidden"}>
        <ReportsTab />
      </Activity>
    </>
  );
}
```

### Accessibility-First Progressive Enhancement

**WCAG 2025 Compliance Architecture**

```typescript
// Accessible progressive enhancement following WCAG 2.2+ standards
export default function AccessibleDataTable({ data }) {
  return (
    <div>
      {/* Always accessible table structure */}
      <table role="table" aria-label="Issues list">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(issue => (
            <tr key={issue.id}>
              <td>
                <a href={`/issues/${issue.id}`}>{issue.title}</a>
              </td>
              <td>
                <span
                  className={`status status-${issue.status}`}
                  aria-label={`Status: ${issue.status}`}
                >
                  {issue.status}
                </span>
              </td>
              <td>{issue.priority}</td>
              <td>
                {/* Progressive enhancement: works without JS */}
                <form action={updateIssueStatus} method="post">
                  <input type="hidden" name="id" value={issue.id} />
                  <select
                    name="status"
                    defaultValue={issue.status}
                    aria-label={`Update status for ${issue.title}`}
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button type="submit">Update</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Enhanced features with proper ARIA */}
      <Suspense fallback={null}>
        <EnhancedTableFeatures />
      </Suspense>
    </div>
  );
}
```

**Screen Reader Optimization with Live Regions**

```typescript
'use client'
export default function LiveUpdates() {
  const [status, setStatus] = useState('');

  return (
    <div>
      {/* Screen readers announce changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status}
      </div>

      {/* Visual updates */}
      <div aria-hidden="true">
        {status && <div className="notification">{status}</div>}
      </div>
    </div>
  );
}
```

### Performance Optimization Through Progressive Loading

**Core Web Vitals 2025 Optimization Strategy**

```typescript
// Request-level caching for performance
import { cache } from 'react';

const getCachedIssues = cache(async (orgId: string) => {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, orgId)
  });
});

// Progressive loading with proper metrics optimization
export default async function OptimizedIssuePage({ orgId }) {
  return (
    <div>
      {/* Immediate LCP content */}
      <h1>Issues Dashboard</h1>

      {/* Critical above-the-fold content */}
      <Suspense fallback={<IssuesListSkeleton />}>
        <IssuesList orgId={orgId} />
      </Suspense>

      {/* Below-the-fold: lazy load */}
      <Suspense fallback={<ChartsSkeleton />}>
        <IssueCharts orgId={orgId} />
      </Suspense>
    </div>
  );
}
```

**Progressive Image Enhancement**

```typescript
// Progressive image enhancement with Next.js optimization
import Image from 'next/image';

export function ProgressiveImage({ src, alt, priority = false }) {
  return (
    <div className="image-container">
      {/* Base64 placeholder loads immediately */}
      <Image
        src={src}
        alt={alt}
        priority={priority}
        sizes="(max-width: 768px) 100vw, 50vw"
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,..."
        style={{
          width: '100%',
          height: 'auto',
        }}
      />
    </div>
  );
}
```

### Network Resilience and Offline Capability Patterns

**Service Worker Integration for Progressive Enhancement**

```javascript
// public/sw.js - Progressive web app enhancement
self.addEventListener("fetch", (event) => {
  // Cache-first strategy for static assets
  if (
    event.request.destination === "script" ||
    event.request.destination === "style"
  ) {
    event.respondWith(
      caches
        .match(event.request)
        .then((response) => response || fetch(event.request)),
    );
  }

  // Network-first for API calls with fallback
  if (event.request.url.includes("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
  }
});
```

**Offline-First Form Handling with Progressive Enhancement**

```typescript
'use client'
export function OfflineCapableForm() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <form action={createIssue}>
      {/* Form fields */}

      {!isOnline && (
        <div role="alert" className="offline-notice">
          You're offline. Your form will be submitted when connection resumes.
        </div>
      )}

      <button type="submit">
        {isOnline ? 'Submit' : 'Save for Later'}
      </button>
    </form>
  );
}
```

### Mobile-First Responsive Progressive Enhancement

**Container Query Responsive Architecture**

```typescript
// Modern responsive design with container queries
export function ResponsiveIssueCard({ issue }) {
  return (
    <article className="issue-card" data-container="issue-card">
      <h3>{issue.title}</h3>

      {/* Content adapts based on container size */}
      <div className="issue-meta">
        <span className="status">{issue.status}</span>
        <span className="priority">{issue.priority}</span>
      </div>

      {/* Progressive disclosure on mobile */}
      <Suspense fallback={null}>
        <IssueActions issue={issue} />
      </Suspense>
    </article>
  );
}
```

```css
/* Container query responsive design */
.issue-card {
  container-type: inline-size;
  container-name: issue-card;
}

/* Mobile-first base styles */
.issue-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Enhanced layout for larger containers */
@container issue-card (min-width: 300px) {
  .issue-meta {
    flex-direction: row;
    justify-content: space-between;
  }
}

@container issue-card (min-width: 500px) {
  .issue-card {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
  }
}
```

### SEO and Core Web Vitals Optimization

**2025 Core Web Vitals Implementation Strategy**

```typescript
// Optimized for new 2025 metrics including Engagement Reliability (ER)
export default function OptimizedPage() {
  return (
    <div>
      {/* LCP optimization: hero content loads first */}
      <section className="hero">
        <h1>Issues Dashboard</h1>
        <p>Manage your team's workflow efficiently</p>
      </section>

      {/* CLS prevention: reserved space */}
      <div style={{ minHeight: '400px' }}>
        <Suspense fallback={<div style={{ height: '400px' }}>Loading...</div>}>
          <IssuesList />
        </Suspense>
      </div>

      {/* INP optimization: immediate feedback */}
      <Suspense fallback={null}>
        <InteractiveElements />
      </Suspense>
    </div>
  );
}
```

**Performance Budget Implementation with Progressive Enhancement**

```typescript
// next.config.js - Performance budgets
const nextConfig = {
  experimental: {
    bundlePagesRouterDependencies: true,
  },

  // Performance budgets for progressive enhancement
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Reduce bundle size while maintaining functionality
        "date-fns": "date-fns/esm",
      };
    }

    return config;
  },
};
```

### Testing Strategies for Progressive Enhancement

**Playwright Testing for Progressive Enhancement**

```typescript
// tests/progressive-enhancement.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Progressive Enhancement", () => {
  test("form works without JavaScript", async ({ page }) => {
    // Disable JavaScript
    await page.context().addInitScript(() => {
      delete window.fetch;
      delete window.XMLHttpRequest;
    });

    await page.goto("/issues/new");

    // Fill form
    await page.fill('[name="title"]', "Test Issue");
    await page.fill('[name="description"]', "Test Description");

    // Submit form (should work without JS)
    await page.click('[type="submit"]');

    // Should navigate to success page
    await expect(page).toHaveURL(/\/issues\/\d+/);
  });

  test("accessibility with screen reader simulation", async ({ page }) => {
    await page.goto("/issues");

    // Check ARIA labels and semantic structure
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[aria-label*="Issues list"]')).toBeVisible();

    // Test keyboard navigation
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("aria-label");
  });

  test("Core Web Vitals compliance", async ({ page }) => {
    await page.goto("/issues");

    // Measure LCP
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ["largest-contentful-paint"] });
      });
    });

    expect(lcp).toBeLessThan(2500); // 2.5 seconds LCP threshold
  });
});
```

### Integration with PinPoint Multi-Tenant Architecture

**Organization-Scoped Progressive Enhancement**

- Progressive enhancement patterns respect organizational boundaries ensuring security boundaries maintained across enhancement layers
- Multi-tenant progressive loading with organization-specific performance optimization strategies
- Context-aware enhancement prioritization based on organizational subscription levels and feature access
- Progressive enhancement fallbacks that maintain multi-tenant data isolation and security requirements

**Performance and Accessibility Integration**

- Server-first architecture enhances multi-tenant performance through reduced client-side processing overhead
- Progressive enhancement patterns integrated with organization context resolution for optimal user experience
- Accessibility-first design ensuring compliance with organizational accessibility requirements and regulatory standards
- Performance monitoring integration tracking progressive enhancement effectiveness across organizational boundaries while maintaining privacy

**Scalability and Operational Excellence**

- Progressive enhancement strategies designed to scale with multi-tenant architecture growth and geographic distribution
- Enhancement layer monitoring providing insights into user experience improvements and performance gains
- Integration with existing error handling and recovery mechanisms ensuring graceful degradation during enhancement failures
- Progressive enhancement patterns supporting organizational customization while maintaining consistent core functionality across all tenants

## 10. File Storage & Media Handling

### Core Storage Architecture

**Provider-Based Storage Abstraction**

- Interface-driven design with `ImageStorageProvider` enabling multiple storage backends without application code changes
- Current implementation: `LocalImageStorage` with file system persistence in `public/uploads/images/` directory
- Environment-configurable provider selection (`IMAGE_STORAGE_PROVIDER` supports "local" and "vercel-blob" providers)
- Future-ready architecture supporting seamless migration to cloud storage providers (S3, Azure Blob, Google Cloud Storage)

**Local Storage Infrastructure**

- File system storage with direct Next.js static file serving providing optimal performance and CDN readiness
- Timestamp-based naming convention preventing file conflicts and enabling automatic cache invalidation
- Public URL serving via `/uploads/images/` path with proper caching headers and security considerations
- Organized directory structure with predictable path patterns supporting different asset types and organizational scoping

### Asset Management Pipeline

**Image Processing and Optimization**

- Client-side Canvas API processing providing immediate user feedback and reducing server computational load
- Universal WebP conversion with configurable quality settings optimizing file size while maintaining visual quality
- Multi-tier quality constraints based on asset type and specific use case requirements for optimal user experience
- Automatic aspect ratio preservation with intelligent dimension constraints preventing image distortion

**Quality Tier Strategy**

- **Profile Pictures**: 400x400px maximum, 85% WebP quality, 2MB input limit optimized for UI performance and loading speed
- **Issue Attachments**: 1200x1200px maximum, 95% WebP quality, 5MB input limit ensuring documentation clarity and technical detail preservation
- **Organization Logos**: 400x400px maximum, 85% WebP quality, 2MB input limit supporting branding consistency across application interface
- **QR Codes**: Direct PNG buffer generation with optimal resolution ensuring reliable scanning across various devices and lighting conditions

### Organization-Scoped Security Model

**Multi-Tenant Storage Isolation**

- Organization context propagation through all file operations preventing cross-tenant access and maintaining strict data boundaries
- Upload authentication context including comprehensive user permissions and organization membership validation
- File metadata storage with organization_id foreign key constraints ensuring database-level isolation and referential integrity
- Row Level Security (RLS) integration for file access control perfectly aligned with organizational security boundaries

**Permission-Based File Operations**

- Granular permission requirements: `upload:create` for file uploads, `file:manage` for administrative operations
- Comprehensive authentication context including user roles, organization membership, and specific file operation permissions
- Role-based access control integration with organizational hierarchy (Owner > Admin > Technician > Member) supporting delegation patterns
- Permission inheritance patterns with administrative override capabilities ensuring operational flexibility during critical situations

### Storage Infrastructure Patterns

**Authentication Integration Architecture**

- `UploadAuthContext` providing comprehensive user, organization, and permission context ensuring secure file operations throughout application
- Server-side authentication validation before file processing ensuring security enforcement at all application boundaries
- Session integration with Supabase SSR patterns maintaining authentication state consistency across file operations and page transitions
- Progressive enhancement supporting file operations with graceful fallbacks for JavaScript-disabled environments ensuring accessibility

**Database Schema Integration**

- **Profile Pictures**: Direct URL storage in `users.profile_picture` with user-scoped access control and automatic cleanup of old files
- **Issue Attachments**: Full metadata in `attachments` table with comprehensive relational integrity to issues and organizations
- **QR Codes**: Machine-scoped storage in `machines` table with generation timestamps and lifecycle tracking for analytics
- **Audit Trail**: File operation logging with user identification and organization context supporting compliance requirements and forensic analysis

### User Journey Asset Workflows

**Profile Picture Upload Flow**

- Drag-and-drop interface with progressive enhancement and file picker fallback ensuring accessibility across all user capabilities
- Client-side image processing with immediate preview and WebP conversion providing instant feedback and optimal user experience
- Base64 upload via tRPC with comprehensive type-safe validation and structured error handling for reliable operations
- Server-side storage with automatic old file cleanup and database URL update maintaining consistency and preventing storage accumulation
- Default avatar system with 10 pre-generated options and random assignment ensuring visual diversity for new users

**Issue Attachment Management**

- Maximum 3 attachments per issue with server-side validation and clear user feedback preventing system abuse
- Higher quality processing (95% WebP) supporting documentation clarity and technical accuracy for maintenance workflows
- Organization-scoped attachment access following parent issue permissions and comprehensive security boundaries
- Relational metadata storage enabling complete attachment lifecycle management and comprehensive audit capabilities

**QR Code Generation and Management**

- On-demand QR code generation for machines with content pointing to optimized report issue workflows
- Direct PNG buffer processing bypassing client-side optimization ensuring consistent scanning reliability across devices
- Bulk organization-wide QR code generation and regeneration supporting operational efficiency during maintenance periods
- Database integration with generation timestamps enabling QR code lifecycle tracking and usage analytics for optimization

### Performance and Optimization Architecture

**Client-Side Processing Strategy**

- Immediate file preview with intuitive drag-and-drop interface providing instant user feedback and perceived performance
- Comprehensive memory management with proper object URL cleanup preventing browser memory leaks during extended usage
- Progressive image processing with visual loading states and error boundary integration maintaining application stability
- File validation and constraint enforcement before upload reducing server processing load and improving overall system efficiency

**Server-Side Efficiency Patterns**

- Buffer-based file processing for large files with streaming operations preventing memory issues during peak usage
- Lazy storage service initialization reducing application startup time and minimizing resource usage during low-traffic periods
- Timestamp-based file naming preventing conflicts with automatic cache invalidation support enabling efficient CDN integration
- Graceful cleanup operations with comprehensive error tolerance ensuring system resilience during maintenance and failure scenarios

### File Lifecycle Management Architecture

**Upload Processing Pipeline**

1. **Client Validation**: File type, size, and dimension constraints with immediate user feedback preventing invalid submissions
2. **Image Processing**: Canvas-based resizing and WebP conversion with quality optimization balancing file size and visual fidelity
3. **Server Upload**: Base64 or buffer transmission with authentication and organization context validation ensuring secure operations
4. **Storage Persistence**: File system storage with timestamp-based naming and conflict prevention maintaining data integrity
5. **Database Integration**: Metadata storage with relational integrity and comprehensive audit trail creation supporting compliance

**Access Control and Serving**

- Public URL serving through Next.js static file handler with optimal caching headers and performance optimization
- Organization-scoped access validation through database metadata and RLS policies ensuring security compliance
- CDN-ready URL structure with cache invalidation support enabling efficient global content delivery
- Fallback mechanisms with default assets ensuring graceful degradation when files are missing or inaccessible

**Cleanup and Maintenance**

- Automatic old file deletion during profile picture updates with comprehensive error tolerance preventing data loss
- Database constraint enforcement preventing orphaned file references and maintaining referential integrity
- Lifecycle hooks for file archival and cleanup based on parent entity deletion supporting automated maintenance
- Administrative tools for storage quota management and organization-level file oversight enabling operational control

### Storage Security and Access Control

**Multi-Layer Security Architecture**

- **Application Layer**: Permission-based access control with role hierarchy and organization scoping preventing unauthorized access
- **Database Layer**: RLS policies enforcing organizational boundaries on file metadata access with comprehensive policy validation
- **File System Layer**: Organization-scoped directory structure with server-side access validation preventing direct file access
- **Network Layer**: Public serving through controlled Next.js routes with security headers and proper CORS configuration

**Data Protection Patterns**

- Secure file naming preventing path traversal attacks and directory enumeration ensuring system security
- Comprehensive input validation for file types, sizes, and content preventing malicious file upload and system compromise
- Organization boundary enforcement at every access point preventing cross-tenant data leakage and maintaining isolation
- Comprehensive audit logging with user identification and operation context supporting compliance and security monitoring

**Storage Quota and Resource Management**

- File size limits enforced at client and server levels preventing resource abuse and maintaining system stability
- Organization-level storage monitoring with usage tracking and administrative reporting enabling proactive resource management
- Automatic cleanup policies for deleted entities preventing storage accumulation and optimizing resource utilization
- Performance monitoring for storage operations with optimization recommendations ensuring efficient resource usage

### Default Asset Strategy and Fallback Systems

**Graceful Degradation Architecture**

- Default avatar system with 10 pre-generated WebP assets providing consistent user experience across all user states
- Random assignment algorithm for new user avatar selection ensuring visual diversity and preventing monotonous interface appearance
- Fallback to user initials display when profile pictures fail to load maintaining UI consistency and user identification
- Error boundary integration with user-friendly messaging for storage operation failures ensuring application stability

**Asset Availability Patterns**

- Static asset serving through Next.js with proper caching headers and CDN optimization for global performance
- Predictable URL patterns supporting preloading and progressive enhancement strategies improving user experience
- Backup asset locations with automatic failover for critical organizational assets ensuring business continuity
- Offline support considerations with cached asset strategies supporting progressive web application features

### Integration Patterns and API Architecture

**tRPC Integration for Type Safety**

- Type-safe file upload procedures with comprehensive input validation and structured error handling
- Consistent TRPCError patterns for file operation failures with detailed error information and user guidance
- Separate create, update, and delete procedures following RESTful patterns and maintaining operation clarity
- Background processing integration with proper error handling and user notification systems for long-running operations

**Server Component and Server Action Integration**

- Direct file serving through Server Components with server-side access validation ensuring security at every access point
- Server Action form handling for file uploads with progressive enhancement and comprehensive validation
- Hybrid component patterns combining server-rendered file displays with client-side upload interfaces for optimal user experience
- Request-level caching for file metadata queries preventing duplicate database operations and improving performance efficiency

### Migration and Evolution Strategy

**Storage Provider Flexibility**

- Abstract provider interface enabling migration from local to cloud storage without requiring code changes throughout application
- Environment-based provider configuration supporting different storage solutions across development, staging, and production environments
- Provider-specific optimization patterns with consistent API surface maintaining application code simplicity and reliability
- Migration tools and strategies for bulk file transfers during provider transitions ensuring business continuity

**Scalability and Performance Evolution**

- CDN integration readiness with proper URL structure and caching header configuration supporting global content delivery
- Image processing pipeline extensibility for additional formats and optimization strategies accommodating future requirements
- Storage backend flexibility supporting S3, Azure Blob, Google Cloud Storage, and other providers for operational scalability
- Performance monitoring integration with optimization recommendations and automatic scaling triggers ensuring system efficiency

### Content Delivery and Caching Strategy

**Static Asset Optimization**

- Next.js static file serving with proper cache headers enabling efficient browser caching and CDN integration
- WebP format standardization reducing bandwidth usage while maintaining visual quality across all asset types
- Immutable asset URLs with timestamp-based naming supporting aggressive caching strategies without cache invalidation issues
- Progressive loading patterns with placeholder images ensuring optimal perceived performance during asset loading

**CDN Integration Architecture**

- URL structure optimized for CDN distribution with proper cache control headers and geographic optimization
- Asset versioning strategy supporting cache busting and rollback capabilities during deployment and updates
- Edge caching configuration with geographic distribution supporting global user base and reducing latency
- Performance monitoring integration tracking asset delivery metrics and optimization opportunities for continuous improvement

## 10. User Journey Support Architecture

### Multi-Modal Authentication Architecture

**Flexible Entry Point Strategy**

- Authentication system supports anonymous, authenticated, and organization-scoped access patterns enabling seamless user onboarding
- Server-side authentication context with `getServerAuth()` providing immediate user state resolution in Server Components
- OAuth provider integration with automatic organization assignment through app_metadata ensuring smooth registration flows
- Development authentication helpers enabling consistent authentication patterns across all environments and testing scenarios

**Progressive Authentication Model**

- Anonymous users access core functionality through QR code scanning with automatic organization context resolution
- Registration flow preserves anonymous session context enabling seamless upgrade from anonymous to authenticated access
- Organization membership validation with automatic context repair preventing broken user states during role transitions
- Session persistence across authentication state changes ensuring uninterrupted workflow continuation

### Context-Aware Access Control

**Organization-Scoped Journey Management**

- Multi-tenant architecture ensures users only access authorized organizational data through RLS policies and application-layer scoping
- Organization context propagation through Server Components and Server Actions maintaining secure boundaries across all user interactions
- Subdomain-based tenant identification enabling organization-specific branding and configuration while preserving shared authentication infrastructure
- Cross-organization user membership support allowing users to participate in multiple organizations with role-specific permissions

**Role-Based Workflow Adaptation**

- Permission-driven UI rendering showing appropriate actions and navigation options based on user roles and organizational membership
- Server Component permission validation preventing unauthorized access attempts before page rendering occurs
- Dynamic navigation structure adapting to user permissions and organizational context ensuring intuitive workflow progression
- Administrative override patterns enabling organizational flexibility while maintaining security boundaries and audit trails

### Workflow State Management Architecture

**Issue Lifecycle Journey Support**

- Server Actions handling issue creation, updates, and status transitions with comprehensive validation and organizational scoping
- Assignment workflow supporting role-based automatic assignment with manual override capabilities for operational flexibility
- Status progression validation ensuring proper workflow compliance with organizational business rules and approval processes
- Background processing integration enabling notifications, analytics, and third-party integrations without blocking user interactions

**Machine and Location Context Integration**

- QR code scanning workflow providing immediate machine context for issue reporting with anonymous access capabilities
- Location hierarchy navigation supporting geographic organization of machines and technician workflow optimization
- Machine detail views combining server-rendered information with interactive client islands for status updates and issue management
- Asset lifecycle management enabling machine maintenance tracking with historical context and predictive maintenance capabilities

### Interactive Workflow Patterns

**Server-First Form Architecture**

- React 19 `useActionState` integration providing optimistic updates with server-side validation and comprehensive error handling
- Progressive enhancement ensuring form functionality without JavaScript while providing enhanced user experience when available
- Server Action form processing with automatic organization scoping and permission validation preventing unauthorized data modifications
- Real-time validation feedback using `useFormStatus` hook providing immediate user guidance without sacrificing server-side security

**Hybrid Component Workflow Integration**

- Server Components handling data fetching and initial rendering with Client Component islands for specific interactive requirements
- Form submission workflows combining server validation with client-side enhancement for optimal user experience and security
- Real-time collaborative features implemented as focused client islands within server-rendered workflow pages
- Navigation state management balancing server-side routing with client-side enhancements for mobile and interactive elements

### Cross-Journey Data Consistency

**Request-Level Data Coherence**

- React 19 `cache()` API integration preventing duplicate database queries within single user interaction ensuring consistent data views
- Organization context propagation ensuring all queries within user journey respect organizational boundaries and permissions
- Authentication context sharing across Server Components and Server Actions maintaining security state throughout workflow progression
- Database transaction patterns ensuring data consistency across complex multi-step workflows with proper rollback capabilities

**Session and Context Synchronization**

- Supabase SSR integration maintaining authentication state across server and client boundaries with automatic token refresh
- Cookie synchronization patterns ensuring session persistence across page transitions and browser tab management
- Organization context validation with automatic repair mechanisms preventing broken user states during membership changes
- Background task integration enabling post-workflow processing without disrupting user experience or workflow completion

### Navigation and Discovery Architecture

**Context-Sensitive Navigation**

- Server-rendered navigation structure reflecting user permissions and organizational membership with client-side enhancement islands
- Breadcrumb generation based on organizational hierarchy and user permissions providing clear workflow context and navigation aids
- Mobile-responsive navigation patterns adapting to device capabilities while maintaining consistent workflow accessibility
- Search and discovery patterns respecting organizational boundaries while enabling efficient information retrieval

**Progressive Disclosure Patterns**

- Information architecture supporting novice to expert user progression with appropriate detail levels for different user experience levels
- Dashboard customization enabling role-specific workflow emphasis while maintaining consistent navigation and interaction patterns
- Feature discovery through contextual help and guided workflows without disrupting experienced user efficiency
- Accessibility-first design ensuring navigation patterns work across assistive technologies and different interaction modalities

### Real-Time Collaboration Support

**Notification and Update Architecture**

- Organization-scoped notification system enabling workflow coordination without cross-tenant information leakage
- Real-time issue status updates supporting collaborative workflows with conflict resolution and optimistic update patterns
- Background synchronization ensuring data consistency across concurrent user sessions with proper conflict resolution strategies
- Integration points for external notification systems (email, SMS, webhooks) without compromising organizational data boundaries

**Concurrent User Workflow Management**

- Assignment conflict resolution preventing double-assignment with proper workflow coordination and administrative override capabilities
- Collaborative editing patterns for issues and machine documentation with version control and change attribution
- Resource locking patterns preventing conflicting modifications with timeout-based automatic release and administrative controls
- Activity tracking enabling workflow transparency and accountability without compromising user privacy and organizational boundaries

### Accessibility and Progressive Enhancement

**Universal Access Architecture**

- Server Component defaults ensuring core functionality works across all devices and assistive technologies without JavaScript requirements
- Progressive enhancement layering interactive features on accessible foundation without degrading core workflow functionality
- Keyboard navigation patterns supporting efficient workflow completion for power users and assistive technology compatibility
- Screen reader optimization with proper semantic markup and ARIA attributes supporting professional workflow efficiency

**Device and Network Adaptability**

- Mobile-first responsive design ensuring workflow completion across device types with appropriate input methods and screen sizes
- Offline capability considerations with local storage and sync patterns for critical workflow data and form preservation
- Network resilience with proper error handling and retry patterns ensuring workflow completion despite connectivity issues
- Performance optimization ensuring responsive user experience across different network conditions and device capabilities

### Workflow Analytics and Monitoring

**Journey Completion Tracking**

- Server Action analytics enabling workflow optimization and user experience improvement without compromising privacy
- Performance monitoring for critical workflow paths with alerting for degraded user experience conditions
- Error tracking and recovery patterns enabling proactive workflow issue resolution and system reliability improvement
- Audit trail generation supporting compliance requirements and organizational accountability without exposing sensitive information

**Continuous Workflow Improvement**

- User behavior analytics respecting privacy while enabling workflow optimization and feature discovery
- A/B testing framework for workflow improvements with organizational-scoped testing and rollback capabilities
- Feedback collection integration enabling user input on workflow efficiency and feature requests
- Performance metrics collection enabling architectural decisions based on actual user workflow patterns and system performance

### Integration and Extension Architecture

**Third-Party Service Integration**

- API integration patterns maintaining organizational boundaries while enabling external service connectivity
- Webhook support for workflow event notification with proper authentication and organizational context preservation
- External authentication provider integration supporting enterprise identity management while maintaining organizational isolation
- Data import/export capabilities supporting workflow migration and integration with existing organizational systems

**Workflow Customization Framework**

- Organization-specific workflow configuration enabling business rule customization without compromising system security
- Role definition flexibility supporting organizational hierarchy variations while maintaining permission system integrity
- Custom field support for issues and machines enabling organization-specific data capture without schema modifications
- Workflow template system enabling organizational workflow standardization while supporting operational flexibility

## 11. RSC Testing & Quality Architecture

### Testing Framework (historic)

**React Server Components Optimized Testing Strategy**

- Complete testing framework designed specifically for server-first architecture with minimal client islands
- Historic reference to nine categories; current guidance consolidates into Unit, Integration, E2E, RLS, Schema.
- Auto-generated mock system derived from seed data ensuring consistent test scenarios across all test types
- Progressive coverage strategy with quality gates enforcing architectural compliance and security boundaries

**Foundation Status**: Post-archive system with 205 passing unit tests, templates for core test types, and operational pgTAP RLS validation

### Test Types (historic reference)

**Unit Tests (`*.unit.test.ts`)**

- Pure function testing with zero external dependencies for maximum isolation and execution speed
- Server Action utilities, validation functions, formatters, and business logic components
- Type-safe testing patterns with TypeScript strictest configuration compliance
- Current example: `src/lib/actions/shared.unit.test.ts` with 205 comprehensive test assertions covering input validation, error handling, and edge cases

**Data Access Layer Tests (`*.dal.test.ts`)**

- Server Component data access patterns with organization scoping validation and authentication context mocking
- Business logic testing for direct database queries through Drizzle ORM integration
- Multi-tenant security boundary enforcement with cross-organization access denial verification
- React 19 cache() API integration testing preventing duplicate database queries within request lifecycle
- Current example: `src/lib/dal/issues.dal.test.ts` demonstrating organization-scoped query validation and security boundaries

**Client Island Tests (`*.client-island.test.tsx`)**

- Traditional React Testing Library patterns optimized for minimal interactive components within server-rendered pages
- Server-passed props validation ensuring proper data flow from Server Components to Client Components
- User interaction testing with event handling, form submissions, and state management validation
- Template ready: `src/test/templates/client-island.template.tsx` providing standardized testing patterns for client islands

**Server Action Tests (`*.server-action.test.ts`)**

- FormData processing validation with comprehensive field validation and structured error handling testing
- Authentication context propagation ensuring proper user and organization scoping throughout mutation workflows
- Database mutation verification with transaction rollback testing and cache revalidation pattern validation
- Progressive enhancement scenarios ensuring form functionality without JavaScript execution
- Active implementation: `src/lib/actions/issue-actions.server.test.ts` and comprehensive template with 400+ lines covering all Server Action patterns

**Hybrid Component Tests (`*.hybrid-component.test.ts`)**

- Server shell plus Client island integration testing ensuring proper hydration boundaries and data flow
- Hydration state matching verification preventing client-server rendering mismatches
- Selective hydration verification ensuring only necessary components receive client-side JavaScript
- Server/client boundary data flow testing validating props passing and state synchronization patterns

**Integration Example Tests (`*.integration.test.ts`)**

- Cross-type integration demonstration showing comprehensive testing approach across multiple component types
- End-to-end workflow validation combining Server Components, Server Actions, and Client islands
- Performance and memory management testing ensuring efficient resource utilization
- Current example: `src/test/integration/archetype-integration-example.test.ts` with 410+ lines demonstrating integration patterns (historic filename)

**End-to-End Tests (`*.e2e.test.ts`)**

- Playwright browser automation for complete user journeys with RSC rendering validation
- Multi-browser compatibility testing across Chromium, Firefox, and WebKit engines
- Progressive enhancement testing ensuring core functionality works without JavaScript
- Authentication flow testing with subdomain-based multi-tenancy and organization context validation
- Active implementation: `e2e/smoke-test-workflow.spec.ts` with 491 lines covering 11-step comprehensive workflow

**Row-Level Security Tests (`*.rls.test.sql`)**

- pgTAP-based PostgreSQL testing for comprehensive multi-tenant boundary enforcement validation
- Database-level security policy verification ensuring organizational data isolation
- SQL-level security verification with zero-tolerance cross-organizational data access testing
- Critical security boundary testing with 14 comprehensive tests covering all RLS policies
- Active implementation: `supabase/tests/rls/issues-minimal.test.sql` providing essential security validation

**Schema Tests (`*.schema.test.sql`)**

- Database constraint validation and referential integrity testing
- Foreign key relationship verification ensuring proper organizational scoping
- Schema evolution testing with migration validation and rollback verification
- Template ready: `src/test/templates/schema.template.sql` providing database constraint testing patterns

### Auto-Generated Mock System Architecture

**Seed Data Foundation**

- SEED_TEST_IDS constants providing predictable test data identifiers for consistent debugging across test types
- Hardcoded organization, user, and machine identifiers eliminating random UUID unpredictability
- Multi-tenant test scenarios with primary organization ("test-org-pinpoint") and competitor organization ("test-org-competitor") isolation
- Cross-organization boundary validation ensuring security policy enforcement at application and database levels

**Mock Factory System**

- `SeedBasedMockFactory` generating consistent mock objects across all test types based on actual seed data patterns
- Relationship-aware mock generation maintaining foreign key integrity and organizational scoping constraints
- Type-safe mock factories derived from Drizzle schema definitions ensuring compile-time validation of test data
- Realistic test scenarios based on actual seed patterns reflecting production data structures and relationships

**Mock Data Specifications**

- **Organizations**: Primary ("Austin Pinball Collective") and competitor ("Competitor Arcade") with distinct organizational contexts
- **Users**: Admin (Tim Froehlich), Member1 (Harry Potter), Member2 (Escher User) with role-specific permissions and organizational membership
- **Machines**: Medieval Madness, Cactus Canyon, Twilight Zone, Creature, and Black Knight with authentic pinball machine data
- **Issues**: Comprehensive issue scenarios with priority levels, status progressions, and assignment patterns
- **Comments**: Multi-user comment threads with proper attribution and organizational context validation

**FormData Mock Integration**

- `MockFormDataFactory` creating realistic form submission scenarios for Server Action testing
- Valid and invalid FormData scenarios ensuring comprehensive validation testing coverage
- Edge case scenario generation for boundary condition testing and error handling validation
- Progressive enhancement testing data ensuring forms work without JavaScript execution

### Database Testing Infrastructure

**pgTAP Integration for Security Validation**

- PostgreSQL Testing & Procedure framework providing comprehensive database-level testing capabilities
- Row Level Security policy validation ensuring multi-tenant boundary enforcement at database level
- Database constraint testing validating foreign key relationships and organizational scoping integrity
- SQL-level security verification with zero-tolerance cross-organizational data access policies
- Automated execution through `npm run test:rls` with 14 critical security boundary tests

**PGlite Worker-Scoped Testing Pattern**

- Memory-safe per-test database instances preventing test interference and ensuring isolation
- Schema application and rollback patterns enabling consistent test environment setup and teardown
- Integration test isolation bypassing RLS policies for application-layer testing scenarios
- Performance-optimized in-memory database instances reducing test execution time and resource consumption
- Worker-scoped pattern preventing system lockups and memory accumulation during test execution

**Seed Data Architecture for Predictable Testing**

- Hardcoded test identifiers in `src/test/constants/seed-test-ids.ts` providing 118 lines of predictable test data constants
- Organization-scoped test scenarios with primary and competitor organization contexts
- User role hierarchy testing with admin, member, and technician permission levels
- Machine and location hierarchies supporting geographic and collection-based testing scenarios
- Cross-type consistency ensuring identical test data usage across unit, integration, and E2E test levels

### Vitest Configuration for Server-First Architecture

**Environment and Execution Configuration**

- Node.js environment configuration optimized for Server Component testing execution
- Global test utilities and assertion libraries with 30-second timeout for comprehensive test scenarios
- Test file discovery patterns targeting expected filename conventions
- Coverage provider configuration using V8 engine for accurate Server Component coverage measurement

**Coverage Strategy and Thresholds**

- Ultra-low initial thresholds (5% global coverage) supporting test system reboot and gradual coverage increase
- Comprehensive reporter configuration including text, JSON, HTML, and LCOV formats for CI/CD integration
- Exclusion patterns for archived tests, documentation, and non-production code ensuring accurate coverage metrics
- Environment-based coverage enabling with `COVERAGE=true` flag for development and CI environments

**Test Execution Scripts Integration**

- `npm test` for single unit test execution with current 205 passing assertions
- `npm run test:watch` providing development mode with file change monitoring and automatic re-execution
- `npm run test:all` combining unit, RLS, and smoke testing for comprehensive validation
- Memory-efficient execution preventing test interference and system resource exhaustion

### Playwright End-to-End Testing Configuration

**Multi-Browser Testing Strategy**

- Comprehensive browser coverage including Chromium, Firefox, and WebKit for cross-browser compatibility validation
- Subdomain-based multi-tenancy testing with organization-specific routing (`apc.localhost:3000`)
- Authentication flow testing with OAuth provider integration and session management validation
- Progressive enhancement verification ensuring core functionality works across different JavaScript execution environments

**RSC-Specific Testing Patterns**

- Server Component rendering validation ensuring proper server-side HTML generation
- Hydration boundary testing validating client island integration within server-rendered pages
- Navigation testing with server-side routing and client-side enhancement validation
- Form submission testing covering both Server Action execution and progressive enhancement fallback scenarios

**Test Execution Infrastructure**

- Automated development server startup with 120-second timeout for complete application initialization
- Test isolation with proper cleanup and state reset between test scenarios
- Performance monitoring with Core Web Vitals tracking and loading performance validation
- Network request monitoring ensuring efficient resource utilization and proper caching behavior

### Quality Gates and Progressive Coverage Strategy

**Balanced Coverage Across Test Types**

- Automated validation ensuring coverage distribution across test types
- Prevention of over-concentration in a single test type maintaining a comprehensive approach
- Quality gate enforcement promoting representation across test types before production deployment
- Continuous integration validation preventing architectural degradation through inadequate testing

**Progressive Coverage Targets with Weekly Milestones**

- **Week 1 (5-10%)**: Unit Tests focusing on Server Action utilities and validation functions
- **Week 2 (15-25%)**: Server Components and DAL Integration with organization-scoped query validation
- **Week 3 (30-45%)**: Server Actions with FormData processing and Client Islands with user interaction testing
- **Week 4 (45-65%)**: Hybrid Components with server/client integration and Advanced testing patterns
- **Week 5+ (60%+)**: End-to-End testing with complete user journeys and Production security validation

**Security and Performance Gate Enforcement**

- Multi-tenant scoping validation in every test type ensuring organizational boundary compliance
- Server Component query performance monitoring with N+1 query detection and optimization recommendations
- Server Action security testing with authentication context validation and authorization boundary verification
- Progressive enhancement verification ensuring accessibility and functionality across different user agent capabilities

**Pre-commit Quality Enforcement Pipeline**

- Mandatory test execution before commit acceptance with zero tolerance for failing tests
- Husky pre-commit hooks with shellcheck validation ensuring script quality and security
- Lint and type-check validation with TypeScript strictest configuration compliance
- Organization scoping compliance validation preventing multi-tenant boundary violations

### Test Creation and Development Workflow

**Test Creation Standards**

- Test types and naming/placement defined in `docs/CORE/TESTING_GUIDE.md`
- Templates and helpers available under `src/test/` where useful
- Customization allowed while maintaining architectural boundaries and consistency
- Shared utilities encourage consistent approaches across different component types

**Mock System Integration Workflow**

- Seed data synchronization ensuring mock factory alignment with actual database seed patterns
- Type-safe mock generation derived from Drizzle schema definitions with automatic TypeScript validation
- Cross-type mock consistency preventing test scenario divergence and ensuring reliable debugging
- Performance-optimized mock generation with caching and memory management for large test suites

**Development Experience Optimization**

- Hot reloading support for test files with sub-50ms update times during active development
- IDE integration with proper TypeScript support and intellisense for test helpers and mock factories
- Debugging support with source maps and proper stack trace preservation
- Test organization patterns supporting feature-based development and domain-driven testing approaches

### Integration with CI/CD and Production Deployment

**Continuous Integration Validation**

- Automated test execution across all test types in CI/CD pipeline with parallel execution optimization
- Coverage reporting integration with pull request validation and coverage trend analysis
- Security gate enforcement preventing deployment of code with multi-tenant boundary violations
- Performance regression detection with automatic alerts for degraded test execution times

**Production Readiness Validation**

- End-to-end testing with production-like data scenarios and realistic user journey simulation
- Load testing integration with database performance validation under concurrent user scenarios
- Security penetration testing integration with automated vulnerability detection and reporting
- Monitoring integration providing runtime validation of architectural assumptions and performance characteristics

**Release Quality Assurance**

- Comprehensive smoke testing before production deployment with critical path validation
- Rollback testing ensuring deployment reversibility and data integrity preservation
- A/B testing framework integration supporting gradual feature rollout and performance monitoring
- Post-deployment validation with automated health checks and performance monitoring integration

## 12. Areas Requiring Refinement

**What**: Architecture decisions that need further definition
**How**: Identify gaps where user journeys or technical requirements need more specific architectural decisions
**Content**: Real-time notification system, advanced search/filtering, analytics architecture, background job processing, audit logging

---

_This document serves as PinPoint's architectural north star. Each section will be filled with concrete architectural decisions that guide implementation without specifying implementation details._
