# PinPoint Documentation

## ✅ Migration Status: Prisma Removal Complete

PinPoint has completed the Prisma-to-Drizzle migration with full removal of all Prisma dependencies.

**Migration Status**: ✅ **Prisma Removal COMPLETE** (Phase 0 + Phase 1)  
**Progress**: 100% Drizzle-only architecture achieved  
**Current Focus**: Production-ready system with comprehensive testing and documentation

## Quick Start

### For New Developers

1. Read [`CLAUDE.md`](../CLAUDE.md) - Essential project instructions
2. Review [`architecture/current-state.md`](./architecture/current-state.md) - System overview
3. Check [`migration/supabase-drizzle/developer-guide.md`](./migration/supabase-drizzle/developer-guide.md) - Current patterns

### For Current Development

- **Clean Foundation**: Phase 0 + Phase 1 complete - modern tooling and 100% Drizzle architecture
- **Current Patterns**: [`developer-guides/`](./developer-guides/) - Modern Drizzle + Supabase SSR patterns
- **Testing**: Follow new archetype system (see [`testing/TEST_SYSTEM_REBOOT_PLAN.md`](./testing/TEST_SYSTEM_REBOOT_PLAN.md))

## Documentation Structure

### Core Documentation

- [`NON_NEGOTIABLES.md`](./NON_NEGOTIABLES.md) - **CRITICAL**: File content patterns that MUST be enforced during code reviews
- [`NON_NEGOTIABLES_EXAMPLES.md`](./NON_NEGOTIABLES_EXAMPLES.md) - Detailed code examples for non-negotiable patterns
- [`latest-updates/`](./latest-updates/) - **CRITICAL**: Post-training tech stack updates (August 2025)
- [`architecture/`](./architecture/) - System design, patterns, and current state
- [`developer-guides/`](./developer-guides/) - Technology-specific implementation guides
- [`testing/`](./testing/) - **REBOOT IN PROGRESS**: Complete test system rebuild with strict archetype enforcement
- [`security/`](./security/) - Security patterns and audit findings

### Planning & Process

- [`planning/`](./planning/) - Roadmap, future features, and archived ideas

### Reference

- [`design-docs/`](./design-docs/) - Feature designs and architectural decisions
- [`lessons-learned/`](./lessons-learned/) - Counter-intuitive discoveries and insights
- [`deployment/`](./deployment/) - Environment and deployment guides
- [`research/`](./research/) - Technical research and experimental patterns

### Deprecated

- [`deprecated/`](./deprecated/) - Legacy documentation being phased out during system reboot

## Key Resources

### Quick References (Auto-Loaded)

- **Tactical Patterns**: [`quick-reference/`](./quick-reference/) - Auto-loaded guides (testing patterns deprecated during reboot)
- **Essential Commands**: [`CLAUDE.md`](../CLAUDE.md) - Command reference and project context
- **Latest Updates**: [`latest-updates/quick-reference.md`](./latest-updates/quick-reference.md) - Post-training breaking changes

## Contributing

1. **Before coding**: Check migration status and use current patterns
2. **Validation**: Run `npm run validate` before commits
3. **Documentation**: Update relevant docs with any pattern changes
4. **Testing**: Follow new archetype system (see testing/TEST_SYSTEM_REBOOT_PLAN.md)

For detailed contribution guidelines, see the developer guides.
