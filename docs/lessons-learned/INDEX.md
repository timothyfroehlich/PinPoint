# Lessons Learned

Counter-intuitive discoveries and insights from PinPoint development.

## Status

Core lessons integrated into main documentation for agent accessibility.

## Migration Context

- TypeScript strictest migration: 100% production compliance achieved
- Vitest migration: 7-65x performance improvements measured
- Security patterns: Evolved from app-level to database-level enforcement
- Drizzle foundation: Phase 2A complete with critical syntax discoveries

## Contents

- **[completed-task-consolidation.md](./completed-task-consolidation.md)** - Security-first architecture insights
- **[public-api-endpoints.md](./public-api-endpoints.md)** - Multi-tenant scoping discoveries
- **[migration-reports/](./migration-reports/)** - Technical migration reports and patterns
  - **[phase-2a-drizzle-foundation.md](./migration-reports/phase-2a-drizzle-foundation.md)** - Drizzle index syntax, pgbouncer issues, dual-ORM patterns
- **Integrated Lessons** - See CLAUDE.md for core insights

## Recent Critical Discoveries (Phase 2A)

1. **Drizzle Index Syntax**: Indexes MUST be defined in table callbacks, not separate exports
2. **pgbouncer Interference**: Connection pooling blocks drizzle-kit schema introspection
3. **Junction Table Patterns**: Exact Prisma naming preserves compatibility
4. **Dual-ORM Architecture**: Gradual migration possible with both ORMs in context
