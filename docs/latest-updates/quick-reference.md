# Quick Reference: Tech Stack Updates for Direct Migration

_Essential updates for Drizzle, Supabase, Next.js, Material UI, and Vitest - optimized for solo development velocity_

## 🎯 Migration Context

**Solo Development + Pre-Beta + No Users = Direct Conversion Approach**

- **Optimize for:** Velocity and learning over production safety
- **Risk tolerance:** High - breaking things temporarily is acceptable
- **Timeline:** 2-3 weeks vs 7+ weeks with parallel validation
- **Goal:** Clean Drizzle implementations without validation boilerplate

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

**✅ DO:**

- Use `.generatedAlwaysAs()` for computed fields (full-text search, slugs)
- Implement relational queries with `db.query.users.findMany({ with: { posts: true } })`
- Set up PGlite in-memory testing for integration tests
- Use enhanced index API: `.on(table.column.asc())`
- Leverage PostgreSQL extensions natively (`vector`, `geometry`)

**❌ DON'T:**

- Calculate derived fields in tRPC procedures
- Write manual SQL joins for related data
- Use external Docker for database testing
- Apply modifiers to entire index (old API)
- Use `sql` operator for pg_vector queries

### **Migration Priority**

1. **Generated columns** - replace computed field logic
2. **Relational queries** - replace Prisma `include` patterns
3. **Testing setup** - PGlite for fast, isolated tests

---

## 🔐 Supabase: Server-Centric Authentication

**→ See [supabase.md](./supabase.md) for migration workflow**

### **Breaking Changes (Immediate Action Required)**

**✅ DO:**

- Migrate to `@supabase/ssr` package immediately
- Use server-side cookie management with `getAll()` and `setAll()`
- Call `supabase.auth.getUser()` in middleware for token refresh
- Implement Broadcast pattern for realtime (scalable, secure)
- Use Server Actions for authentication flows

**❌ DON'T:**

- Use deprecated `@supabase/auth-helpers-nextjs`
- Mix auth-helpers with SSR packages (causes auth loops)
- Use individual cookie methods (`get()`, `set()`, `remove()`)
- Rely on "Postgres Changes" for new realtime features
- Use `getSession()` for page protection

### **Migration Priority**

1. **Package migration** - remove auth-helpers, install SSR
2. **Client utilities** - create server/client utilities
3. **Component updates** - replace all client creation calls
4. **Middleware setup** - implement proper auth refresh

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

**✅ DO:**

- Enable `enableCssLayer: true` in `AppRouterCacheProvider`
- Replace `Hidden` component with `sx` prop responsive breakpoints
- Update imports from `@mui/lab` to `@mui/material` (promoted components)
- Use standardized `slots` pattern: `slots={{ root: Custom }}`
- Run automated codemods for CSS class updates
- Define CSS layer order: `@layer theme, base, mui, components, utilities;`

**❌ DON'T:**

- Skip CSS layer setup when using with Tailwind CSS
- Use removed APIs: `createMuiTheme`, `Hidden`, `onBackdropClick`
- Mix old `components` props with new `slots` pattern
- Ignore CSS class composition changes

### **Key Removals**

- `Hidden` → `sx` prop with breakpoints
- `createMuiTheme` → `createTheme`
- Component-specific props → unified patterns

### **Migration Priority**

1. **Dependencies** - update to v7, enable CSS layers
2. **API cleanup** - run codemods, replace deprecated components
3. **Testing** - update theme provider setup

---

## 🧪 Vitest: Modern ES Module Mocking

**→ See [vitest.md](./vitest.md) for advanced patterns**

### **Modern Mocking Standard**

**✅ DO:**

- Use `vi.mock` with async factory and `vi.importActual`
- Import original module types: `importOriginal<typeof ModuleType>()`
- Use `vi.hoisted` for variables accessed in `vi.mock`
- Implement `vi.mockObject` for deep object mocking
- Use `projects` configuration (not deprecated `workspace`)
- Mock at the right level (partial > full module mocking)

**❌ DON'T:**

- Sacrifice type safety for convenience
- Reference test variables directly in mock factories
- Let mock state leak between tests
- Use deprecated `workspace` configuration
- Mock more than necessary

### **Stack Integration Patterns**

```typescript
// Drizzle: PGlite in vitest.setup.ts
// Supabase: Mock next/headers for Server Components
// Next.js: Mock Server Actions module
```

### **Migration Priority**

1. **Mock patterns** - update to `vi.importActual`
2. **Stack integration** - database, auth, Server Action mocks
3. **Configuration** - migrate to `projects`

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

## 🎯 Success Metrics for Solo Development

**Velocity Indicators:**

- 2-3 weeks total vs 7+ weeks with parallel validation
- Clean, readable Drizzle implementations
- No temporary validation code to maintain
- Deep understanding of modern patterns

**Technical Quality:**

- TypeScript compilation passes
- App functionality preserved
- Key user flows work correctly
- Enhanced developer experience

**Risk Management:**

- Acceptable temporary breaks (fixable immediately)
- Incremental approach (one router at a time)
- Easy rollback with git
- Manual validation catches issues

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

**Direct Conversion Philosophy:**

1. **No parallel validation** - move directly to clean implementations
2. **Optimize for learning** - deep understanding over safety nets
3. **Embrace breaking changes** - temporary breaks are acceptable
4. **Incremental progress** - one router/component at a time
5. **Manual validation** - test immediately after each change

**Perfect for solo development context:** No users, pre-beta, high risk tolerance, velocity-focused approach aligned with project phase and constraints.

**Ready to execute the 2-3 week direct conversion! 🚀**
