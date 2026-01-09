# Data Fetching Patterns

## Server Component + Direct Drizzle Query

````typescript
// src/app/machines/[machineId]/page.tsx
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const { machineId } = await params; // Next.js 16: params is now a Promise

// Direct query in Server Component – keep it simple unless a service adds real value
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    with: {
      issues: {
        columns: {
          id: true,
          title: true,
          status: true,
          severity: true,
          createdAt: true,
        },
        orderBy: desc(issues.createdAt),
      },
    },
  });

  return <MachineDetailView machine={machine} />;
}

## Cached Data Fetching

Use React's `cache()` to deduplicate requests for the same data within a single render pass (e.g., fetching the current user in both a layout and a page).

```typescript
// src/lib/data/user.ts
import { cache } from "react";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { userProfiles } from "~/server/db/schema";

export const getCachedUser = cache(async (userId: string) => {
  return db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
  });
});
````

**Key points:**

- Wraps an async function to memoize the result for the duration of the request.
- Essential for data needed in multiple components (Layout + Page) to avoid double DB hits.
- Only works in Server Components.

```

**Key points**:

- Query directly in Server Component, no intermediate layers (CORE-ARCH-003)
- Use `with` for relations instead of separate queries
- Select specific columns to avoid over-fetching
- Next.js 16: `params` is a Promise, must `await` before accessing properties
```
