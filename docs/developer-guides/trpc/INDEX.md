# tRPC Developer Guide

tRPC provides end-to-end type-safe APIs for PinPoint. This guide covers tRPC patterns specific to our migration from Prisma + NextAuth to Drizzle + Supabase.

## ⚠️ Migration Notice

PinPoint is actively migrating to a new architecture. tRPC procedures are being updated to use:

- **Supabase Auth** instead of NextAuth for session management
- **Drizzle ORM** instead of Prisma for database queries
- **RLS** instead of manual organization filtering

See [Migration Guide](../../migration/supabase-drizzle/) for details.

## Guides

- [Context Patterns](./context-patterns.md) - Setting up tRPC context with Drizzle + Supabase
- ⚠️ **DEPRECATED**: [Prisma Context](./prisma-context.md) - Old Prisma-based patterns (being replaced)
