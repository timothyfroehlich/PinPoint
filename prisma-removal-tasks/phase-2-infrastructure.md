# Phase 2: Core Infrastructure Conversion

**Timeline**: 1 day  
**Impact**: High - Affects all database operations  
**Approach**: Manual conversion of core infrastructure files  

## 🎯 Overview

Remove Prisma from the core infrastructure layer - tRPC context, database provider, and main database export. This eliminates the dual-ORM pattern and makes the system Drizzle-only.

**Why Phase 2**: After service layer conversion, the infrastructure layer is the only remaining high-impact area using Prisma. Removing it eliminates the dual-ORM overhead and simplifies the system.

## 📋 Tasks

### **Priority 1: tRPC Context Cleanup**

- [ ] **Update `src/server/api/trpc.base.ts`** - Remove Prisma from tRPC context
  - Current: Context includes both `db: ExtendedPrismaClient` and `drizzle: DrizzleClient`
  - Target: Context includes only `drizzle: DrizzleClient` (rename to `db`)
  - Action: Remove Prisma client creation and type references
  - Impact: All routers that use `ctx.db` will need updates (should be zero after Phase 1)

### **Priority 2: Database Provider Simplification**  

- [ ] **Update `src/server/db/provider.ts`** - Remove Prisma client management
  - Current: Manages both Prisma and Drizzle clients via singleton pattern
  - Target: Manage only Drizzle client
  - Action: Remove Prisma client creation, connection management, and types
  - Impact: Simplified provider with single responsibility

### **Priority 3: Main Database Export**

- [ ] **Update `src/server/db.ts`** - Export Drizzle client only
  - Current: Exports both `db` (Prisma) and `drizzle` clients
  - Target: Export single `db` (Drizzle) client
  - Action: Remove Prisma export, rename drizzle export to `db`
  - Impact: All imports need to be updated from `drizzle` to `db`

### **Priority 4: Environment Variable Cleanup**

- [ ] **Review environment variable usage** - Consolidate database URLs
  - Current: May have separate `DATABASE_URL` (Prisma) and `DRIZZLE_DATABASE_URL`  
  - Target: Single `DATABASE_URL` for Drizzle
  - Action: Update .env files and configuration
  - Impact: Simplified configuration

## 🔧 Conversion Strategy

### **Step-by-Step Approach**

**1. Database Provider Update (`provider.ts`)**
```typescript
// Remove Prisma client management
// Keep only Drizzle client with connection pooling
// Update singleton pattern for Drizzle-only
```

**2. Main Export Update (`db.ts`)**  
```typescript
// Change from: export { db, drizzle }
// Change to: export { db } (where db is the Drizzle client)
```

**3. tRPC Context Update (`trpc.base.ts`)**
```typescript
// Remove: db: ExtendedPrismaClient
// Keep: drizzle: DrizzleClient  
// Or rename: db: DrizzleClient (preferred)
```

**4. Import Updates Throughout Codebase**
```typescript
// Update any remaining imports from:
import { drizzle } from "~/server/db"
// To:
import { db } from "~/server/db"
```

### **Critical Decision Point: Context Property Naming**

**Option A**: Keep `ctx.drizzle` (minimal changes)
**Option B**: Rename to `ctx.db` (cleaner, requires router updates)

**Recommendation**: Choose Option B for cleaner final state, update routers in this phase.

## 🔍 File-by-File Breakdown

### **`src/server/db/provider.ts`**

**Current State Analysis:**
- Manages both Prisma and Drizzle connections
- Singleton pattern for both clients
- Connection pooling and lifecycle management

**Conversion Tasks:**
- [ ] Remove all Prisma client code
- [ ] Remove Prisma-related imports and types  
- [ ] Simplify singleton to Drizzle-only
- [ ] Update connection management for single client
- [ ] Clean up any Prisma-specific connection options

### **`src/server/db.ts`**

**Current State Analysis:**
- Exports both `db` (Prisma) and `drizzle` clients
- May have schema imports for both ORMs

**Conversion Tasks:**
- [ ] Remove Prisma client export
- [ ] Rename `drizzle` export to `db`  
- [ ] Remove Prisma schema imports
- [ ] Update any type exports

### **`src/server/api/trpc.base.ts`**

**Current State Analysis:**
- Creates both Prisma and Drizzle clients in context
- May have service factories that use both

**Conversion Tasks:**
- [ ] Remove Prisma client from context type
- [ ] Remove Prisma client creation in context factory
- [ ] Update service factory calls (should use Drizzle services after Phase 1)
- [ ] Rename `drizzle` to `db` in context (if choosing Option B)

## 🔄 Import Update Strategy

### **Files Likely Requiring Import Updates:**

After renaming exports, these file patterns may need import updates:
- `src/server/api/routers/**/*.ts` - Router files using `ctx.drizzle`
- `src/server/services/**/*.ts` - Service files importing database client
- `src/test/**/*.ts` - Test files mocking database client

### **Systematic Update Process:**

1. **Make infrastructure changes first**
2. **Let TypeScript compilation errors guide import updates**  
3. **Use Find & Replace for systematic updates:**
   - Find: `import { drizzle }` → Replace: `import { db }`
   - Find: `ctx.drizzle` → Replace: `ctx.db`
   - Find: `drizzle.query` → Replace: `db.query`

## 🚦 Validation Process

### **After Each File Update:**

1. **TypeScript Compilation** - Fix any type errors immediately
2. **Import Resolution** - Ensure all imports resolve correctly
3. **Service Integration** - Verify services still work with new exports
4. **Context Functionality** - Test tRPC context creation

### **Phase 2 Completion Criteria:**

- [ ] Zero Prisma references in infrastructure files
- [ ] Single database client in tRPC context  
- [ ] Clean database exports (no dual exports)
- [ ] TypeScript compilation passes
- [ ] All imports resolve correctly
- [ ] tRPC context creation works

## 📊 Risk Assessment

### **High Risk Areas:**

**tRPC Context Changes** - All router operations depend on context
**Import Chain Updates** - Systematic updates needed across codebase  
**Service Integration** - Services must work with new client exports

### **Mitigation Strategies:**

- **TypeScript-guided updates** - Let compiler errors guide fixes
- **Incremental commits** - Commit after each successful file update
- **Test after each change** - Ensure system still works
- **Rollback readiness** - Keep git history clean for easy revert

## 🎯 Success Metrics

**Technical Metrics:**
- Zero Prisma imports in infrastructure layer
- Single database client in system
- TypeScript compilation passes
- All database imports resolve correctly

**Quality Metrics:**
- Clean, simplified infrastructure code
- No dual-ORM overhead
- Consistent naming patterns
- Proper type safety maintained

**Operational Metrics:**
- Development server starts successfully
- Database connections work properly
- tRPC endpoints respond correctly

---

**Next Phase**: Phase 3 (Test Infrastructure) - Update test setup and mocks for Drizzle-only

**Dependencies**: Phase 1 completion required (services must be Drizzle-only)
**Blockers**: None identified
**Estimated Completion**: 1 day of focused work