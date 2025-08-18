# Testing Documentation

Comprehensive testing patterns and strategies for PinPoint.

## Modern Testing Stack (Post-RLS)

- **Worker-scoped PGlite**: Memory-safe testing (prevents system lockups)
- **RLS session context**: Automatic organizational scoping via PostgreSQL session variables
- **Transaction isolation**: Each test gets clean database state with automatic rollback
- **Integration-focused**: Real database constraints and relationships
- **Minimal mocking**: External services only, database operations use real PGlite
- **Type-safe patterns**: Drizzle provides full type inference
- **Specialized agents**: Dedicated testing architects for each archetype pattern

## Contents

### Core Testing Strategies

- **[GUIDE.md](./GUIDE.md)** - Testing philosophy and quick start guide
- **[unit-patterns.md](./unit-patterns.md)** - Pure function and business logic testing
- **[integration-patterns.md](./integration-patterns.md)** - Database and API testing with transactions
- **[resilient-ui-patterns.md](./resilient-ui-patterns.md)** - UI testing patterns that resist minor changes (unit & E2E with MUI components)

### Advanced Testing Patterns (NEW)

- **[supabase-auth-patterns.md](./supabase-auth-patterns.md)** - Supabase authentication testing with user/org structure
- **[advanced-mock-patterns.md](./advanced-mock-patterns.md)** - Sophisticated mocking with type preservation
- **[hook-testing-patterns.md](./hook-testing-patterns.md)** - React hook testing with dependency injection
- **[validation-factory-patterns.md](./validation-factory-patterns.md)** - Type-safe test data factories for validation
- **[multi-tenant-testing.md](./multi-tenant-testing.md)** - Organization boundary and security testing

### Infrastructure & Setup

- **[test-database.md](./test-database.md)** - Supabase local setup for testing
- **[configuration.md](./configuration.md)** - Vitest configuration and setup
- **[performance.md](./performance.md)** - Test execution optimization
- **[troubleshooting.md](./troubleshooting.md)** - Common issues and debugging
