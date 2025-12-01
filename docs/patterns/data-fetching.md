# Data Fetching Patterns

## Server Component + Direct Drizzle Query

```typescript
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
```

**Key points**:

- Query directly in Server Component, no intermediate layers (CORE-ARCH-003)
- Use `with` for relations instead of separate queries
- Select specific columns to avoid over-fetching
- Next.js 16: `params` is a Promise, must `await` before accessing properties
