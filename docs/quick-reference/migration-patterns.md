# Final Migration Patterns: Complete Prisma Removal

Service layer conversion and infrastructure cleanup workflows for complete Prisma removal.

## 🎯 Final Migration Phase Context

**Phase:** Complete Prisma removal - service layer conversion and infrastructure cleanup  
**Status:** Router layer 85%+ complete, service layer conversion in progress  
**Approach:** Direct Drizzle-only implementations, no dual-ORM patterns, complete removal  
**Context:** Solo development, pre-beta - see [CLAUDE.md → Migration Status](../../CLAUDE.md#🚨-migration-status-final-prisma-removal-phase-🚨)

---

## 🔧 Service Layer Conversion Patterns

### Service Constructor Updates

**Pattern**: Convert Prisma-based services to Drizzle-only dependency injection

**Before (Dual-ORM):**
```typescript
export class CollectionService {
  constructor(private prisma: PrismaClient, private drizzle: DrizzleClient) {}
}
```

**After (Drizzle-only):**
```typescript
export class CollectionService {
  constructor(private db: DrizzleClient) {}
}
```

### Business Logic Preservation

**Pattern**: Maintain identical functionality while converting data access patterns

**Conversion Priority:**
- **High**: `roleService.ts`, `permissionService.ts` (security-critical)
- **Medium**: `collectionService.ts`, `issueActivityService.ts` (business logic)
- **Low**: `pinballmapService.ts`, `commentCleanupService.ts` (utilities)

---

## 🏗️ Infrastructure Cleanup Patterns

### tRPC Context Simplification

**Pattern**: Remove dual-ORM from tRPC context, single Drizzle client

**Before (Dual-ORM):**
```typescript
export interface TRPCContext {
  db: PrismaClient;
  drizzle: DrizzleClient;
}
```

**After (Drizzle-only):**
```typescript
export interface TRPCContext {
  db: DrizzleClient; // Renamed from drizzle to db
}
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

## 🧪 Test Infrastructure Updates

### Mock Pattern Conversion

**Pattern**: Update test mocks from dual-ORM to Drizzle-only patterns

**Before (Dual-ORM Mocks):**
```typescript
const mockContext = {
  db: mockPrisma,
  drizzle: mockDrizzle,
}
```

**After (Drizzle-only Mocks):**
```typescript
const mockContext = {
  db: mockDrizzle, // Single client, renamed
}
```

### Integration Test Memory Safety

**Pattern**: Continue using worker-scoped PGlite to prevent memory blowouts → @docs/quick-reference/testing-patterns.md#pglite

---

## 🚦 Final Migration Decision Tree

```
Final Migration Task:
├── Service conversion? → Use drizzle-migration agent + @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md
├── Infrastructure cleanup? → @prisma-removal-tasks/phase-2-infrastructure.md
├── Test updates? → Use test-architect agent + @docs/quick-reference/testing-patterns.md
├── Dependency removal? → @prisma-removal-tasks/phase-7-cleanup.md
└── Complete task plan? → @prisma-removal-tasks/README.md
```

---

## ⚠️ Final Migration Pitfalls

**Service Conversion Issues:**

- ❌ Leaving Prisma client in service constructors
- ✅ Convert to Drizzle-only dependency injection
- ❌ Attempting to maintain dual-ORM patterns
- ✅ Complete removal of all Prisma references
- ❌ Breaking business logic during conversion
- ✅ Preserve functionality while modernizing data access

**Infrastructure Cleanup:**

- ❌ Leaving dual clients in tRPC context
- ✅ Single Drizzle client throughout system
- ❌ Keeping parallel validation code
- ✅ Clean removal of comparison/logging infrastructure

**Test Updates:**

- ❌ Keeping Prisma mock patterns in tests
- ✅ Update all test mocks to Drizzle-only patterns
- ❌ Breaking integration test memory safety
- ✅ Maintain worker-scoped PGlite for memory efficiency

---

## 📋 Service Conversion Process

**Quick Checklist:** Read service → Convert to Drizzle → Update tests → Validate functionality  
**Detailed workflow:** @prisma-removal-tasks/phase-1-services.md

---

## 🎯 Final Migration Success Indicators

**Technical Metrics:**

- TypeScript build passes with zero Prisma references
- All services use Drizzle-only dependency injection
- Infrastructure uses single database client
- All tests pass with updated mocks
- Manual user flows work correctly

**Completion Metrics:**

- Service layer: 100% converted from Prisma to Drizzle
- Infrastructure: Single Drizzle client in tRPC context
- Dependencies: Zero Prisma packages remaining
- Tests: All mocks updated to Drizzle-only patterns

---

**Complete removal plan**: @prisma-removal-tasks/README.md
