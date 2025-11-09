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
- **Types**: [`CORE/TYPE_INVENTORY.md`](./CORE/TYPE_INVENTORY.md) - Type system reference and import patterns
- **Security**: [`quick-reference/api-security-patterns.md`](./quick-reference/api-security-patterns.md) - Essential patterns
- **Testing**: [`CORE/TESTING_GUIDE.md`](./CORE/TESTING_GUIDE.md) - Test types and standards

## Documentation Structure

### Essential

- [`CORE/`](./CORE/) - **Most critical documentation** (NON_NEGOTIABLES, TARGET_ARCHITECTURE, etc.)
- [`developer-guides/`](./developer-guides/) - Implementation guides
- [`testing/`](./testing/) - Test system reboot plan
- [`quick-reference/`](./quick-reference/) - Auto-loaded tactical patterns

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
- `npm run e2e` - Playwright automation (guest + auth projects)
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run lint` - ESLint validation

## Usage

1. Check [`CLAUDE.md`](../CLAUDE.md) for project context
2. Start with [`CORE/`](./CORE/) for foundational documentation
3. Use [`quick-reference/`](./quick-reference/) for immediate patterns
4. Run tests before commits
