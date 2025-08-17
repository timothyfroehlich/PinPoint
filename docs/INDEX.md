# PinPoint Documentation

## 🚨 Final Migration Phase: Complete Prisma Removal

PinPoint is in the final phase of Prisma-to-Drizzle migration - removing the last Prisma dependencies and cleaning up service layer.

**Migration Status**: Final Prisma Removal (Service Layer + Infrastructure Cleanup)  
**Progress**: Router Layer 85%+ Complete, Service Layer Conversion In Progress  
**Timeline**: 1-2 weeks remaining for complete Prisma removal  
**Task Management**: [`prisma-removal-tasks/`](../prisma-removal-tasks/) - Comprehensive execution plan

## Quick Start

### For New Developers

1. Read [`CLAUDE.md`](../CLAUDE.md) - Essential project instructions
2. Review [`architecture/current-state.md`](./architecture/current-state.md) - System overview
3. Check [`migration/supabase-drizzle/developer-guide.md`](./migration/supabase-drizzle/developer-guide.md) - Current patterns

### For Final Migration Phase

- **🚨 TASK EXECUTION**: [`prisma-removal-tasks/`](../prisma-removal-tasks/) - Comprehensive 8-phase cleanup plan
- **Service Conversion**: Use drizzle-migration agent for service layer files
- **Testing Updates**: Use test-architect agent for mock and integration test updates
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
