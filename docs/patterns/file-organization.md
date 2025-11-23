# File Organization Patterns

## Project Structure Conventions

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group for auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   └── actions.ts            # Auth Server Actions
│   ├── (app)/                    # Route group for protected pages
│   │   ├── dashboard/
│   │   ├── machines/
│   │   │   ├── [machineId]/
│   │   │   │   └── page.tsx     # Server Component
│   │   │   ├── new/page.tsx
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts       # Server Actions for this route
│   │   │   └── schemas.ts       # Zod validation schemas
│   │   └── issues/
│   └── layout.tsx
├── components/                    # Shared UI components
│   ├── ui/                       # shadcn/ui components
│   ├── layout/                   # Navigation, headers
│   └── password-strength.tsx     # Domain components
├── lib/                          # Shared utilities
│   ├── supabase/
│   │   └── server.ts
│   ├── machines/                 # Domain logic
│   │   ├── status.ts
│   │   └── status.test.ts
│   ├── types/                    # Shared TypeScript types
│   ├── flash.ts                  # Flash messages
│   └── utils.ts
└── server/                       # Server-only code
    └── db/
        ├── schema.ts             # Drizzle schema
        └── index.ts              # DB instance
```

**Conventions**:

- Server Actions co-located with routes in `actions.ts` files
- Zod schemas in separate `schemas.ts` files (Next.js requirement)
- Domain components in `src/components/` (default to Server Components)
- Client Components have `"use client"` at top
- Database schema in `src/server/db/schema.ts`
- Types in `src/lib/types/`
- Domain logic in `src/lib/<domain>/` (e.g., `src/lib/machines/status.ts`)
