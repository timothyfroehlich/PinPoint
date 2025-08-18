# Developer Guides

In-depth technical guides for PinPoint development.

## Current Stack (Migration In Progress)

**Legacy (Being Replaced):**

- TypeScript with Prisma type generation
- NextAuth session patterns

**New Stack (Current):**

- TypeScript with Drizzle type inference
- Supabase server-centric auth (@supabase/ssr)
- Generated columns for computed fields
- Server Components + Server Actions
- Modern ES Module mocking patterns

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
