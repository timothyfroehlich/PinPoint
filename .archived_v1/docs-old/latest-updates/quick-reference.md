# Quick Reference: Tech Stack Updates for Direct Migration

_Essential post-training tech stack updates for direct migration_

## 🎯 Migration Context

**Context:** Solo development, pre-beta, direct conversion approach - see [CLAUDE.md → Project Context](../../CLAUDE.md#project-context--development-phase)

---

## 🚨 Breaking Changes Alert (August 2025)

**CRITICAL:** Next.js 15 fundamentally changed caching defaults - all fetch requests now UNCACHED by default!

---

## 📊 Summary Table: Critical Updates

| Technology      | Key Update                                    | Migration Impact                  | Direct Conversion Benefit                 |
| --------------- | --------------------------------------------- | --------------------------------- | ----------------------------------------- |
| **Next.js 15**  | **BREAKING: Caching now uncached by default** | Performance degradation risk      | Explicit cache control, better patterns   |
| **React 19**    | cache() API + React Compiler                  | Request-level memoization         | Eliminate duplicate queries automatically |
| **Tailwind v4** | **BREAKING: CSS-based config (no JS file)**   | Complete architecture rewrite     | 5x faster builds, native CSS layers       |
| **shadcn/ui**   | Blocks + Universal Registry (2025 evolution)  | Modern component system           | 88% bundle reduction vs Material UI       |
| **Drizzle ORM** | Generated columns (v0.32.0+)                  | Move computed fields to DB        | Eliminate application-layer calculations  |
| **Supabase**    | `@supabase/auth-helpers` → `@supabase/ssr`    | Complete auth rewrite required    | Server-first patterns for App Router      |
| **Material UI** | v7 API cleanup + CSS Layers                   | Breaking changes, migration tools | Better utility framework integration      |
| **Vitest**      | Modern ES Module mocking                      | Type-safe partial mocking         | Better integration testing patterns       |

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

## 🚨 Next.js 15: CRITICAL Caching Changes

**→ See [nextjs.md](./nextjs.md) for breaking changes and migration**

### **IMMEDIATE ACTION REQUIRED**

🚨 **BREAKING**: fetch() requests now default to **uncached** (`cache: "no-store"`)  
🚨 **BREAKING**: GET Route Handlers now default to **uncached** behavior  
🚨 **BREAKING**: Client Router Cache now defaults to **uncached** for page segments

```typescript
// BEFORE: Cached by default (performance optimized)
const data = await fetch("/api/issues"); // ✅ Cached automatically

// AFTER: Uncached by default (performance risk!)
const data = await fetch("/api/issues"); // ❌ No caching!

// REQUIRED: Explicit caching for performance
const data = await fetch("/api/issues", {
  cache: "force-cache", // ✅ Must specify caching
  next: { revalidate: 60 }, // ✅ Add revalidation strategy
});
```

### **PinPoint Immediate Steps**

1. **Audit all fetch() calls** in data access layer
2. **Add explicit caching** for frequently accessed data
3. **Use React 19 cache()** for request-level memoization
4. **Performance test** impact of uncached defaults

---

## ⚛️ React 19: Request-Level Memoization

**→ See [react-19.md](./react-19.md) for implementation patterns**

### **Game-Changing cache() API**

🚀 **ELIMINATES**: Duplicate database queries within single requests  
⚡ **PERFORMANCE**: Automatic request-level memoization  
🔧 **INTEGRATION**: Perfect with PinPoint's Drizzle queries

```typescript
import { cache } from "react";

// Cached at request level - no duplicate queries
export const getIssuesForOrg = cache(async (orgId: string) => {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, orgId),
  });
});
```

### **React Compiler + Performance**

- **Zero runtime cost**: Build-time optimizations only
- **Automatic memoization**: Components optimized automatically
- **Perfect for RSC**: Server Components performance boost

---

## 🎨 Tailwind CSS v4: Architecture Revolution

**→ See [tailwind-css-v4.md](./tailwind-css-v4.md) for migration guide**

### **Complete Rewrite (Breaking Changes)**

🚨 **BREAKING**: No more `tailwind.config.js` - CSS-based configuration only  
⚡ **PERFORMANCE**: 5x faster full builds, 100x faster incremental  
🎯 **CSS LAYERS**: Native support perfect for MUI coexistence

```css
/* OLD: tailwind.config.js (v3) */
/* ❌ File becomes obsolete */

/* NEW: CSS-based configuration (v4) */
@import "tailwindcss";
@config {
  theme: {
    extend: {
      colors: {
        primary: theme(colors.blue.600);
      }
    }
  }
}
```

### **PinPoint Integration**

- **Phase 1A**: Already implementing during RSC Migration
- **MUI Coexistence**: CSS layers prevent style conflicts
- **shadcn/ui Ready**: Perfect alignment with component library

---

## 🧩 shadcn/ui: Component Revolution

**→ See [shadcn-ui.md](./shadcn-ui.md) for complete ecosystem**

### **2025 Evolution Highlights**

🎯 **BLOCKS**: Pre-built component patterns (dashboard, auth, forms)  
🔧 **UNIVERSAL REGISTRY**: Local components + custom registries  
📦 **BUNDLE SIZE**: 88% smaller than Material UI (460KB → 55KB)  
⚡ **SERVER FIRST**: Default Server Components, selective hydration

```bash
# Install pre-built patterns
npx shadcn@latest add block dashboard-01
npx shadcn@latest add block authentication-01

# Component diffing and updates
npx shadcn diff
npx shadcn update button
```

### **Material UI Migration Strategy**

- **Phase 1**: Coexistence during RSC Migration
- **Phase 2**: Component-by-component replacement
- **Phase 3**: Complete MUI removal

---

## ⚡ Next.js: Enhanced Server-Centric Patterns

**→ See [nextjs.md](./nextjs.md) for comprehensive patterns**

### **Paradigm Shift: Server Components + Actions**

**✅ DO:**

- Use App Router for all new development
- Fetch data directly in async Server Components
- Implement Server Actions for mutations with `'use server'`
- Use React 19 `cache()` API for request-level memoization
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
🛡️ **SECURITY**: Official `@vitest/eslint-plugin` enforces test quality  
📋 **Integration**: @docs/latest-updates/vitest.md

---

## 🛡️ ESLint 9: Modern Security Configuration

**→ See [@docs/developer-guides/eslint-security-config.md](../developer-guides/eslint-security-config.md) for complete setup**

### **Validated Security Plugin Stack (August 2025)**

**✅ Production-Ready Plugins**:

- **eslint-plugin-security**: 996K downloads, vulnerability detection
- **@microsoft/eslint-plugin-sdl**: Microsoft-backed web security rules
- **@vitest/eslint-plugin**: Official test quality enforcement

**❌ Avoided Tools**:

- **eslint-plugin-drizzle**: Abandoned (2+ years, only 2 rules)
- **@ts-safeql/eslint-plugin**: Complex setup, deferred to post-migration
- **schemalint**: Low adoption (328 downloads), better alternatives exist

### **Security Rule Categories**

```javascript
// Critical vulnerabilities (6 rules)
"security/detect-eval-with-expression": "error",
"security/detect-non-literal-require": "error",
"security/detect-child-process": "error",

// Web security (4 rules)
"@microsoft/sdl/no-inner-html": "error",
"@microsoft/sdl/no-insecure-url": "error",

// Custom Drizzle safety (better than abandoned plugin)
"no-restricted-syntax": [...] // UPDATE/DELETE must include WHERE
```

### **Tool Evaluation Methodology**

**Framework**: LOW/MEDIUM/HIGH risk assessment based on adoption, maintenance, backing  
**Success**: Avoided 2 problematic tools, validated 4 production-ready tools  
**Details**: tool-evaluation-methodology.md (archived - use Context7 for current library evaluation)

---

## 🚀 Updated Migration Checklist (August 2025)

### **🚨 Phase 0: CRITICAL Breaking Changes (IMMEDIATE)**

- [ ] **Next.js 15:** Audit all fetch() calls, add explicit caching (PERFORMANCE RISK)
- [ ] **Tailwind v4:** Plan CSS-based config migration (breaking changes)
- [ ] **React 19:** Implement cache() API for request memoization
- [ ] **shadcn/ui:** Evaluate Material UI replacement strategy

### **Phase 1: Foundation (Week 1)**

- [ ] **Supabase:** Migrate to `@supabase/ssr` (CRITICAL - breaking changes)
- [ ] **Tailwind v4:** Implement CSS-based configuration during RSC Migration Phase 1A
- [ ] **shadcn/ui:** Install essential components for issue management
- [ ] **Material UI:** Update to v7, enable CSS layers for coexistence
- [ ] **Vitest:** Update mock patterns to `vi.importActual`

### **Phase 2: Modern Stack Integration (Week 2-3)**

- [ ] **React 19:** Full cache() API integration in Data Access Layer
- [ ] **shadcn/ui:** Component-by-component Material UI replacement
- [ ] **Next.js:** Server Actions with new Form component and unstable_after
- [ ] **Drizzle:** Convert routers using generated columns
- [ ] **Authentication:** Implement server-centric auth patterns

### **Phase 3: Performance Optimization (Week 3-4)**

- [ ] **React Compiler:** Enable automatic performance optimization
- [ ] **shadcn/ui Blocks:** Use pre-built patterns for complex interfaces
- [ ] **Caching:** Implement tag-based revalidation strategies
- [ ] **Testing:** Set up PGlite with request-level cache() patterns
- [ ] **Bundle Analysis:** Measure Material UI → shadcn/ui performance gains

---

## 🎯 Success Metrics

**Velocity:** Final Prisma removal in 1-2 weeks (router layer already 85% complete)  
**Quality:** TypeScript compilation passes, app functionality preserved  
**Learning:** Deep understanding of modern patterns

---

## 📚 Reference Links

### **New Technologies (August 2025)**

- **[react-19.md](./react-19.md)** - cache() API, React Compiler, Server Components optimization
- **[tailwind-css-v4.md](./tailwind-css-v4.md)** - CSS-based config, performance improvements, MUI coexistence
- **[shadcn-ui.md](./shadcn-ui.md)** - Blocks system, universal registry, Material UI migration

### **Updated Technologies**

- **[nextjs.md](./nextjs.md)** - **CRITICAL caching changes**, Server Components, Server Actions
- **[drizzle-orm.md](./drizzle-orm.md)** - Generated columns, relational queries, PGlite testing
- **[supabase.md](./supabase.md)** - SSR migration, server-centric auth, Broadcast pattern
- **[material-ui-v7.md](./material-ui-v7.md)** - CSS layers, API cleanup, migration tools
- **[vitest.md](./vitest.md)** - Modern mocking, type safety, stack integration

---

## 🔄 Implementation Strategy

**Complete Removal:** Pure Drizzle implementations, service layer conversion, infrastructure cleanup  
**Details:** [@prisma-removal-tasks/README.md](../../prisma-removal-tasks/README.md)
