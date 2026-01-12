---
trigger: always_on
# For Antigravity
---

# PinPoint Code Patterns

**Last Updated**: November 22, 2025
**Version**: 2.1 (Refactored)

**For AI Agents**: This is a living document. When you implement a pattern more than once, add it to the appropriate file in `docs/patterns/` so future agents can follow the same approach.

---

## Pattern Categories

- [Data Fetching](./patterns/data-fetching.md)
  - Server Component + Direct Drizzle Query
  - Cached Data Fetching (React `cache()`)
- [Mutations](./patterns/mutations.md)
  - Server Action + Zod Validation + Redirect
  - Server Action Error Handling
- [Authentication](./patterns/authentication.md)
  - Auth Check in Server Components
  - Auth Check in Server Actions
  - Protected Route Pattern
  - Logout Action Pattern
- [File Organization](./patterns/file-organization.md)
  - Project Structure Conventions
- [Domain Rules](./patterns/domain-rules.md)
  - Issues Always Require Machine
- [Type Boundaries](./patterns/type-boundaries.md)
  - Database to Application Type Conversion
- [Severity Naming](./patterns/severity-naming.md)
  - Player-Centric Language
- [Progressive Enhancement](./patterns/progressive-enhancement.md)
  - Forms That Work Without JavaScript
- [Machine Status Derivation](./patterns/machine-status-derivation.md)
  - Deriving Machine Status from Issues
- [Testing Patterns](./patterns/testing-patterns.md)
  - Playwright E2E Tests
  - Integration Tests with PGlite
  - Integration Tests with Module Mocking
  - Unit Tests
  - Vitest Deep Mocks (vitest-mock-extended)
- [Logging](./patterns/logging.md)
  - Structured Logging in Server Actions
- [UI & Styling](./patterns/ui-styling.md)
  - Component Usage
  - Layout Patterns
- [URL Construction](./patterns/url-construction.md)
  - Consistent Site URL Resolution
- [Database Migrations](./patterns/database-migrations.md)
  - Drizzle Migrations + Test Schema Export
- [Config-Driven Enums](./patterns/config-driven-enums.md) ⭐ **NEW**
  - Single Source of Truth for Domain Enums
  - Rich Metadata (labels, icons, styles, descriptions)
- [Service Layer Transactions](./patterns/service-layer-transactions.md) ⭐ **NEW**
  - Transactional Updates with Timeline Events
  - Notification Error Handling
- [Discriminated Union Props](./patterns/ui-patterns/discriminated-union-props.md) ⭐ **NEW**
  - Type-Safe Component Props for Multi-Type Components

## Adding New Patterns

**When to add a pattern**:

- You've used the same approach in 3+ places ("Rule of Three").
- A new architectural decision is made (e.g., "Always use X for Y").

**How to add**:

1.  Check if a relevant file exists in `docs/patterns/`.
2.  If yes, append the new pattern there.
3.  If no, create a new file in `docs/patterns/` and link it here.
