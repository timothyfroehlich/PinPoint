# PinPoint Current Architecture Analysis

## System Overview

PinPoint is a multi-tenant SaaS application for arcade/pinball machine issue tracking and management. Built as a solo development project in pre-beta phase with zero production users.

### Tech Stack

- **Frontend**: Next.js 15 App Router + React 18 + Material-UI (MUI)
- **API Layer**: tRPC with end-to-end type safety
- **Database**: PostgreSQL + Supabase + Drizzle ORM
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **Multi-tenancy**: Organization-scoped data with RLS policies
- **Deployment**: Vercel (planned)

### Core Business Logic

Multi-tenant system where organizations manage:

- **Locations** (physical arcade locations)
- **Machines** (pinball/arcade games at locations)
- **Issues** (customer-reported problems with machines)
- **Users** with role-based permissions (Admin, Technician, Owner, Member)

## Current Architecture Pattern

### Authentication Flow

```typescript
// 1. Client-side auth provider manages global state
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)  // ⚠️ Initial loading state

  useEffect(() => {
    // Async auth check after hydration
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)  // ⚠️ State change after mount
    })
  }, [])

  // ⚠️ Auth state changes trigger re-renders throughout app
  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

// 2. Components consume auth context
export function PrimaryAppBar() {
  const { user, loading } = useAuth()  // ⚠️ Client-side auth dependency

  return (
    <AppBar>
      {loading ? (
        <Skeleton />  // ⚠️ Loading state during hydration
      ) : user ? (
        <AuthenticatedNav user={user} />  // ⚠️ Conditional rendering
      ) : (
        <UnauthenticatedNav />  // ⚠️ Different server/client renders
      )}
    </AppBar>
  )
}

// 3. tRPC procedures check auth server-side
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {  // Server-side auth check
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, user: ctx.session.user } })
})
```

### Data Flow Pattern

```
1. Page loads → Server renders with no auth state
2. Client hydrates → useAuth() starts with loading: true
3. Auth check completes → Context updates, triggers re-renders
4. Components re-render → Different content than server render
5. Hydration mismatch → React warnings/errors
```

## Critical Problems

### 1. **Hydration Mismatch Errors** 🚨

**Symptom**: React console errors about server/client render differences

```
Warning: Text content did not match. Server: "" Client: "Sign In"
Warning: An error occurred during hydration. The error was suppressed.
```

**Root Cause**: Server renders without auth state, client renders with auth state after async loading.

**Impact**:

- Console spam degrades developer experience
- Potential UI flicker/layout shift
- SEO issues with mismatched content
- Debugging complexity when errors occur

### 2. **Authentication State Complexity** 🔄

**Problem**: Auth state managed in 4+ different places:

- Client context (`useAuth` hook)
- tRPC context (server-side)
- Supabase session (cookie-based)
- Component-level loading states

**Impact**:

- Difficult to debug auth issues
- Inconsistent auth checks across app
- Race conditions between different auth sources
- Complex testing scenarios

### 3. **Performance Issues** ⏱️

**Problems**:

- Large client bundle due to MUI + auth context
- Delayed Time-to-Interactive due to auth loading
- Multiple re-renders during auth resolution
- No server-side auth optimization

**Measurements**:

- Current TTI: ~2.5s (estimated)
- Client bundle: ~85kb (estimated)
- Auth resolution: 200-500ms additional delay

### 4. **Multi-tenant Security Gaps** 🔐

**Current Pattern**:

```typescript
// ❌ Client-side org context switching
const { organizationId } = useAuth()
const issues = api.issues.list.useQuery({ organizationId })

// ✅ Server-side RLS as backup
create policy "Users can only see their org's issues"
on issues for all to authenticated
using (organization_id = auth.jwt() ->> 'organizationId');
```

**Problems**:

- Organization context depends on client state
- RLS policies as only reliable security boundary
- Difficult to audit multi-tenant access patterns
- Client-side org switching creates edge cases

### 5. **Developer Experience Issues** 🛠️

**Daily Pain Points**:

- Hydration errors require constant `useClientMounted` workarounds
- Auth testing requires mocking multiple layers
- Debugging requires checking server, client, and database logs
- Component conditional rendering creates complex branches

## Architecture Strengths

### ✅ **What's Working Well**

1. **tRPC Integration**: End-to-end type safety works excellently
2. **RLS Security**: Database-level multi-tenant security is solid
3. **Drizzle ORM**: Modern, type-safe database queries
4. **MUI Components**: Rich UI library with good patterns
5. **Development Velocity**: Solo developer can iterate quickly
6. **Supabase Auth**: Solid authentication provider with good features

### ✅ **Proven Patterns**

- Organization-scoped data queries work reliably
- Role-based permissions integrate well with RLS
- tRPC procedures provide clean API boundaries
- TypeScript provides good developer safety

## User Journey Impact Analysis

### Critical User Journeys Affected

**1.1. Anonymous Issue Reporting**

- ✅ Works: QR code → form → submission
- ⚠️ Problem: Loading states during hydration may confuse users

**1.5. User Registration & Login**

- ✅ Works: Modal auth flow functions
- ⚠️ Problem: Post-login redirect has hydration delay

**2.1. Authenticated Issue Reporting**

- ✅ Works: User identity attached correctly
- ⚠️ Problem: Auth state resolution delay impacts UX

**4.1. Technician Daily Triage**

- ✅ Works: Issue filtering and management
- ⚠️ Problem: Auth-dependent navigation has loading states

**5.5. Admin User Management**

- ✅ Works: Role assignments and permissions
- ⚠️ Problem: Organization context switching edge cases

### User Journeys NOT Affected

- Core business logic (issue creation, management, resolution)
- Database integrity and RLS enforcement
- tRPC API functionality and type safety
- Multi-tenant data isolation

## Technical Debt Assessment

### High Priority Issues

1. **Hydration mismatches** - Daily developer friction
2. **Auth state complexity** - Makes debugging difficult
3. **Performance impact** - Affects user perception

### Medium Priority Issues

1. **Client bundle size** - Impacts loading times
2. **Testing complexity** - Slows development velocity
3. **Security audit complexity** - Makes security review harder

### Low Priority Issues

1. **SEO optimization** - Not critical for B2B SaaS
2. **Progressive enhancement** - Not required for authenticated app
3. **Edge caching** - Premature optimization for current scale

## Migration Constraints & Requirements

### ✅ **Must Preserve**

- **tRPC integration**: End-to-end type safety is critical
- **Supabase Auth**: Solid provider, good feature set
- **RLS policies**: Multi-tenant security foundation
- **Drizzle ORM**: Modern, type-safe database layer
- **All user journeys**: No functionality regression allowed
- **Solo development**: Architecture must stay in one person's head

### ✅ **Can Change**

- Authentication patterns and state management
- Component rendering strategies (server vs client)
- Build/bundle optimization approaches
- Developer experience tooling

### ❌ **Cannot Change**

- Database schema (locked in pre-beta)
- Core business logic and user journeys
- Multi-tenant organization model
- Existing tRPC API contracts

## Success Criteria for Any Solution

### 🎯 **Primary Goals**

1. **Eliminate hydration errors**: Zero React hydration warnings
2. **Simplify auth debugging**: Single source of truth for auth state
3. **Maintain type safety**: Keep tRPC end-to-end type safety
4. **Preserve functionality**: All user journeys work identically

### 🎯 **Secondary Goals**

1. **Improve performance**: Faster TTI, smaller bundles
2. **Enhance security**: Clearer multi-tenant boundaries
3. **Better DX**: Easier testing and debugging patterns
4. **Future-proof**: Align with 2025+ industry standards

### 📊 **Measurable Outcomes**

- **Zero hydration errors** in browser console
- **Sub-1s Time-to-Interactive** on dashboard pages
- **<50kb client bundle** size for core app
- **Single auth source** eliminates debugging confusion
- **All 15+ user journeys** work without regression

## Questions for Architectural Review

1. **Complexity vs Benefit**: Which plan provides the best ratio of simplicity gain to migration effort?

2. **Long-term Maintainability**: Which approach will be easiest to maintain and extend as a solo developer?

3. **Risk Assessment**: What are the highest-risk elements of each migration plan?

4. **Performance Impact**: Which plan delivers meaningful performance improvements for the specific use case?

5. **Industry Alignment**: Which approach best aligns with current industry best practices and future trends?

---

## Appendix: Current File Structure

```
src/
├── app/
│   ├── auth-provider.tsx          # Client-side auth context (problem source)
│   ├── providers.tsx              # Global providers with hydration workarounds
│   ├── page.tsx                   # Main page with conditional auth rendering
│   └── dashboard/
│       └── _components/
│           └── PrimaryAppBar.tsx  # Navigation with auth-dependent rendering
├── server/
│   └── api/
│       ├── trpc.base.ts          # tRPC context with server-side auth
│       └── routers/              # Organization-scoped tRPC procedures
├── lib/
│   └── supabase/
│       ├── client.ts             # Client-side Supabase instance
│       └── server.ts             # Server-side Supabase instance (limited)
└── hooks/
    └── useClientMounted.ts       # Hydration workaround utility
```

## Context for Evaluation

**Project Phase**: Pre-beta, solo development, zero production users
**Primary Developer**: Single full-stack developer
**Decision Timeline**: Architectural decision needed before production launch
**Risk Tolerance**: High - breaking changes acceptable during pre-beta phase
