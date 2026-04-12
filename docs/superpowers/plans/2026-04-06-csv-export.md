# CSV Issue Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV export of issues from the issues list page (filter-aware) and machine detail page (all issues for that machine).

**Architecture:** Server action generates CSV string from a DB query, returns it via `Result<{ csv: string; fileName: string }>`. Client creates a `Blob` and triggers a browser download. Two UI entry points share the same action—issues list passes current filters, machine page passes `machineInitials` only.

**Tech Stack:** Drizzle ORM queries, existing `IssueFilters` + `buildWhereConditions()`, `docToPlainText()` variant for first-paragraph extraction, `sonner` toasts, Playwright download interception for E2E.

---

## File Structure

| Action | Path                                                | Responsibility                                            |
| ------ | --------------------------------------------------- | --------------------------------------------------------- |
| Create | `src/lib/export/csv.ts`                             | CSV string generation utility (quoting, escaping, BOM)    |
| Create | `src/lib/export/csv.test.ts`                        | Unit tests for CSV utility                                |
| Create | `src/lib/tiptap/first-paragraph.ts`                 | Extract first paragraph as plain text from ProseMirrorDoc |
| Create | `src/lib/tiptap/first-paragraph.test.ts`            | Unit tests for first-paragraph extraction                 |
| Create | `src/app/(app)/issues/export-action.ts`             | Server action: `exportIssuesAction`                       |
| Create | `src/app/(app)/issues/export-schema.ts`             | Zod schema for export action input                        |
| Create | `src/components/issues/ExportButton.tsx`            | Client component: download icon button with loading/toast |
| Modify | `src/components/issues/IssueList.tsx`               | Add ExportButton next to View Options button              |
| Modify | `src/app/(app)/m/[initials]/issues-expando.tsx`     | Add ExportButton in expando header                        |
| Create | `src/test/integration/export/export-issues.test.ts` | Integration tests for export action                       |
| Modify | `e2e/smoke/issue-list.spec.ts`                      | E2E: click export button on issues list, verify download  |
| Modify | `e2e/smoke/machine-details-redesign.spec.ts`        | E2E: click export button on machine page, verify download |

---

### Task 1: CSV String Generation Utility

**Files:**

- Create: `src/lib/export/csv.ts`
- Create: `src/lib/export/csv.test.ts`

- [ ] **Step 1: Write failing tests for CSV generation**

```ts
// src/lib/export/csv.test.ts
import { describe, expect, it } from "vitest";
import { generateCsv } from "./csv";

describe("generateCsv", () => {
  it("generates header row and data rows", () => {
    const result = generateCsv(
      ["Name", "Value"],
      [
        ["Alice", "10"],
        ["Bob", "20"],
      ]
    );
    // BOM + header + 2 data rows
    const lines = result.split("\r\n");
    // First line starts with BOM
    expect(lines[0]).toBe("\uFEFFName,Value");
    expect(lines[1]).toBe("Alice,10");
    expect(lines[2]).toBe("Bob,20");
    expect(lines[3]).toBe(""); // trailing newline
  });

  it("quotes fields containing commas", () => {
    const result = generateCsv(["Col"], [["hello, world"]]);
    expect(result).toContain('"hello, world"');
  });

  it("escapes double quotes by doubling them", () => {
    const result = generateCsv(["Col"], [['say "hi"']]);
    expect(result).toContain('"say ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    const result = generateCsv(["Col"], [["line1\nline2"]]);
    expect(result).toContain('"line1\nline2"');
  });

  it("handles empty data", () => {
    const result = generateCsv(["A", "B"], []);
    const lines = result.split("\r\n");
    expect(lines[0]).toBe("\uFEFFA,B");
    expect(lines[1]).toBe("");
  });

  it("handles empty string fields", () => {
    const result = generateCsv(["A", "B"], [["", "val"]]);
    expect(result).toContain(",val");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/export/csv.test.ts`
Expected: FAIL — module `./csv` not found

- [ ] **Step 3: Implement CSV utility**

```ts
// src/lib/export/csv.ts

/**
 * UTF-8 BOM prefix for Excel compatibility.
 * Without this, Excel may misinterpret Unicode characters.
 */
const BOM = "\uFEFF";

/**
 * Escape a single CSV field per RFC 4180:
 * - If the field contains a comma, double-quote, or newline, wrap it in double quotes
 * - Double any existing double quotes
 */
function escapeField(field: string): string {
  if (
    field.includes(",") ||
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r")
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Generate a CSV string from headers and rows.
 * Uses CRLF line endings (RFC 4180) and a UTF-8 BOM for Excel.
 */
export function generateCsv(headers: string[], rows: string[][]): string {
  const headerLine = BOM + headers.map(escapeField).join(",");
  const dataLines = rows.map((row) => row.map(escapeField).join(","));
  return [headerLine, ...dataLines, ""].join("\r\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/export/csv.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/csv.ts src/lib/export/csv.test.ts
git commit -m "feat(export): add CSV string generation utility"
```

---

### Task 2: First-Paragraph Extraction Utility

**Files:**

- Create: `src/lib/tiptap/first-paragraph.ts`
- Create: `src/lib/tiptap/first-paragraph.test.ts`

- [ ] **Step 1: Write failing tests for first-paragraph extraction**

```ts
// src/lib/tiptap/first-paragraph.test.ts
import { describe, expect, it } from "vitest";
import { extractFirstParagraph } from "./first-paragraph";
import type { ProseMirrorDoc } from "./types";

describe("extractFirstParagraph", () => {
  it("extracts text from the first paragraph", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph here." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph." }],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("First paragraph here.");
  });

  it("strips formatting marks (bold, italic, links)", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Bold text",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "italic",
              marks: [{ type: "italic" }],
            },
          ],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Bold text and italic");
  });

  it("handles mentions by using the label", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Reported by " },
            {
              type: "mention",
              attrs: { id: "user-123", label: "Tim" },
            },
          ],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Reported by @Tim");
  });

  it("joins hard breaks with spaces", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Line one Line two");
  });

  it("returns empty string for null/undefined doc", () => {
    expect(extractFirstParagraph(null)).toBe("");
    expect(extractFirstParagraph(undefined)).toBe("");
  });

  it("returns empty string for empty doc", () => {
    const doc: ProseMirrorDoc = { type: "doc", content: [] };
    expect(extractFirstParagraph(doc)).toBe("");
  });

  it("returns empty string for doc with empty paragraph", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
    expect(extractFirstParagraph(doc)).toBe("");
  });

  it("skips non-paragraph first nodes (e.g., heading) and finds first paragraph", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body text" }],
        },
      ],
    };
    expect(extractFirstParagraph(doc)).toBe("Body text");
  });

  it("handles legacy plain text strings", () => {
    expect(
      extractFirstParagraph("Plain text value" as unknown as ProseMirrorDoc)
    ).toBe("Plain text value");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/tiptap/first-paragraph.test.ts`
Expected: FAIL — module `./first-paragraph` not found

- [ ] **Step 3: Implement first-paragraph extraction**

```ts
// src/lib/tiptap/first-paragraph.ts
import type { ProseMirrorDoc, ProseMirrorNode } from "./types";

/**
 * Extract the first paragraph's plain text from a ProseMirrorDoc.
 * Strips all formatting marks. Joins hard breaks with spaces.
 * Handles legacy plain-text string values.
 */
export function extractFirstParagraph(
  doc: ProseMirrorDoc | string | null | undefined
): string {
  if (!doc) return "";
  if (typeof doc === "string") return doc;

  const d = doc as unknown;
  if (
    !d ||
    typeof d !== "object" ||
    (d as Record<string, unknown>)["type"] !== "doc" ||
    !Array.isArray((d as Record<string, unknown>)["content"])
  ) {
    return "";
  }

  const validDoc = d as ProseMirrorDoc;

  // Find the first paragraph node
  const firstParagraph = validDoc.content.find(
    (node) => node.type === "paragraph"
  );
  if (!firstParagraph?.content) return "";

  return extractTextFromNodes(firstParagraph.content).trim();
}

/**
 * Recursively extract plain text from ProseMirror nodes,
 * ignoring all marks (bold, italic, links, etc.).
 */
function extractTextFromNodes(nodes: ProseMirrorNode[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    } else if (
      node.type === "mention" &&
      typeof node.attrs?.["label"] === "string"
    ) {
      parts.push(`@${node.attrs["label"]}`);
    } else if (node.type === "hardBreak") {
      parts.push(" ");
    }
    // Marks are on text nodes and are simply ignored — we only read node.text
  }

  return parts.join("");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/tiptap/first-paragraph.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tiptap/first-paragraph.ts src/lib/tiptap/first-paragraph.test.ts
git commit -m "feat(export): add first-paragraph extraction for ProseMirrorDoc"
```

---

### Task 3: Export Zod Schema

**Files:**

- Create: `src/app/(app)/issues/export-schema.ts`

- [ ] **Step 1: Create the export validation schema**

This schema validates the inputs to the export action. Filter values are passed as JSON-encoded strings from the client. `machineInitials` is optional—present only for machine-page exports.

```ts
// src/app/(app)/issues/export-schema.ts
import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";

/**
 * Schema for CSV export action input.
 *
 * The client serializes the current filter state as JSON.
 * machineInitials is passed separately for machine-page exports.
 */
export const exportIssuesSchema = z.object({
  /** JSON-serialized filter state from the issues list. Optional — omitted for machine exports. */
  filtersJson: z.string().optional(),

  /** Machine initials for machine-page export (overrides any machine filter). */
  machineInitials: z
    .string()
    .regex(/^[A-Za-z0-9]{2,6}$/, "Invalid machine initials")
    .optional(),
});

/**
 * Schema for parsing the filters JSON string into typed filters.
 * Intentionally permissive — unknown fields are stripped, invalid enum values
 * are filtered out. This avoids coupling the export to the exact filter shape.
 */
export const exportFiltersSchema = z.object({
  q: z.string().optional(),
  status: z.array(z.enum(ISSUE_STATUS_VALUES)).optional(),
  machine: z.array(z.string()).optional(),
  severity: z
    .array(z.enum(["cosmetic", "minor", "major", "unplayable"]))
    .optional(),
  priority: z.array(z.enum(["low", "medium", "high"])).optional(),
  frequency: z
    .array(z.enum(["intermittent", "frequent", "constant"]))
    .optional(),
  assignee: z.array(z.string()).optional(),
  owner: z.array(z.string()).optional(),
  reporter: z.array(z.string()).optional(),
  watching: z.boolean().optional(),
  includeInactiveMachines: z.boolean().optional(),
  sort: z.string().optional(),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/issues/export-schema.ts
git commit -m "feat(export): add Zod validation schema for export action"
```

---

### Task 4: Export Server Action

**Files:**

- Create: `src/app/(app)/issues/export-action.ts`

- [ ] **Step 1: Implement the server action**

```ts
// src/app/(app)/issues/export-action.ts
"use server";

import { and, eq } from "drizzle-orm";
import { format } from "date-fns";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import {
  buildWhereConditions,
  buildOrderBy,
} from "~/lib/issues/filters-queries";
import type { IssueFilters } from "~/lib/issues/filters";
import { generateCsv } from "~/lib/export/csv";
import { extractFirstParagraph } from "~/lib/tiptap/first-paragraph";
import {
  getIssueStatusLabel,
  getIssueSeverityLabel,
  getIssuePriorityLabel,
  getIssueFrequencyLabel,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import { exportIssuesSchema, exportFiltersSchema } from "./export-schema";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

export type ExportIssuesResult = Result<
  { csv: string; fileName: string },
  "UNAUTHORIZED" | "VALIDATION" | "SERVER" | "EMPTY"
>;

const CSV_HEADERS = [
  "Issue ID",
  "Machine",
  "Title",
  "Description",
  "Status",
  "Severity",
  "Priority",
  "Frequency",
  "Reporter",
  "Assigned To",
  "Created",
  "Updated",
  "Closed",
];

function formatDate(date: Date | null): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export async function exportIssuesAction(input: {
  filtersJson?: string;
  machineInitials?: string;
}): Promise<ExportIssuesResult> {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "You must be signed in to export issues.");
  }

  // 2. Validate input
  const inputValidation = exportIssuesSchema.safeParse(input);
  if (!inputValidation.success) {
    return err(
      "VALIDATION",
      inputValidation.error.issues[0]?.message ?? "Invalid input"
    );
  }
  const { filtersJson, machineInitials } = inputValidation.data;

  // 3. Parse filters
  let filters: IssueFilters = {};
  if (filtersJson) {
    try {
      const parsed = JSON.parse(filtersJson) as unknown;
      const filterValidation = exportFiltersSchema.safeParse(parsed);
      if (filterValidation.success) {
        filters = filterValidation.data;
      }
    } catch {
      // Invalid JSON — proceed with no filters (export all)
    }
  }

  // Machine-page export: override machine filter
  if (machineInitials) {
    filters.machine = [machineInitials];
    // Machine page exports ALL issues (no default status filter)
    // Set status to empty array to mean "all statuses"
    filters.status = [];
  }

  // Add currentUserId for watching filter
  filters.currentUserId = user.id;

  // Fetch user role for isAdmin check in buildWhereConditions
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const isAdmin = userProfile?.role === "admin";

  try {
    // 4. Query issues
    const where = buildWhereConditions(filters, db, { isAdmin });
    const orderBy = buildOrderBy(filters.sort);

    const issueRows = await db.query.issues.findMany({
      where: and(...where),
      orderBy,
      with: {
        machine: { columns: { name: true } },
        reportedByUser: { columns: { name: true } },
        invitedReporter: { columns: { name: true } },
        assignedToUser: { columns: { name: true } },
      },
    });

    if (issueRows.length === 0) {
      return err("EMPTY", "No issues match the current filters.");
    }

    // 5. Build CSV rows
    const rows = issueRows.map((issue) => {
      const reporterName =
        issue.reportedByUser?.name ??
        issue.invitedReporter?.name ??
        issue.reporterName ??
        "Anonymous";

      return [
        formatIssueId(issue.machineInitials, issue.issueNumber),
        issue.machine.name,
        issue.title,
        extractFirstParagraph(
          issue.description as ProseMirrorDoc | string | null
        ),
        getIssueStatusLabel(issue.status),
        issue.severity ? getIssueSeverityLabel(issue.severity) : "",
        issue.priority ? getIssuePriorityLabel(issue.priority) : "",
        issue.frequency ? getIssueFrequencyLabel(issue.frequency) : "",
        reporterName,
        issue.assignedToUser?.name ?? "",
        formatDate(issue.createdAt),
        formatDate(issue.updatedAt),
        formatDate(issue.closedAt),
      ];
    });

    // 6. Generate CSV
    const csv = generateCsv(CSV_HEADERS, rows);
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const fileName = machineInitials
      ? `pinpoint-${machineInitials.toUpperCase()}-issues-${dateStr}.csv`
      : `pinpoint-issues-${dateStr}.csv`;

    return ok({ csv, fileName });
  } catch (error) {
    log.error({ error }, "Failed to export issues");
    return err("SERVER", "An error occurred while exporting issues.");
  }
}
```

- [ ] **Step 2: Verify type checking passes**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/issues/export-action.ts
git commit -m "feat(export): add exportIssuesAction server action"
```

---

### Task 5: ExportButton Client Component

**Files:**

- Create: `src/components/issues/ExportButton.tsx`

- [ ] **Step 1: Implement the ExportButton component**

This is a `"use client"` component that calls the server action, creates a Blob download, and shows toasts for feedback.

```tsx
// src/components/issues/ExportButton.tsx
"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { toast } from "sonner";
import { exportIssuesAction } from "~/app/(app)/issues/export-action";
import type { IssueFilters } from "~/lib/issues/filters";

interface ExportButtonProps {
  /** Current filter state — serialized and sent to the server action. */
  filters?: IssueFilters;
  /** Machine initials — for machine-page export (overrides filters). */
  machineInitials?: string;
}

export function ExportButton({
  filters,
  machineInitials,
}: ExportButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const result = await exportIssuesAction({
        filtersJson: filters ? JSON.stringify(filters) : undefined,
        machineInitials,
      });

      if (!result.ok) {
        if (result.code === "EMPTY") {
          toast.info("No issues to export.");
        } else {
          toast.error(result.message);
        }
        return;
      }

      // Trigger browser download via Blob
      const blob = new Blob([result.value.csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.value.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 shadow-sm"
            onClick={handleExport}
            disabled={isExporting}
            aria-label="Export to CSV"
            data-testid="export-csv-button"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export to CSV</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Verify type checking passes**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/issues/ExportButton.tsx
git commit -m "feat(export): add ExportButton client component"
```

---

### Task 6: Add ExportButton to Issues List Page

**Files:**

- Modify: `src/components/issues/IssueList.tsx`

- [ ] **Step 1: Add the ExportButton next to View Options**

In `IssueList.tsx`, the "View Options" button is rendered around line 230-239. Add the `ExportButton` right before it in the same flex container.

The `IssueList` component already has access to `searchParams` and `parseIssueFilters`. The parsed `filters` object needs to be passed to `ExportButton`.

Add the import at the top of the file:

```ts
import { ExportButton } from "~/components/issues/ExportButton";
```

Then find the section with the `View Options` `<DropdownMenu>` (around lines 230-240). It sits inside a flex container that also has pagination. Add the `ExportButton` just before the `<DropdownMenu>`:

```tsx
          <ExportButton filters={filters} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-2.5 font-medium shadow-sm"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                View Options
              </Button>
            </DropdownMenuTrigger>
```

- [ ] **Step 2: Verify type checking passes**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify the page renders correctly**

Run: `pnpm run dev:status` to check if the dev server is running. If it is, visit `/issues` and confirm the export button appears next to View Options.

- [ ] **Step 4: Commit**

```bash
git add src/components/issues/IssueList.tsx
git commit -m "feat(export): add CSV export button to issues list page"
```

---

### Task 7: Add ExportButton to Machine Detail Page

**Files:**

- Modify: `src/app/(app)/m/[initials]/issues-expando.tsx`

The `IssuesExpando` component is a `"use client"` component. Add the `ExportButton` in the `<summary>` header, positioned in the right corner.

- [ ] **Step 1: Add ExportButton to the expando header**

Add the import:

```ts
import { ExportButton } from "~/components/issues/ExportButton";
```

Modify the `<summary>` element to include the button. The button needs to be placed at the end, pushed to the right with `ml-auto`. Importantly, clicking the button inside `<summary>` would toggle the `<details>` element — prevent that with `e.preventDefault()` on the button wrapper.

Replace the `<summary>` block:

```tsx
<summary
  className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-on-surface hover:bg-surface-variant/30"
  data-testid="issues-expando-trigger"
>
  <ChevronRight
    className={cn(
      "size-5 transition-transform duration-200",
      isOpen && "rotate-90"
    )}
  />
  <span className="text-lg font-semibold">Open Issues ({issues.length})</span>
  {totalIssuesCount > issues.length && (
    <span className="text-sm text-on-surface-variant">
      of {totalIssuesCount} total
    </span>
  )}
  <div
    className="ml-auto"
    onClick={(e) => e.stopPropagation()}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") e.stopPropagation();
    }}
  >
    <ExportButton machineInitials={machineInitials} />
  </div>
</summary>
```

Note: The `onClick` stopPropagation on the wrapper `<div>` prevents the `<details>` toggle when clicking the export button.

- [ ] **Step 2: Verify type checking passes**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/m/\[initials\]/issues-expando.tsx
git commit -m "feat(export): add CSV export button to machine detail page"
```

---

### Task 8: Integration Tests

**Files:**

- Create: `src/test/integration/export/export-issues.test.ts`

These tests verify the server action queries data correctly and returns valid CSV. They use the PGlite worker-scoped test database.

- [ ] **Step 1: Write integration tests**

Check which integration test setup pattern the project uses first. Read an existing integration test file:

```bash
head -40 src/test/integration/supabase/issue-services.test.ts
```

Follow the same pattern for DB setup and seeding. The tests should:

1. Seed a few issues with different machines, statuses, and descriptions
2. Call the export action logic (the query + CSV generation, not the full action which needs Supabase auth)
3. Verify the CSV output has the correct headers, row count, and field values

Since the full server action requires Supabase auth (which is hard to mock in integration tests), test the core query + CSV generation logic by extracting a testable function or by testing the building blocks (which are already unit-tested) plus a focused integration test for the DB query.

Create a test that exercises the query path using the integration test database:

```ts
// src/test/integration/export/export-issues.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { getTestDb } from "~/test/integration/db-setup";
import { issues, machines, userProfiles } from "~/server/db/schema";
import {
  buildWhereConditions,
  buildOrderBy,
} from "~/lib/issues/filters-queries";
import type { IssueFilters } from "~/lib/issues/filters";
import { generateCsv } from "~/lib/export/csv";
import { extractFirstParagraph } from "~/lib/tiptap/first-paragraph";
import { formatIssueId } from "~/lib/issues/utils";
import {
  getIssueStatusLabel,
  getIssueSeverityLabel,
} from "~/lib/issues/status";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

describe("Issue CSV Export (integration)", () => {
  // Use the shared worker-scoped PGlite instance
  // Follow the existing integration test setup pattern from the project

  it("exports all issues for a machine", async () => {
    const db = getTestDb();

    // Query issues for a specific machine (use seeded test data)
    const filters: IssueFilters = {
      machine: ["TAF"],
      status: [], // all statuses
    };

    const where = buildWhereConditions(filters, db);
    const orderBy = buildOrderBy(undefined);

    const issueRows = await db.query.issues.findMany({
      where: and(...where),
      orderBy,
      with: {
        machine: { columns: { name: true } },
        reportedByUser: { columns: { name: true } },
        invitedReporter: { columns: { name: true } },
        assignedToUser: { columns: { name: true } },
      },
    });

    expect(issueRows.length).toBeGreaterThan(0);

    // Verify CSV generation doesn't throw
    const rows = issueRows.map((issue) => [
      formatIssueId(issue.machineInitials, issue.issueNumber),
      issue.machine.name,
      issue.title,
      extractFirstParagraph(
        issue.description as ProseMirrorDoc | string | null
      ),
      getIssueStatusLabel(issue.status),
      issue.severity ? getIssueSeverityLabel(issue.severity) : "",
    ]);

    const csv = generateCsv(
      ["Issue ID", "Machine", "Title", "Description", "Status", "Severity"],
      rows
    );

    expect(csv).toContain("Issue ID,Machine,Title");
    expect(csv).toContain("TAF-");
  });
});
```

**Important:** Adapt this test to match the exact integration test setup pattern used in the project. Read `src/test/integration/db-setup` or the existing integration test files to understand how the test DB is initialized and seeded.

- [ ] **Step 2: Run integration tests**

Run: `pnpm exec vitest run src/test/integration/export/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/test/integration/export/export-issues.test.ts
git commit -m "test(export): add integration tests for CSV export query"
```

---

### Task 9: E2E Tests

**Files:**

- Modify: `e2e/smoke/issue-list.spec.ts`
- Modify: `e2e/smoke/machine-details-redesign.spec.ts`

- [ ] **Step 1: Add export E2E test to issue list spec**

Add a new test to `e2e/smoke/issue-list.spec.ts`:

```ts
test("should export issues to CSV", async ({ page }) => {
  await page.goto("/issues");

  // Wait for issue list to load
  await expect(page.getByText(/Showing \d+ of \d+ issues/)).toBeVisible();

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent("download");

  // Click the export button
  await page.getByTestId("export-csv-button").click();

  // Verify download was triggered
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^pinpoint-issues-\d{4}-\d{2}-\d{2}\.csv$/
  );
});
```

- [ ] **Step 2: Add export E2E test to machine details spec**

Add a new test to `e2e/smoke/machine-details-redesign.spec.ts`:

```ts
test("should export machine issues to CSV", async ({ page }) => {
  // Navigate to a machine with issues
  await page.goto(`/m/${seededMachines.taf.initials}`);

  // Wait for page to load
  await expect(
    page.getByRole("heading", { name: "Machine Information" })
  ).toBeVisible();

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent("download");

  // Click the export button (it's in the issues expando header)
  await page.getByTestId("export-csv-button").click();

  // Verify download was triggered
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^pinpoint-TAF-issues-\d{4}-\d{2}-\d{2}\.csv$/
  );
});
```

**Important:** Check `e2e/support/constants.ts` for the exact seeded machine keys (e.g., `seededMachines.taf` or similar) and use the correct reference.

- [ ] **Step 3: Run the E2E tests**

Run: `pnpm exec playwright test e2e/smoke/issue-list.spec.ts e2e/smoke/machine-details-redesign.spec.ts --project=chromium`
Expected: All tests PASS, including the new export tests

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/issue-list.spec.ts e2e/smoke/machine-details-redesign.spec.ts
git commit -m "test(export): add E2E tests for CSV export buttons"
```

---

### Task 10: Run Preflight and Final Verification

- [ ] **Step 1: Run preflight checks**

Run: `pnpm run preflight`
Expected: All checks pass (types, lint, format, unit tests, build, integration)

- [ ] **Step 2: Fix any issues found by preflight**

If lint, type, or format issues are found, fix them and re-run preflight.

- [ ] **Step 3: Final commit if needed**

If preflight required fixes:

```bash
git add -u
git commit -m "fix: address preflight issues in export feature"
```
