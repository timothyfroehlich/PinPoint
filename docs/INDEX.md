# PinPoint Documentation

## ✅ Migration Status: Prisma Removal Complete

PinPoint has completed the Prisma-to-Drizzle migration with full removal of all Prisma dependencies.

**Migration Status**: ✅ **Prisma Removal COMPLETE** (Phase 0 + Phase 1)  
**Progress**: 100% Drizzle-only architecture achieved  
**Next Phase**: Ready for Phase 2 - RLS Implementation  
**Task Management**: [`migration-plan-v2/`](../migration-plan-v2/) - Unified migration and RLS implementation plan

## Quick Start

### For New Developers

1. Read [`CLAUDE.md`](../CLAUDE.md) - Essential project instructions
2. Review [`architecture/current-state.md`](./architecture/current-state.md) - System overview
3. Check [`migration/supabase-drizzle/developer-guide.md`](./migration/supabase-drizzle/developer-guide.md) - Current patterns

### For Phase 2: RLS Implementation

- **🎯 NEXT PHASE**: [`migration-plan-v2/02-phase2-rls-implementation.md`](../migration-plan-v2/02-phase2-rls-implementation.md) - Row-Level Security implementation
- **Clean Foundation**: Phase 0 + Phase 1 complete - modern tooling and 100% Drizzle architecture
- **Current Patterns**: [`developer-guides/`](./developer-guides/) - Modern Drizzle + Supabase SSR patterns

## Documentation Structure

### Core Documentation

- [`latest-updates/`](./latest-updates/) - **CRITICAL**: Post-training tech stack updates (August 2025)
- [`architecture/`](./architecture/) - System design, patterns, and current state
- [`developer-guides/`](./developer-guides/) - Technology-specific implementation guides
- [`testing/`](./testing/) - Testing philosophy and patterns (now integration-first)
- [`security/`](./security/) - Security patterns and audit findings

### Planning & Process

- [`planning/`](./planning/) - Roadmap, future features, and archived ideas
- [`orchestrator-system/`](./orchestrator-system/) - Multi-agent development workflow

### Reference

- [`design-docs/`](./design-docs/) - Feature designs and architectural decisions
- [`lessons-learned/`](./lessons-learned/) - Counter-intuitive discoveries and insights
- [`deployment/`](./deployment/) - Environment and deployment guides
- [`research/`](./research/) - Technical research and experimental patterns

## Key Resources

### Quick References (Auto-Loaded)

- **Tactical Patterns**: [`quick-reference/`](./quick-reference/) - Auto-loaded guides for immediate action
- **Essential Commands**: [`CLAUDE.md`](../CLAUDE.md) - Command reference and project context
- **Latest Updates**: [`latest-updates/quick-reference.md`](./latest-updates/quick-reference.md) - Post-training breaking changes

## Contributing

1. **Before coding**: Check migration status and use current patterns
2. **Validation**: Run `npm run validate` before commits
3. **Documentation**: Update relevant docs with any pattern changes
4. **Testing**: Write integration tests with transaction cleanup

For detailed contribution guidelines, see the developer guides.
