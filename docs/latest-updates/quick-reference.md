# Quick Reference: Tech Stack Updates for Direct Migration

_Essential post-training tech stack updates for direct migration_

## 🎯 Migration Context

**Context:** Solo development, pre-beta, direct conversion approach - see [CLAUDE.md → Project Context](../../CLAUDE.md#project-context--development-phase)

---

## 📊 Summary Table: Critical Updates

| Technology      | Key Update                                 | Migration Impact                  | Direct Conversion Benefit                |
| --------------- | ------------------------------------------ | --------------------------------- | ---------------------------------------- |
| **Drizzle ORM** | Generated columns (v0.32.0+)               | Move computed fields to DB        | Eliminate application-layer calculations |
| **Supabase**    | `@supabase/auth-helpers` → `@supabase/ssr` | Complete auth rewrite required    | Server-first patterns for App Router     |
| **Next.js**     | Server Components + Actions                | Data fetching paradigm shift      | Co-locate data with UI components        |
| **Material UI** | v7 API cleanup + CSS Layers                | Breaking changes, migration tools | Better utility framework integration     |
| **Vitest**      | Modern ES Module mocking                   | Type-safe partial mocking         | Better integration testing patterns      |

---

## 🗄️ Drizzle ORM: Database-First Architecture

**→ See [drizzle-orm.md](./drizzle-orm.md) for detailed examples**

### **Critical for Direct Conversion**

🚀 **NEW**: `.generatedAlwaysAs()` moves computed fields to database  
🔗 **GAME CHANGER**: `db.query.users.findMany({ with: { posts: true } })` replaces joins  
🧪 **TESTING**: PGlite in-memory for fast integration tests  
📋 **Patterns**: @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md

---

## 🔐 Supabase: Server-Centric Authentication

**→ See [supabase.md](./supabase.md) for migration workflow**

### **Breaking Changes (Immediate Action Required)**

🚨 **CRITICAL**: `@supabase/auth-helpers-nextjs` DEPRECATED → causes auth loops  
✅ **SOLUTION**: Migrate to `@supabase/ssr` with `getAll()`/`setAll()` cookies  
📋 **Migration Steps**: @docs/migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md

---

## ⚡ Next.js: Server-Centric Revolution

**→ See [nextjs.md](./nextjs.md) for comprehensive patterns**

### **Paradigm Shift: Server Components + Actions**

**✅ DO:**

- Use App Router for all new development
- Fetch data directly in async Server Components
- Implement Server Actions for mutations with `'use server'`
- Use `'use cache'` directive for request-level memoization
- Wrap slow components in `<Suspense>` boundaries
- Use `revalidatePath()` and `revalidateTag()` for cache invalidation

**❌ DON'T:**

- Start new projects with Pages Router
- Use `useEffect` or `getServerSideProps` patterns
- Block entire page rendering for slow components
- Rely on time-based revalidation for user updates
- Use client-side caching libraries for server data

### **Data Fetching Evolution**

```typescript
// OLD: getServerSideProps + fetch
// NEW: async Server Components + Server Actions
```

### **Migration Priority**

1. **App Router setup** - move from pages to app directory
2. **Data fetching** - Server Components replace hooks
3. **Mutations** - Server Actions replace API routes
4. **Caching** - implement granular cache control

---

## 🎨 Material UI: API Cleanup & CSS Layers

**→ See [material-ui-v7.md](./material-ui-v7.md) for migration details**

### **Breaking Changes & Opportunities**

🚨 **BREAKING**: `Hidden` component REMOVED → use `sx` prop breakpoints  
⚙️ **REQUIRED**: `enableCssLayer: true` in AppRouterCacheProvider  
🔄 **API CHANGE**: `components` → `slots` pattern  
📋 **Migration Tools**: @docs/latest-updates/material-ui-v7.md

---

## 🧪 Vitest: Modern ES Module Mocking

**→ See [vitest.md](./vitest.md) for advanced patterns**

### **Modern Mocking Standard**

🔧 **NEW STANDARD**: `vi.mock` with `vi.importActual` for type safety  
🏗️ **PATTERN**: `vi.hoisted()` for shared mock variables  
⚙️ **CONFIG**: `projects` replaces deprecated `workspace`  
📋 **Integration**: @docs/latest-updates/vitest.md

---

## 🚀 Direct Conversion Checklist

### **Phase 1: Foundation (Week 1)**

- [ ] **Supabase:** Migrate to `@supabase/ssr` (CRITICAL - breaking changes)
- [ ] **Material UI:** Update to v7, enable CSS layers
- [ ] **Vitest:** Update mock patterns to `vi.importActual`
- [ ] **Next.js:** Set up App Router structure

### **Phase 2: Core Migration (Week 2-3)**

- [ ] **Drizzle:** Convert routers using generated columns
- [ ] **Next.js:** Replace data fetching with Server Components
- [ ] **Authentication:** Implement server-centric auth patterns
- [ ] **Testing:** Set up PGlite for database testing

### **Phase 3: Optimization (Week 3-4)**

- [ ] **Caching:** Implement `'use cache'` and revalidation
- [ ] **Realtime:** Migrate to Broadcast pattern
- [ ] **Performance:** Optimize with Suspense boundaries
- [ ] **Testing:** Complete mock integration coverage

---

## 🎯 Success Metrics

**Velocity:** 2-3 weeks total vs 7+ weeks with parallel validation  
**Quality:** TypeScript compilation passes, app functionality preserved  
**Learning:** Deep understanding of modern patterns

---

## 📚 Reference Links

- **[drizzle-orm.md](./drizzle-orm.md)** - Generated columns, relational queries, PGlite testing
- **[supabase.md](./supabase.md)** - SSR migration, server-centric auth, Broadcast pattern
- **[nextjs.md](./nextjs.md)** - Server Components, Server Actions, caching strategies
- **[material-ui-v7.md](./material-ui-v7.md)** - CSS layers, API cleanup, migration tools
- **[vitest.md](./vitest.md)** - Modern mocking, type safety, stack integration
- **[../tech-stack-research-catchup.md](../tech-stack-research-catchup.md)** - Full technical details and examples

---

## 🔄 Implementation Strategy

**Direct Conversion:** No parallel validation, optimize for learning, incremental progress  
**Details:** [@docs/migration/supabase-drizzle/direct-conversion-plan.md](../migration/supabase-drizzle/direct-conversion-plan.md)
