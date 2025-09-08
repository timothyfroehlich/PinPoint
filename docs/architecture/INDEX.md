# Architecture Documentation

## Current Stack

- **Database**: PostgreSQL + Drizzle ORM (100% Drizzle-only)
- **Auth**: Supabase SSR
- **API**: tRPC with organization scoping
- **UI**: Material UI v7 + shadcn/ui (transition)
- **Framework**: Next.js 14 App Router

## Current Phase

- **RSC Migration**: Server-first architecture with shadcn/ui
- **Multi-tenant**: Organization-scoped queries with RLS policies
- **Testing**: Archetype system reboot

## Contents

- **[current-state.md](./current-state.md)** - Detailed system architecture
- **[api-routes.md](./api-routes.md)** - tRPC patterns and routing
- **[dependency-injection.md](./dependency-injection.md)** - Service patterns
- **[permissions-roles-implementation.md](./permissions-roles-implementation.md)** - RBAC system
- **[terminology.md](./terminology.md)** - Project glossary
- **[source-map.md](./source-map.md)** - Codebase structure
