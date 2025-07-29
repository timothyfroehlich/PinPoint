# Architecture Documentation

System design patterns and architectural decisions for PinPoint.

## Current Stack (Being Replaced)

- Prisma ORM with manual organization filtering
- NextAuth.js for authentication
- Service factory pattern for dependency injection

## Migration Target

- Drizzle ORM with database-level RLS
- Supabase for auth, storage, and database hosting
- Direct service instantiation

## Contents

- **[current-state.md](./current-state.md)** - Current system architecture and components
- **[api-routes.md](./api-routes.md)** - tRPC-exclusive API strategy and exceptions
- **[dependency-injection.md](./dependency-injection.md)** - DI patterns and service organization
- **[permissions-roles-implementation.md](./permissions-roles-implementation.md)** - RBAC implementation
- **[terminology.md](./terminology.md)** - Glossary of architectural terms
- **[source-map.md](./source-map.md)** - Codebase structure overview
- **[test-map.md](./test-map.md)** - Testing architecture alignment
