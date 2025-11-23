# Machine Status Derivation Patterns

## Deriving Machine Status from Issues

Machine operational status is derived from associated open issues, not stored in the database.

```typescript
// src/lib/machines/status.ts
export type MachineStatus = "unplayable" | "needs_service" | "operational";

export interface IssueForStatus {
  status: "new" | "in_progress" | "resolved";
  severity: "minor" | "playable" | "unplayable";
}

/**
 * Derive machine status from its issues
 *
 * Logic:
 * - `unplayable`: At least one unplayable issue that's not resolved
 * - `needs_service`: At least one playable/minor issue that's not resolved
 * - `operational`: No open issues
 */
export function deriveMachineStatus(issues: IssueForStatus[]): MachineStatus {
  // Filter to only open issues (not resolved)
  const openIssues = issues.filter((issue) => issue.status !== "resolved");

  if (openIssues.length === 0) {
    return "operational";
  }

  const hasUnplayable = openIssues.some(
    (issue) => issue.severity === "unplayable"
  );
  if (hasUnplayable) {
    return "unplayable";
  }

  return "needs_service";
}

// Helper functions for UI
export function getMachineStatusLabel(status: MachineStatus): string {
  switch (status) {
    case "operational":
      return "Operational";
    case "needs_service":
      return "Needs Service";
    case "unplayable":
      return "Unplayable";
  }
}

export function getMachineStatusStyles(status: MachineStatus): string {
  switch (status) {
    case "operational":
      return "bg-green-100 text-green-800 border-green-300";
    case "needs_service":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "unplayable":
      return "bg-red-100 text-red-800 border-red-300";
  }
}
```

**Usage in Server Component**:

```typescript
// src/app/machines/page.tsx
import { deriveMachineStatus, type IssueForStatus } from "~/lib/machines/status";

export default async function MachinesPage() {
  const machines = await db.query.machines.findMany({
    with: {
      issues: {
        columns: { status: true, severity: true },
      },
    },
  });

  const machinesWithStatus = machines.map((machine) => ({
    ...machine,
    status: deriveMachineStatus(machine.issues as IssueForStatus[]),
  }));

  return <MachineList machines={machinesWithStatus} />;
}
```

**Key points**:

- Status is derived, not stored (single source of truth)
- Only open issues (not resolved) affect status
- Hierarchy: unplayable > needs_service > operational
- Helper functions for labels and styling separate from logic
- Query only needed columns (`status`, `severity`) for performance
