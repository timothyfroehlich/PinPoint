# RSC Migration Phase 1: Foundation Infrastructure Plan

## 📋 Phase 1 Overview & Strategy

**Core Strategy Alignment**: Following the "bang-bang conversion" approach from your migration docs while building on your **already solid foundation**:
- Next.js 15.4.6 + React 19.1.1 (✅ RSC-ready)
- Existing hybrid architecture in app router
- Strong tRPC + Drizzle + Supabase foundation (✅ preserved)

**Phase 1 Goals**: 
1. **shadcn/ui Foundation** - Replace MUI dependency patterns
2. **Data Access Layer (DAL)** - Direct database queries for Server Components  
3. **Server Actions Infrastructure** - Form handling and mutations
4. **Base Layout Conversion** - Server-first navigation and auth patterns

## 🎯 Phase 1 Deliverables & Implementation Plan

### 1. shadcn/ui Foundation Setup
**Status**: New infrastructure required  
**Impact**: Foundation for all future components

**Implementation Steps**:

```bash
# Install shadcn/ui and dependencies
npx shadcn@latest init
npm install tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge lucide-react
```

**Files to Create**:
```
/components.json                 # shadcn/ui config
/tailwind.config.js             # Tailwind + shadcn integration  
/postcss.config.js              # PostCSS configuration
/src/lib/utils.ts               # cn() utility function
/src/components/ui/             # shadcn/ui components directory
```

**Key Configuration**:
```typescript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Match your brand colors
        primary: {
          50: "#eff6ff", 
          // ... your color scale
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}
```

**Success Criteria**: shadcn/ui Button, Card, Input components render correctly alongside MUI components

---

### 2. Server-Side Data Access Layer (DAL)
**Status**: Leverages existing Drizzle queries  
**Impact**: Enables Server Component data fetching

**Files to Create**:
```
/src/lib/dal/
├── issues.ts      # Issue queries with joins, filtering, pagination
├── machines.ts    # Machine inventory with relationships  
├── users.ts       # User management and activity queries
├── shared.ts      # Common query utilities, pagination helpers
└── index.ts       # Re-export all DAL functions
```

**Implementation Pattern**:
```typescript
// src/lib/dal/issues.ts
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { eq, and, desc } from "drizzle-orm";
import { issues, machines } from "~/server/db/schema";

export async function getIssuesForOrg(organizationId: string) {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId),
    with: {
      machine: {
        columns: { id: true, name: true, model: true }
      }
    },
    orderBy: [desc(issues.createdAt)]
  });
}

export async function getIssueById(id: string, organizationId: string) {
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.id, id),
      eq(issues.organizationId, organizationId)
    ),
    with: {
      machine: true,
      assignee: {
        columns: { id: true, name: true, email: true }
      }
    }
  });
  
  if (!issue) throw new Error("Issue not found");
  return issue;
}
```

**Success Criteria**: DAL functions return properly typed data for Server Components

---

### 3. Server Actions Infrastructure
**Status**: New infrastructure required  
**Impact**: Replaces client-side tRPC mutations for forms

**Files to Create**:
```
/src/lib/actions/
├── issue-actions.ts    # Issue CRUD operations
├── user-actions.ts     # Profile updates, org switching  
├── shared.ts          # Common action utilities
└── index.ts           # Re-export all actions
```

**Implementation Pattern**:
```typescript
// src/lib/actions/issue-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

export async function createIssueAction(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/auth/sign-in");
  }

  const organizationId = user.user_metadata?.organizationId;
  if (!organizationId) {
    throw new Error("No organization selected");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const machineId = formData.get("machineId") as string;

  if (!title || !machineId) {
    throw new Error("Title and machine are required");
  }

  const [newIssue] = await db.insert(issues).values({
    title,
    description,
    machineId, 
    organizationId,
    createdBy: user.id
  }).returning();

  revalidatePath("/issues");
  redirect(`/issues/${newIssue.id}`);
}
```

**Form Integration Pattern**:
```typescript
// Server Component form
export default function CreateIssueForm() {
  return (
    <form action={createIssueAction}>
      <input name="title" placeholder="Issue title" required />
      <textarea name="description" placeholder="Description" />
      <select name="machineId" required>
        {/* Options */}
      </select>
      <button type="submit">Create Issue</button>
    </form>
  );
}
```

**Success Criteria**: Server Actions successfully create/update data with proper validation and revalidation

---

### 4. Base Layout System Conversion  
**Status**: Build on existing app/layout.tsx  
**Impact**: Server-first navigation with client islands

**Files to Update/Create**:
```
/src/app/layout.tsx              # Update to hybrid server/client pattern
/src/components/layout/          # New server-first layout components
├── ServerNavigation.tsx         # Server Component navigation
├── UserMenuClient.tsx          # Client island for user interactions
└── MobileToggleClient.tsx      # Client island for mobile menu
```

**Implementation Strategy**:
```typescript
// src/app/layout.tsx (Server Component)
import { createClient } from "~/lib/supabase/server";
import { ServerNavigation } from "~/components/layout/ServerNavigation";
import { ClientProviders } from "./providers";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <ServerNavigation user={user} />
          <main className="flex-1">
            <ClientProviders>
              {children}
            </ClientProviders>
          </main>
        </div>
      </body>
    </html>
  );
}

// src/components/layout/ServerNavigation.tsx (Server Component)
import { UserMenuClient } from "./UserMenuClient";

export async function ServerNavigation({ user }: { user: User | null }) {
  if (!user) {
    return <LoginPrompt />;
  }

  const orgName = user.user_metadata?.organizationName || "Unknown Org";
  
  return (
    <nav className="w-64 bg-gray-50 border-r">
      <div className="p-4">
        <h2 className="font-semibold">{orgName}</h2>
        <UserMenuClient user={user} />
      </div>
      {/* Static navigation links */}
      <NavLinks />
    </nav>
  );
}

// src/components/layout/UserMenuClient.tsx (Client Component)
"use client";
import { useState } from "react";

export function UserMenuClient({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>
        {user.user_metadata?.name || user.email}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 bg-white border rounded shadow">
          {/* User menu items */}
        </div>
      )}
    </div>
  );
}
```

**Success Criteria**: Navigation renders on server with user context, client interactions work without hydration issues

---

## 🔄 Migration Execution Plan

### Week 1: Infrastructure Setup
**Day 1-2**: shadcn/ui installation and configuration
- Install dependencies and configure Tailwind
- Create initial UI components (Button, Card, Input)
- Test alongside existing MUI components

**Day 3-4**: Data Access Layer implementation  
- Create DAL structure and shared utilities
- Implement issues.ts and machines.ts DAL functions
- Test with simple Server Components

**Day 5**: Server Actions foundation
- Create actions directory structure
- Implement basic issue creation action
- Test form submission and revalidation

### Week 2: Layout System Conversion
**Day 6-8**: Server-first layout implementation
- Update root layout to hybrid pattern
- Create ServerNavigation component
- Implement client islands for user interactions

**Day 9-10**: Integration and testing
- Test complete flow: Server Component → Server Action → Revalidation
- Ensure auth context works in both server and client
- Performance baseline measurements

## 🎯 Success Criteria & Validation

**Phase 1 Complete When**:
1. ✅ shadcn/ui components render alongside MUI without conflicts
2. ✅ Server Components successfully query database via DAL
3. ✅ Server Actions handle form submissions with proper validation
4. ✅ Hybrid layout renders navigation on server, handles interactions on client
5. ✅ Auth context works correctly in both Server and Client Components
6. ✅ All existing functionality remains intact (no regressions)

**Performance Targets**:
- Initial page load improvement (baseline measurement needed)
- Reduced client bundle size (MUI still present but shadcn/ui components ready)
- No hydration mismatches or client-server boundary issues

## 🚨 Risk Mitigation

**High-Risk Areas**:
- **Auth Context**: Different patterns for server vs client components
- **Form Validation**: Moving from client tRPC to Server Actions
- **Type Safety**: Maintaining strict TypeScript with new patterns

**Mitigation Strategies**:
- Keep existing tRPC authentication patterns working alongside new server patterns
- Implement Server Actions gradually, keep tRPC fallbacks
- Extensive TypeScript checking at each step

## 📚 Foundation Advantages

**Your Codebase is Exceptionally Well-Positioned**:
- ✅ **Modern React/Next.js versions** (19.1.1/15.4.6)
- ✅ **Existing hybrid architecture** (some Server Components already)
- ✅ **Strong type safety** with strictest TypeScript
- ✅ **Solid auth/data patterns** (Supabase SSR + Drizzle + RLS)
- ✅ **Organization-scoped architecture** ready for Server Components

## 🚀 Phase 1 → Phase 2 Bridge

Once Phase 1 foundation is complete, you'll be ready for:
- **Issue Management System rewrite** (highest complexity per migration docs)
- **Machine Management conversion** 
- **Progressive MUI removal** (gradual replacement with shadcn/ui)

## ⚡ Immediate Next Steps

**Recommended Starting Point**: **shadcn/ui setup** - foundational and low-risk

The plan above gives you a solid 2-week execution path to establish the RSC foundation while preserving all existing functionality. Each deliverable builds incrementally toward your target server-first architecture.

---

**Generated**: August 2025  
**Based on**: RSC_MIGRATION/MIGRATION_OVERVIEW.md, RSC_MIGRATION/FILE_MIGRATION_PLAN.md, and comprehensive codebase analysis