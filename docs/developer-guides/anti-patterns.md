# Drizzle & Modern Stack Anti-Patterns Detection Guide

_Quick reference for identifying outdated practices during `/z-migration-review` and code audits._

---

## 🗄️ Schema Definition Anti-Patterns

**❌ Deprecated Serial Types**

```bash
rg "serial\(" --type ts
```

- Use `.generatedAlwaysAsIdentity()` instead
- **Reference:** @docs/latest-updates/drizzle-orm.md → "Generated Columns (v0.32.0+)"

**❌ Old PostgreSQL Index API** (BREAKING v0.31.0+)

```bash
rg "\.on\(.*\)\.asc\(\)|\.desc\(\)" --type ts
```

- Use `.on(col1.asc(), col2.desc().nullsFirst())` instead
- **Reference:** @docs/latest-updates/drizzle-orm.md → "Enhanced Index API (v0.31.0)"

**❌ Missing Generated Columns**

```bash
rg "generatedAlwaysAs" --type ts  # Check if using any
```

- Move computed fields from application to database
- **Reference:** @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md → "Generated Columns Pattern"

**❌ Manual ID Generation**

```bash
rg "generatePrefixedId.*await.*insert" --type ts
```

- Use `.$defaultFn(() => generateId())` in schema
- **Reference:** @docs/latest-updates/drizzle-orm.md → "Performance & Developer Experience"

---

## 🔍 Query Pattern Anti-Patterns

**❌ Manual Joins vs Relational Queries** (MAJOR)

```bash
rg "\.from\(.*\)\..*Join\(" --type ts
```

- Use `db.query.table.findMany({ with: {...} })` instead
- **Reference:** @docs/latest-updates/drizzle-orm.md → "Relational Queries API (db.query)"

**❌ Prisma References**

```bash
rg "ctx\.(db|prisma)\." --type ts
```

- Use `ctx.drizzle` exclusively
- **Reference:** @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md → "Direct Conversion Philosophy"

**❌ Missing Organization Scoping** (CRITICAL SECURITY)

```bash
rg -L "organizationId" src/server/api/routers/ --type ts
```

- All queries must include organization filtering
- **Reference:** @docs/quick-reference/api-security-patterns.md → "Organization Scoping"

**❌ Prisma Query Patterns**

```bash
rg "findUnique\(" --type ts
```

- Use `findFirst()` in Drizzle
- **Reference:** @docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md → "Query Pattern Migration"

---

## 🔐 Authentication Anti-Patterns

**❌ Deprecated Auth Helpers** (CRITICAL)

```bash
rg "@supabase/auth-helpers" --type ts
```

- Causes auth loops, use `@supabase/ssr`
- **Reference:** @docs/latest-updates/supabase.md → "Critical Migration Required"

**❌ Individual Cookie Methods**

```bash
rg "cookies\.(get|set|remove)\(" --type ts
```

- Use `getAll()` and `setAll()` only
- **Reference:** @docs/latest-updates/supabase.md → "Cookie Handling Revolution"

**❌ Missing Token Refresh**

```bash
rg "getUser\(\)" middleware.ts || echo "Missing token refresh"
```

- Must call `getUser()` in middleware
- **Reference:** @docs/latest-updates/supabase.md → "Middleware Requirements"

---

## 🧪 Testing Anti-Patterns

**❌ External Test Databases**

```bash
rg "docker.*postgres" --type yml
find . -name "docker-compose*test*"
```

- Use PGlite in-memory testing
- **Reference:** @docs/latest-updates/drizzle-orm.md → "In-Memory Testing with PGlite"

**❌ Complex Manual Mocks**

```bash
find . -name "*.test.ts" -exec wc -l {} \; | awk '$1 > 200'
```

- Replace with module-level Drizzle mocking
- **Reference:** @docs/latest-updates/vitest.md → "Type-Safe Partial Mocking"

**❌ Unsafe Vitest Mocking**

```bash
rg "vi\.mock.*\)" --type ts | grep -v "importActual"
```

- Use `vi.importActual<typeof Module>()` for type safety
- **Reference:** @docs/latest-updates/vitest.md → "Modern ES Module Mocking Standard"

**❌ Deprecated Workspace Config**

```bash
rg "workspace:" vitest.config.ts
```

- Use `projects` instead of `workspace`
- **Reference:** @docs/latest-updates/vitest.md → "Configuration Updates"

---

## ⚡ Next.js Anti-Patterns

**❌ Pages Router for New Features**

```bash
rg "getServerSideProps|getStaticProps" --type ts
```

- Use App Router Server Components
- **Reference:** @docs/latest-updates/nextjs.md → "App Router vs Pages Router"

**❌ API Routes for Simple Mutations**

```bash
find pages/api -name "*.ts" 2>/dev/null
```

- Use Server Actions with `'use server'`
- **Reference:** @docs/latest-updates/nextjs.md → "Server Actions for Mutations"

**❌ Client-Side Auth Patterns**

```bash
rg "useEffect.*auth|useState.*user" --type tsx
```

- Use Server Components with direct auth checks
- **Reference:** @docs/latest-updates/nextjs.md → "Server Components Revolution"

---

## 🎯 Severity Levels

**🔴 CRITICAL** (Breaks functionality/security):

- Deprecated `@supabase/auth-helpers`
- Missing organization scoping
- Old PostgreSQL index API

**🟡 HIGH** (Performance/maintenance):

- Manual joins vs relational queries
- Missing generated columns
- Complex test mocking

**🟢 MEDIUM** (Code quality):

- Prisma query patterns
- Pages Router for new features
- Missing modern Drizzle features

---

**Usage**: Run detection commands during `/z-migration-review`, check severity for prioritization, follow reference links for implementation solutions.
