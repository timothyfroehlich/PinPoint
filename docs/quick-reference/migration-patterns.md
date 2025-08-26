# Drizzle-Only Architecture Patterns

Current patterns for PinPoint's 100% Drizzle-only architecture after completed Prisma removal.

## 🎯 Architecture Status

**Migration Status**: ✅ **COMPLETE** - Prisma fully removed  
**Current State**: 100% Drizzle-only architecture achieved  
**Infrastructure**: Single Drizzle client throughout system  
**Context**: Modern TypeScript + Drizzle + Supabase SSR stack

---

## 🔧 Service Layer Architecture

### Standard Service Pattern

**Pattern**: All services use Drizzle-only dependency injection

```typescript
export class CollectionService {
  constructor(private db: DrizzleClient) {}

  async getLocationCollections(locationId: string) {
    return await this.db.query.collections.findMany({
      where: or(
        eq(collections.location_id, locationId),
        and(isNull(collections.location_id), eq(collections.is_manual, false)),
      ),
    });
  }
}
```

### Service Architecture

**Current Services** (All Drizzle-only):

- **Security**: `roleService.ts`, `permissionService.ts`
- **Core Business**: `collectionService.ts`, `issueActivityService.ts`, `notificationService.ts`
- **Integration**: `pinballmapService.ts`, `commentCleanupService.ts`, `qrCodeService.ts`

---

## 🏗️ Infrastructure Architecture

### tRPC Context Pattern

**Pattern**: Single Drizzle client in tRPC context

```typescript
export interface TRPCContext {
  db: DrizzleClient;
  session: Session | null;
  supabase: SupabaseClient;
}

// Usage in procedures
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.session.user.id,
      organizationId: ctx.session.user.user_metadata?.organizationId,
    },
  });
});
```

---

## 🔐 Supabase SSR Authentication

### Server Client Creation

**Pattern**: Server client with cookie management → @docs/developer-guides/supabase/auth.md#server-client

### Next.js Middleware Integration

**Critical**: Always call `getUser()` for token refresh → @docs/migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md#middleware

### Server Action Auth Pattern

**Pattern**: `'use server'` auth actions with redirect → @docs/migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md#server-actions

---

## 🧪 Test Infrastructure (Simplified)

### Current Test Architecture

**Status**: Minimal baseline system after test infrastructure archive

```typescript
// Current test pattern (Pure functions only)
import { describe, it, expect } from "vitest";
import { validateEmail } from "../inputValidation";

describe("Input Validation", () => {
  it("should validate email formats correctly", () => {
    expect(validateEmail("user@domain.com")).toBe(true);
    expect(validateEmail("invalid")).toBe(false);
  });
});
```

### Test Commands

```bash
npm test                    # Unit tests (1 file, 205 tests)
npm run test:rls           # pgTAP RLS policy tests
npm run smoke              # Playwright smoke tests
```

**Note**: Complex integration testing infrastructure archived to `.archived-tests-2025-08-23/` during system simplification. Focus on velocity and rapid prototyping.

---

## 🚦 Current Architecture Decision Tree

```
Development Task:
├── New service class? → Use Drizzle-only pattern + @docs/developer-guides/drizzle/current-patterns.md
├── Database operations? → Use Drizzle queries + @docs/quick-reference/api-security-patterns.md
├── Auth integration? → Use Supabase SSR + @docs/developer-guides/supabase/auth-patterns.md
├── Testing needed? → Use minimal patterns + @docs/quick-reference/testing-patterns.md
└── API endpoint? → Use tRPC with organizationId scoping + @docs/quick-reference/typescript-strictest-patterns.md
```

---

## ⚠️ Common Architecture Pitfalls

**Service Implementation:**

- ❌ Using multiple database clients in one service
- ✅ Single Drizzle client dependency injection pattern
- ❌ Missing organizationId scoping in queries
- ✅ Always include organization-level Row Level Security scoping
- ❌ Complex service hierarchies with circular dependencies
- ✅ Simple service classes with clear single responsibility

**Database Operations:**

- ❌ Raw SQL without parameterization
- ✅ Use Drizzle query builder with proper type safety
- ❌ Missing transaction boundaries for multi-table operations
- ✅ Use Drizzle transactions for atomic operations
- ❌ Inconsistent snake_case/camelCase field naming
- ✅ Follow snake_case database schema, camelCase TypeScript variables

**Testing Approach:**

- ❌ Over-engineering test infrastructure during rapid prototyping
- ✅ Focus on critical paths: security policies, data validation, core business logic
- ❌ Testing implementation details of rapidly changing UI
- ✅ Test stable contracts and user-facing behavior

---

## 📋 Development Process

**Standard Workflow:** Plan feature → Implement service → Add API route → Update UI → Test critical paths  
**Security First:** Always include organizationId scoping for multi-tenant data isolation  
**Type Safety:** Use TypeScript strict mode and Drizzle's type inference

---

## 🎯 Architecture Quality Indicators

**Technical Health:**

- ✅ TypeScript builds with zero errors
- ✅ All services use consistent Drizzle-only patterns
- ✅ Database operations properly scoped by organization
- ✅ Authentication flows use Supabase SSR patterns
- ✅ Critical business logic has test coverage

**Architecture Maturity:**

- ✅ Service layer: 100% Drizzle-only with consistent patterns
- ✅ Infrastructure: Single database client throughout
- ✅ Dependencies: Modern stack (Next.js, Drizzle, Supabase, Material-UI)
- ✅ Security: Row Level Security policies enforced
- ✅ Testing: Strategic coverage for stable, critical functionality

---

**Related Patterns:**

- API Security: `@docs/quick-reference/api-security-patterns.md`
- TypeScript Patterns: `@docs/quick-reference/typescript-strictest-patterns.md`
- Testing Strategy: `@docs/quick-reference/testing-patterns.md`
