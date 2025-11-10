# PinPoint Technical Specification v2.0

**Last Updated**: 2025-11-10
**Status**: ACTIVE - Single-tenant simplified architecture

## Core Principles

1. **Single-Tenant First**: No organization scoping, no RLS complexity
2. **Server-First**: Default to Server Components, minimal client JavaScript
3. **Proven Stack**: Use what you know works, avoid new tech experiments
4. **Progressive Enhancement**: Forms work without JavaScript
5. **Type Safety**: TypeScript strictest, no escape hatches

---

## Technology Stack

### Frontend

**Next.js 15 (App Router)**
- React 19 Server Components as default
- Server Actions for mutations
- Streaming with Suspense
- Static generation for public pages

**React Architecture**
- Server Components for data fetching and layout
- Client Components only for: forms with interactivity, real-time features, user interactions
- React Compiler enabled for automatic optimization
- `use client` directive isolated to leaf components

**Styling**
- **Tailwind CSS v4** (primary) - CSS-based configuration
- **shadcn/ui** (components) - Server Component compatible
- **Material Design 3 colors** - From existing `globals.css`
- No Material UI - full shadcn/ui migration

**State Management**
- Server state via React cache() and Server Components
- Client state via useState/useReducer (minimal)
- No global state management libraries needed for v1.0

### Backend

**Supabase**
- Authentication (email/password only)
- PostgreSQL database
- Real-time subscriptions (for comments/timeline if needed)
- File storage (for avatars, machine photos)

**Supabase Auth Pattern**
```typescript
// Server Components & Server Actions
import { createClient } from '~/lib/supabase/server'

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  redirect('/login')
}
```

**Drizzle ORM**
- Type-safe queries
- Schema in `src/server/db/schema/`
- NO organization scoping needed
- Direct queries in Server Components

**tRPC (Minimal Use)**
- Only for client-side mutations where Server Actions don't fit
- Protected procedures require authenticated user
- Keep router surface area small

### Database Architecture

**Core Tables** (snake_case in DB):

```sql
-- Users (managed by Supabase Auth)
auth.users (id, email, created_at, ...)

-- User profiles (our extension)
user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT,
  avatar_url TEXT,
  is_member BOOLEAN DEFAULT false, -- true = member, false = public
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Machines
machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manufacturer TEXT,
  year INTEGER,
  model TEXT,
  location TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'operational', -- operational | needs_service | out_of_order
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Issues
issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new | in_progress | resolved
  severity TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  reported_by UUID REFERENCES auth.users(id), -- can be null for anonymous
  reporter_email TEXT, -- for anonymous reports
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Comments
issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id), -- null if system comment
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false, -- true for timeline events
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**NO RLS Policies** (single tenant, app-level security)

**Simplified Security Model:**
- Public routes: Issue reporting form
- Protected routes: Everything else (middleware redirects to login)
- Member check: `user_profiles.is_member = true`

### Type System

**Simplified Type Boundaries:**

```typescript
// Database types (snake_case)
import { type Db } from '~/lib/types/db'

// Application types (camelCase)
export interface Issue {
  id: string
  machineId: string
  title: string
  description: string | null
  status: 'new' | 'in_progress' | 'resolved'
  severity: 'low' | 'medium' | 'high' | 'critical'
  priority: 'low' | 'medium' | 'high'
  reportedBy: string | null
  reporterEmail: string | null
  assignedTo: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Conversion helpers
import { transformKeysToCamelCase } from '~/lib/utils/case-transform'
```

**Type Organization:**
- `~/lib/types/db.ts` - Drizzle inferred types
- `~/lib/types/models.ts` - Application domain types
- `~/lib/types/api.ts` - API request/response types
- `~/lib/types/forms.ts` - Form schemas (Zod)

---

## Architecture Patterns

### Data Access Layer

**Server Components (Primary Pattern):**

```typescript
// app/issues/page.tsx
import { db } from '~/server/db'
import { issues, machines, userProfiles } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default async function IssuesPage() {
  const issuesList = await db.query.issues.findMany({
    with: {
      machine: true,
      reportedByUser: true,
      assignedToUser: true,
    },
    orderBy: (issues, { desc }) => [desc(issues.createdAt)],
  })

  return <IssuesList issues={issuesList} />
}
```

**Server Actions (Mutations):**

```typescript
// app/issues/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '~/lib/supabase/server'
import { db } from '~/server/db'

export async function createIssue(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const title = formData.get('title') as string
  const machineId = formData.get('machineId') as string

  await db.insert(issues).values({
    title,
    machineId,
    reportedBy: user.id,
  })

  revalidatePath('/issues')
}
```

### Authentication Flow

**Middleware (Token Refresh):**
```typescript
// middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '~/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Route Protection (Server Components):**
```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '~/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if member
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  })

  if (!profile?.isMember) {
    redirect('/not-authorized')
  }

  // Render protected content
}
```

**Public Routes:**
- `/` - Homepage
- `/login` - Login page
- `/signup` - Sign up page
- `/report-issue` - Public issue reporting
- `/reset-password` - Password reset

**Protected Routes (require auth):**
- `/dashboard` - Member dashboard
- `/issues` - Issue list
- `/issues/[id]` - Issue detail
- `/machines` - Machine list
- `/machines/[id]` - Machine detail

### Form Patterns

**Server Action Form (Progressive Enhancement):**

```typescript
// components/IssueForm.tsx
'use client'

import { useFormStatus } from 'react-dom'
import { createIssue } from '~/app/issues/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? 'Creating...' : 'Create Issue'}</button>
}

export function IssueForm({ machines }: { machines: Machine[] }) {
  return (
    <form action={createIssue}>
      <input name="title" required />
      <select name="machineId" required>
        {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <textarea name="description" />
      <SubmitButton />
    </form>
  )
}
```

### File Upload (Avatars, Machine Photos)

**Supabase Storage Pattern:**

```typescript
// Server Action
export async function uploadMachinePhoto(formData: FormData) {
  const supabase = await createClient()
  const file = formData.get('photo') as File

  const fileName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`

  const { data, error } = await supabase.storage
    .from('machine-photos')
    .upload(fileName, file)

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('machine-photos')
    .getPublicUrl(fileName)

  return publicUrl
}
```

---

## Directory Structure

```
pinpoint/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, signup)
│   │   ├── (public)/          # Public pages (homepage, report)
│   │   ├── dashboard/         # Member dashboard
│   │   ├── issues/            # Issue routes
│   │   │   ├── [id]/         # Issue detail
│   │   │   ├── page.tsx      # Issue list
│   │   │   └── actions.ts    # Server Actions
│   │   ├── machines/          # Machine routes
│   │   │   ├── [id]/         # Machine detail
│   │   │   ├── new/          # Create machine
│   │   │   └── page.tsx      # Machine list
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   │
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── issues/           # Issue-specific components
│   │   ├── machines/         # Machine components
│   │   └── layout/           # Layout components (nav, etc.)
│   │
│   ├── lib/                   # Utilities & config
│   │   ├── supabase/         # Supabase clients
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Helper functions
│   │
│   └── server/                # Server-side code
│       ├── db/               # Database
│       │   ├── schema/       # Drizzle schema
│       │   └── index.ts      # DB client
│       └── api/              # tRPC routers (minimal)
│
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── e2e/                   # Playwright E2E
│
├── supabase/
│   ├── migrations/            # SQL migrations (Drizzle push)
│   └── seed.sql               # Seed data
│
└── docs/
    ├── PRODUCT_SPEC.md        # What we're building
    ├── TECH_SPEC.md           # This file
    └── TESTING_PLAN.md        # How we test
```

---

## What We're NOT Using (Complexity Removed)

### ❌ Multi-Tenant Features
- No `organizationId` in queries
- No RLS policies for org separation
- No organization context resolution
- No organization switching UI
- No org-scoped caching

### ❌ Over-Engineered Auth
- No complex role hierarchies
- No permission matrices
- No custom auth context wrappers
- Simple: member boolean is sufficient

### ❌ Premature Abstractions
- No DAL (Data Access Layer) - query directly in Server Components
- No repository pattern - Drizzle queries are clean enough
- No service layer - Server Actions are services
- No request context tracking

### ❌ Enterprise Features We Don't Need
- No audit logging (v1.0)
- No activity feeds (v1.0)
- No analytics tracking (v1.0)
- No performance monitoring (v1.0)
- No error tracking service (console.error is fine initially)

---

## Performance Strategy

### Caching
```typescript
import { cache } from 'react'

// Dedupe within request
export const getMachines = cache(async () => {
  return await db.query.machines.findMany()
})
```

### Streaming & Suspense
```typescript
<Suspense fallback={<IssueListSkeleton />}>
  <IssueList />
</Suspense>
```

### Image Optimization
- Use Next.js `<Image>` component
- Supabase storage handles transformations

---

## Security Checklist

- ✅ Supabase middleware for session refresh
- ✅ Server Components check auth before rendering
- ✅ Server Actions validate user auth
- ✅ Public routes explicitly defined
- ✅ Input validation with Zod schemas
- ✅ SQL injection prevented by Drizzle parameterization
- ✅ XSS prevented by React escaping
- ✅ File upload validation (type, size)
- ❌ No RLS needed (single tenant)
- ❌ No CSRF tokens needed (Server Actions handle this)

---

## Development Workflow

### Local Development
```bash
npm run dev              # Start Next.js dev server
npm run db:push:local    # Apply schema changes
npm run db:studio        # Open Drizzle Studio
```

### Database Changes
1. Edit schema in `src/server/db/schema/`
2. Run `npm run db:push:local` (no migration files)
3. Update seed data if needed

### Testing
```bash
npm test                 # Unit/integration tests
npm run e2e              # Playwright E2E tests
```

### Deployment
- Vercel (Next.js)
- Supabase (managed PostgreSQL + Auth)

---

## Migration from v1 (Current Codebase)

**What to Keep:**
- Existing schema structure (just remove org scoping)
- Supabase + Drizzle + tRPC setup
- TypeScript config
- Testing infrastructure (Vitest, Playwright)
- Material Design 3 color system in globals.css

**What to Remove:**
- All `organizationId` columns and queries
- RLS policies
- Organization management pages
- Complex auth context
- User role management beyond `is_member` boolean
- Half-finished features not in PRODUCT_SPEC.md

**Data Migration:**
If keeping existing data:
```sql
-- Remove org scoping, keep data
ALTER TABLE machines DROP COLUMN organization_id;
ALTER TABLE issues DROP COLUMN organization_id;
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-10 | Single tenant only | Removes 40% complexity, APC is only user |
| 2025-11-10 | No RLS policies | Not needed for single tenant |
| 2025-11-10 | Server Actions primary | Simpler than tRPC for most mutations |
| 2025-11-10 | Drizzle push (no migrations) | Pre-beta, can change schema freely |
| 2025-11-10 | `is_member` boolean vs roles | Simple permission model sufficient |

---

**Simplicity is a feature.** This architecture gets out of your way and lets you ship.
