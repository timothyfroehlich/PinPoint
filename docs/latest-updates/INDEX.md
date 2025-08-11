# Latest Tech Stack Updates

Critical updates for direct Prisma-to-Drizzle migration (August 2025).

## Migration Context

- **Solo development + pre-beta** = direct conversion approach
- **Timeline:** 2-3 weeks vs 7+ weeks with validation
- **Philosophy:** Velocity and learning over production safety

## Breaking Changes Alert

- **Supabase:** `@supabase/auth-helpers` → `@supabase/ssr` (CRITICAL)
- **Material UI v7:** CSS Layers, Hidden component removal
- **Vitest:** `workspace` → `projects` configuration

## Contents

- **[quick-reference.md](./quick-reference.md)** - Complete migration overview and checklist
- **[drizzle-orm.md](./drizzle-orm.md)** - Generated columns, relational queries, PGlite testing
- **[supabase.md](./supabase.md)** - Server-centric auth migration workflow
- **[nextjs.md](./nextjs.md)** - App Router, Server Components/Actions patterns
- **[material-ui-v7.md](./material-ui-v7.md)** - API cleanup and CSS Layers setup
- **[vitest.md](./vitest.md)** - Modern ES Module mocking patterns
