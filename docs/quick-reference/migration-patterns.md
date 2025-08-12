# Migration Patterns: Direct Conversion

Migration workflows optimized for velocity and clean implementations.

## 🎯 Core Migration Philosophy

**Context:** Direct conversion approach - see [CLAUDE.md → Project Context](../../CLAUDE.md#project-context--development-phase)  
**Principles:** One router at a time, clean Drizzle implementations, TypeScript safety net

---

## 🔐 Supabase SSR Authentication

### Server Client Creation

**Pattern**: Server client with cookie management → @docs/developer-guides/supabase/auth.md#server-client

### Next.js Middleware Integration

**Critical**: Always call `getUser()` for token refresh → @docs/migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md#middleware

### Server Action Auth Pattern

**Pattern**: `'use server'` auth actions with redirect → @docs/migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md#server-actions

---

## 🗄️ Prisma → Drizzle Direct Conversion

### Router Conversion Workflow

**Router Patterns:**

- **Setup**: Context change from Prisma → Drizzle clients
- **Query conversion**: `include` → `with` for relational queries → @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md#query-patterns
- **Organizational scoping**: Maintain multi-tenant boundaries

### Generated Columns Pattern

**Pattern**: `.generatedAlwaysAs()` moves computed fields to DB → @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md#generated-columns

---

## 🧪 Testing Migration Patterns

### Database Testing Setup

**PGlite setup**: In-memory PostgreSQL for tests → @docs/quick-reference/testing-patterns.md#pglite  
**Mock updates**: Update router test mocks for Drizzle patterns → @docs/quick-reference/testing-patterns.md#router-test-updates

---

## ⚡ Next.js App Router Integration

### App Router Integration

**Server Components**: `async function` with direct DB queries → @docs/latest-updates/nextjs.md#server-components  
**Server Actions**: `'use server'` mutations with `revalidatePath()` → @docs/latest-updates/nextjs.md#server-actions

---

## 🚦 Migration Decision Tree

```
Migration Task:
├── Auth issues? → @docs/migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md
├── Router conversion? → @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md
├── Testing setup? → @docs/quick-reference/testing-patterns.md
└── Complete strategy? → @docs/migration/supabase-drizzle/direct-conversion-plan.md
```

---

## ⚠️ Common Migration Pitfalls

**Authentication Issues:**

- ❌ Using individual cookie methods (`get()`, `set()`)
- ✅ Always use `getAll()` and `setAll()`
- ❌ Skipping `getUser()` in middleware
- ✅ Token refresh on every protected request

**Database Conversion:**

- ❌ Keeping Prisma patterns in Drizzle
- ✅ Use relational queries for joins
- ❌ Manual transaction management
- ✅ Leverage database-generated columns

**Testing Strategy:**

- ❌ External Docker databases for tests
- ✅ PGlite in-memory for fast feedback
- ❌ Mocking individual query methods
- ✅ Mock entire database module

---

## 📋 Router Conversion Process

**Quick Checklist:** Read router → Convert procedures → Test → Commit  
**Detailed workflow:** @docs/migration/supabase-drizzle/direct-conversion-plan.md#file-by-file-process

---

## 🎯 Success Indicators

**Technical Metrics:**

- TypeScript build passes
- No Prisma imports remaining
- All tests pass with new mocks
- Manual user flows work correctly

**Velocity Metrics:**

- Converting 1-2 routers per day
- Immediate issue resolution
- Clean, readable Drizzle code
- No parallel validation overhead

---

**Complete strategy**: @docs/migration/supabase-drizzle/direct-conversion-plan.md
