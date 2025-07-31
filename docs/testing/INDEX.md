# Testing Documentation

Comprehensive testing patterns and strategies for PinPoint.

## Current Stack (Being Replaced)

- Heavy Prisma mocking with complex test doubles
- Unit test focused approach
- Mock-based isolation

## Migration Target

- Transaction-based testing with real database
- Integration test focused approach
- Minimal mocking (external services only)

## Contents

- **[index.md](./index.md)** - Testing philosophy and quick start guide
- **[unit-patterns.md](./unit-patterns.md)** - Pure function and business logic testing
- **[integration-patterns.md](./integration-patterns.md)** - Database and API testing with transactions
- **[supabase-patterns.md](./supabase-patterns.md)** - Supabase Storage and Authentication testing patterns
- **[test-database.md](./test-database.md)** - Supabase local setup for testing
- **[configuration.md](./configuration.md)** - Vitest configuration and setup
- **[performance.md](./performance.md)** - Test execution optimization
- **[troubleshooting.md](./troubleshooting.md)** - Common issues and debugging
