# Developer Guides

In-depth technical guides for PinPoint development.

## Current Stack (Post-Migration)

**Phase 0-2 Complete:** Drizzle + RLS Implementation

- ✅ TypeScript with Drizzle type inference
- ✅ Supabase server-centric auth (@supabase/ssr)
- ✅ Row-Level Security (RLS) for multi-tenancy
- ✅ Memory-safe PGlite testing patterns
- ✅ Server Components + Server Actions
- ✅ Modern ES Module mocking patterns

**Architecture Benefits:**
- Database-level organizational scoping via RLS
- Zero manual organizationId filtering needed
- Worker-scoped test databases prevent memory blowouts
- Type-safe testing with specialized agent patterns

**🚨 CRITICAL**: See [`../latest-updates/`](../latest-updates/) for post-training breaking changes

## Contents

### Core Development

- **[typescript-guide.md](./typescript-guide.md)** - Comprehensive TypeScript patterns and migration guide
- **[common-errors.md](./common-errors.md)** - ESLint violations and fixes
- **[troubleshooting.md](./troubleshooting.md)** - Common development issues and solutions

### Technology Guides

- **[supabase/](./supabase/)** - Supabase auth, storage, and local development
- **[drizzle/](./drizzle/)** - Drizzle ORM patterns and migrations
- **[row-level-security/](./row-level-security/)** - RLS implementation and testing
- **[trpc/](./trpc/)** - tRPC context patterns with new stack
- **[testing/](./testing/)** - Testing patterns and memory safety

### Configuration & Tooling

- **[eslint-security-config.md](./eslint-security-config.md)** - ESLint 9 security configuration with validated plugins
- **[tool-evaluation-methodology.md](./tool-evaluation-methodology.md)** - Systematic approach for evaluating npm packages and dev tools

### Migration Support

- **[drizzle-migration-review-procedure.md](./drizzle-migration-review-procedure.md)** - AI-powered review checklist for Drizzle migrations
- **[database-review-procedure.md](./database-review-procedure.md)** - Database change review process
- **[anti-patterns.md](./anti-patterns.md)** - What not to do (with alternatives)
- **[sarif-integration.md](./sarif-integration.md)** - SARIF tooling for security analysis
