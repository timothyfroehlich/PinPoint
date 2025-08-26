# PinPoint Documentation

## Project Status

**Architecture**: 100% Drizzle-only (Prisma removal complete)  
**Current Phase**: RSC Migration + Test System Reboot  
**Focus**: Server-first architecture with shadcn/ui

## Quick Start

### For New Developers

1. Read [`CLAUDE.md`](../CLAUDE.md) - Essential project instructions
2. Review [`architecture/current-state.md`](./architecture/current-state.md) - System overview
3. Check [`developer-guides/`](./developer-guides/) - Current implementation patterns

### For Current Development

- **Patterns**: [`developer-guides/`](./developer-guides/) - Current implementation guides
- **Security**: [`quick-reference/api-security-patterns.md`](./quick-reference/api-security-patterns.md) - Essential patterns
- **Testing**: [`testing/TEST_SYSTEM_REBOOT_PLAN.md`](./testing/TEST_SYSTEM_REBOOT_PLAN.md) - Archetype system

## Documentation Structure

### Essential

- [`NON_NEGOTIABLES.md`](./NON_NEGOTIABLES.md) - Critical file patterns
- [`latest-updates/`](./latest-updates/) - Post-training tech updates (August 2025)  
- [`quick-reference/`](./quick-reference/) - Auto-loaded tactical patterns
- [`developer-guides/`](./developer-guides/) - Implementation guides
- [`testing/`](./testing/) - Test system reboot plan

### Reference

- [`architecture/`](./architecture/) - System design and current state
- [`security/`](./security/) - Security patterns and audit findings
- [`deployment/`](./deployment/) - Environment setup guides
- [`design-docs/`](./design-docs/) - Feature specifications
- [`planning/`](./planning/) - Roadmap and future features

### Archive

- [`deprecated/`](./deprecated/) - Legacy documentation (don't use)

## Quick Commands

- `npm test` - Unit tests (205 tests)
- `npm run test:rls` - RLS policy tests  
- `npm run smoke` - Playwright automation
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run lint` - ESLint validation

## Usage

1. Check [`CLAUDE.md`](../CLAUDE.md) for project context
2. Use [`quick-reference/`](./quick-reference/) for immediate patterns
3. Follow [`NON_NEGOTIABLES.md`](./NON_NEGOTIABLES.md) for critical requirements
4. Run tests before commits
