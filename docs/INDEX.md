# PinPoint Documentation

## 🚨 Active Migration

PinPoint is completing a direct conversion migration from Prisma to Drizzle optimized for solo development velocity.

**Migration Status**: Phase 2B-E (Router Conversions)  
**Progress**: Phase 2A Drizzle Foundation Complete, 3 routers converted  
**Timeline**: 2-3 weeks total direct conversion approach  
**Details**: [`migration/supabase-drizzle/`](./migration/supabase-drizzle/)

## Quick Start

### For New Developers

1. Read [`CLAUDE.md`](../CLAUDE.md) - Essential project instructions
2. Review [`architecture/current-state.md`](./architecture/current-state.md) - System overview
3. Check [`migration/supabase-drizzle/developer-guide.md`](./migration/supabase-drizzle/developer-guide.md) - Current patterns

### For Migration Participants

- **🚨 CRITICAL**: [`latest-updates/`](./latest-updates/) - Post-training breaking changes and new patterns
- **Migration Hub**: [`migration/supabase-drizzle/`](./migration/supabase-drizzle/)
- **Quick References**: [`migration/supabase-drizzle/quick-reference/`](./migration/supabase-drizzle/quick-reference/)
- **New Stack Guides**: [`developer-guides/`](./developer-guides/) (Supabase, Drizzle, RLS)

## Documentation Structure

### Core Documentation

- [`latest-updates/`](./latest-updates/) - **CRITICAL**: Post-training tech stack updates (August 2025)
- [`architecture/`](./architecture/) - System design, patterns, and current state
- [`developer-guides/`](./developer-guides/) - Technology-specific implementation guides
- [`testing/`](./testing/) - Testing philosophy and patterns (now integration-first)
- [`security/`](./security/) - Security patterns and audit findings

### Planning & Process

- [`planning/`](./planning/) - Roadmap, future features, and archived ideas
- [`migration/`](./migration/) - Active and completed migrations
- [`orchestrator-system/`](./orchestrator-system/) - Multi-agent development workflow

### Reference

- [`design-docs/`](./design-docs/) - Feature designs and architectural decisions
- [`lessons-learned/`](./lessons-learned/) - Counter-intuitive discoveries and insights
- [`deployment/`](./deployment/) - Environment and deployment guides

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

For detailed contribution guidelines, see the migration developer guide.
