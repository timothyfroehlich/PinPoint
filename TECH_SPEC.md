# PinPoint Technical Specification v2.0

**Last Updated**: 2025-11-10
**Status**: ACTIVE - Single-tenant simplified architecture

## Core Principles

1. **Single-Tenant First**: No organization scoping, no RLS complexity
2. **Server-First**: Default to Server Components, minimal client JavaScript
3. **Direct Data Access**: Query database directly in Server Components (no DAL/repository layers)
4. **Proven Stack**: Use latest stable versions, avoid experiments
5. **Type Safety**: TypeScript strictest, no escape hatches

---

## Technology Stack

### Frontend

**Next.js 16 (App Router)**
- React 19 Server Components as default
- Server Actions for mutations
- Streaming with Suspense
- Static generation for public pages

**React Architecture**
- Server Components for data fetching and layout
- Client Components only for: forms with interactivity, user interactions
- React Compiler enabled for automatic optimization
- `use client` directive isolated to leaf components

**Styling**
- **Tailwind CSS v4** (primary) - CSS-based configuration
- **shadcn/ui** (components) - Server Component compatible
- **Material Design 3 colors** - From `globals.css`

**State Management**
- Server state via React cache() and Server Components
- Client state via useState/useReducer (minimal)
- No global state management libraries

### Backend

**Supabase**
- Authentication (email/password for MVP)
- PostgreSQL database
- File storage (for avatars, machine photos in MVP+)
- **No real-time subscriptions** (MVP doesn't need it)

**Drizzle ORM**
- Type-safe queries
- Schema in `src/server/db/schema/`
- NO organization scoping
- Direct queries in Server Components

**tRPC (Minimal Use)**
- Only for client-side mutations where Server Actions don't fit
- Protected procedures require authenticated user
- Keep router surface area small

---

## Database Schema (MVP)

### Core Tables

```sql
-- Users (managed by Supabase Auth)
-- We don't touch auth.users directly

-- User Profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',  -- 'guest' | 'member' | 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Machines (MVP: name only)
CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MVP+: Add machine details
-- manufacturer TEXT
-- year INTEGER
-- model TEXT
-- location TEXT
-- photo_url TEXT
-- owner_id UUID REFERENCES auth.users(id)

-- Issues (always per-machine)
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'in_progress' | 'resolved'
  severity TEXT NOT NULL DEFAULT 'gameplay',  -- 'minor' | 'gameplay' | 'unplayable'
  reported_by UUID REFERENCES auth.users(id),  -- NULL for anonymous reports
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT issues_machine_required CHECK (machine_id IS NOT NULL)
);

-- Comments & Timeline
CREATE TABLE issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),  -- NULL for system comments
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,  -- true for timeline events
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Database Trigger: Auto-create user_profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'User'), 'member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### Indexes

```sql
-- Performance indexes for common queries
CREATE INDEX idx_issues_machine_id ON issues(machine_id);
CREATE INDEX idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_severity ON issues(severity);
CREATE INDEX idx_issue_comments_issue_id ON issue_comments(issue_id);
```

---

## Why No DAL/Repository/Service Layers?

**TL;DR:** Server Components + Drizzle already provide everything those layers offer, without the overhead.

### The Traditional Layered Approach

```typescript
// ❌ Over-engineered: 3 layers for one query

// Repository Layer
class IssueRepository {
  async findByMachine(machineId: string): Promise<Issue[]> {
    return await db.query.issues.findMany({
      where: eq(issues.machineId, machineId)
    })
  }
}

// Service Layer
class IssueService {
  constructor(private repo: IssueRepository) {}

  async getIssuesForMachine(machineId: string): Promise<Issue[]> {
    return await this.repo.findByMachine(machineId)
  }
}

// Controller/Route Layer
export async function getIssues(machineId: string) {
  const service = new IssueService(new IssueRepository())
  return await service.getIssuesForMachine(machineId)
}
```

**Problems:**
- 3 files to understand one query
- Abstraction without value (just passing data through)
- Testing requires mocking all layers
- Mental overhead tracking through layers

### The Server Component Approach

```typescript
// ✅ Simple: Direct query where needed

export default async function MachinePage({ params }: { params: { id: string } }) {
  // Query directly in the component
  const issues = await db.query.issues.findMany({
    where: eq(issues.machineId, params.id),
    with: { assignedTo: true },
    orderBy: desc(issues.createdAt)
  })

  return <IssueList issues={issues} />
}
```

**Benefits:**
- 1 file to understand the query
- Colocated with usage (easy to modify)
- Drizzle provides type safety
- cache() handles deduplication
- Less code = fewer bugs

### When You WOULD Need Layers

Add abstractions when you have:
- **Multiple clients** (web app + mobile app + API)
- **Complex business logic** (multi-step transactions, saga patterns)
- **Multiple databases** (read/write splitting, sharding)
- **Large team** (10+ engineers needing boundaries)

**For MVP:** You have none of these. Direct queries are perfect.

### The Rule of Three

Add abstraction when you have **3+ duplicate implementations**, not before.

```typescript
// First usage - direct query (fine)
const issues = await db.query.issues.findMany(...)

// Second usage - still direct (fine)
const issues = await db.query.issues.findMany(...)

// Third usage - NOW consider abstracting
export const getIssuesByMachine = cache(async (machineId: string) => {
  return await db.query.issues.findMany({
    where: eq(issues.machineId, machineId)
  })
})
```

---

## Authentication & Authorization

### Supabase Auth Flow

```typescript
// Server Component
import { createClient } from '~/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile with role
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id)
  })

  // Check authorization
  if (profile?.role !== 'member' && profile?.role !== 'admin') {
    redirect('/unauthorized')
  }

  // Render protected content
  return <Dashboard user={user} profile={profile} />
}
```

### Server Action

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '~/lib/supabase/server'

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
    severity: 'gameplay',  // default
    status: 'new',
  })

  revalidatePath('/issues')
  redirect('/issues')
}
```

### Middleware (Session Refresh)

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

---

## Data Flow Patterns

### Server Component Data Fetching

```typescript
import { cache } from 'react'

// Deduplicate within request
export const getMachines = cache(async () => {
  return await db.query.machines.findMany({
    orderBy: asc(machines.name)
  })
})

// Use in component
export default async function MachinesPage() {
  const machines = await getMachines()
  return <MachineList machines={machines} />
}
```

### Form with Server Action

```typescript
// components/IssueForm.tsx
'use client'

import { useFormStatus } from 'react-dom'
import { createIssue } from '~/app/issues/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending}>
      {pending ? 'Creating...' : 'Create Issue'}
    </button>
  )
}

export function IssueForm({ machines }: { machines: Machine[] }) {
  return (
    <form action={createIssue}>
      <input name="title" required />
      <select name="machineId" required>
        {machines.map(m => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <select name="severity" required>
        <option value="minor">Minor</option>
        <option value="gameplay">Gameplay Issue</option>
        <option value="unplayable">Unplayable</option>
      </select>
      <textarea name="description" />
      <SubmitButton />
    </form>
  )
}
```

---

## Type System

### Database Types (Drizzle)

```typescript
// src/server/db/schema/machines.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const machines = pgTable('machines', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export type Machine = typeof machines.$inferSelect
export type NewMachine = typeof machines.$inferInsert
```

### Application Types

```typescript
// src/lib/types/models.ts

export interface Issue {
  id: string
  machineId: string
  title: string
  description: string | null
  status: 'new' | 'in_progress' | 'resolved'
  severity: 'minor' | 'gameplay' | 'unplayable'
  reportedBy: string | null
  assignedTo: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface IssueWithRelations extends Issue {
  machine: Machine
  reportedByUser?: UserProfile | null
  assignedToUser?: UserProfile | null
  comments: IssueComment[]
}
```

---

## Environment Strategy

### Two Separate Supabase Projects

**Preview Environment:**
- URL: `preview.pinpoint.dev` (example)
- Supabase project: `pinpoint-preview`
- Database: Test/seed data
- Purpose: Development, staging, testing
- Can be reset/rebuilt anytime

**Production Environment:**
- URL: `pinpoint.dev` (example)
- Supabase project: `pinpoint-prod`
- Database: Real member data
- Purpose: Live production use
- Strict change control, backups enabled

### Environment Variables

```bash
# .env.local (Preview)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...

# .env.production (Production)
NEXT_PUBLIC_SUPABASE_URL=https://yyy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...
```

### Deployment Strategy

```bash
# Preview: Vercel preview deployments
git push origin feature-branch
# → Auto-deploys to preview.pinpoint.dev

# Production: Merge to main
git push origin main
# → Auto-deploys to pinpoint.dev
```

---

## Directory Structure

```
pinpoint/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/              # Auth routes (login, signup)
│   │   ├── (public)/            # Public routes (report issue)
│   │   ├── dashboard/           # Member dashboard
│   │   ├── issues/              # Issue management
│   │   │   ├── [id]/           # Issue detail
│   │   │   ├── page.tsx        # Issue list
│   │   │   └── actions.ts      # Server Actions
│   │   ├── machines/            # Machine management
│   │   │   ├── [id]/           # Machine detail
│   │   │   └── page.tsx        # Machine list
│   │   ├── layout.tsx           # Root layout
│   │   └── globals.css          # Global styles
│   │
│   ├── components/              # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── issues/             # Issue components
│   │   ├── machines/           # Machine components
│   │   └── layout/             # Layout components
│   │
│   ├── lib/                     # Utilities
│   │   ├── supabase/           # Supabase clients
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Helper functions
│   │
│   └── server/                  # Server-side code
│       └── db/                 # Database
│           ├── schema/         # Drizzle schema
│           └── index.ts        # DB client
│
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # Playwright E2E
│
└── supabase/
    ├── migrations/              # SQL migrations
    └── seed.sql                 # Seed data
```

---

## Development Workflow

### Local Development

```bash
# Start Next.js dev server
npm run dev

# Apply schema changes (no migration files)
npm run db:push:local

# Open Drizzle Studio
npm run db:studio

# Run tests
npm test

# Run E2E tests
npm run e2e
```

### Database Changes

1. Edit schema in `src/server/db/schema/`
2. Run `npm run db:push:local` (pushes changes directly)
3. Update seed data if needed
4. Test locally
5. Repeat for production when ready

**No migration files** - Pre-beta, can change schema freely with drizzle-kit push.

---

## Performance Strategy

### Caching

```typescript
import { cache } from 'react'

// Request-level deduplication
export const getIssue = cache(async (id: string) => {
  return await db.query.issues.findFirst({
    where: eq(issues.id, id),
    with: {
      machine: true,
      assignedToUser: true,
    }
  })
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
- Supabase Storage auto-optimizes images
- Lazy load images below the fold

---

## Security Checklist

### Authentication
- ✅ Supabase middleware for session refresh
- ✅ Server Components check auth before rendering
- ✅ Server Actions validate user auth
- ✅ Public routes explicitly defined
- ✅ Password reset flow implemented

### Input Validation
- ✅ Zod schemas for form validation
- ✅ Server-side validation in Server Actions
- ✅ SQL injection prevented by Drizzle parameterization
- ✅ XSS prevented by React escaping

### Authorization
- ✅ Role checking (guest/member/admin)
- ✅ Protected routes redirect to login
- ✅ File upload validation (type, size) in MVP+

### Not Needed for Single-Tenant
- ❌ No RLS policies (single tenant)
- ❌ No CSRF tokens (Server Actions handle this)
- ❌ No organization scoping

---

## Tech Stack Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-10 | Next.js 16 | Use latest stable release |
| 2025-11-10 | No real-time subscriptions | MVP doesn't need it, adds complexity |
| 2025-11-10 | No DAL/Repository layers | Server Components + Drizzle is sufficient |
| 2025-11-10 | Issues always per-machine | Aligns with reality, simplifies schema |
| 2025-11-10 | Severity: minor/gameplay/unplayable | Player-centric, clear language |
| 2025-11-10 | Role: guest/member/admin | Simple, extensible permission model |
| 2025-11-10 | Two Supabase projects | Preview/prod separation, clean data |
| 2025-11-10 | Drizzle push (no migrations) | Pre-beta, can change schema freely |

---

**Simplicity is a feature.** This architecture gets out of your way and lets you ship.
