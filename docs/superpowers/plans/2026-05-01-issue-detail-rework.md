# Issue Detail Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the issue detail page's divergent desktop sidebar / mobile metadata strip with a single inline `IssueMetadata` component (labeled rows that reflow from 1-column to 2-column via container query) and add a mobile-only sticky comment composer that opens a Sheet.

**Architecture:** Two PR slices land sequentially. **Slice 1** widens `PageHeader.title` from `string` to `React.ReactNode` so editable JSX titles can replace the static h1 (3-line type/render change). **Slice 2** introduces the new components, restructures `page.tsx`, deletes `IssueSidebar.tsx`, and consolidates `OwnerRequirementsCallout` placement into `IssueTimeline`. Slice 2 depends on Slice 1's typing change.

**Tech Stack:** Next.js 16 App Router (Server Components default), React 19 (`useActionState`, async params), Tailwind CSS v4 with container queries (`@container`, `@xl:`), shadcn/ui primitives (`Sheet`, `Dialog`), Vitest + React Testing Library for unit tests, Playwright (Chromium project) for E2E, Drizzle ORM types, `IssueWithAllRelations` from `~/lib/types`.

**Spec:** [`docs/superpowers/specs/2026-05-01-issue-detail-rework-design.md`](../specs/2026-05-01-issue-detail-rework-design.md)

**Mockups:** [`docs/superpowers/mockups/2026-05-01-issue-detail-rework/`](../mockups/2026-05-01-issue-detail-rework/) — see `d2-final.html` for the structural reference

---

## File Structure

### Phase 1 — PageHeader Widening (Slice 1 PR)

| Action | Path                                        | Responsibility                                                                                              |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Modify | `src/components/layout/PageHeader.tsx`      | Widen `title` prop to `React.ReactNode`; conditional render (string → auto-h1, ReactNode → render directly) |
| Create | `src/components/layout/PageHeader.test.tsx` | Unit tests for both rendering modes                                                                         |

### Phase 2 — Issue Detail Rework (Slice 2 PR — depends on Phase 1 merged to main)

| Action | Path                                                                | Responsibility                                                                                                                                                       |
| ------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `src/components/issues/IssueMetadata.tsx`                           | Labeled vertical rows (Status, Priority, Severity, Frequency, Assignee). Container query: 1-col below `@xl:` (576px), 2-col + Assignee-spans-both above              |
| Create | `src/components/issues/IssueMetadata.test.tsx`                      | Unit tests: all 5 rows render, classes for layout/spans, prop pass-through                                                                                           |
| Create | `src/components/issues/StickyCommentComposer.tsx`                   | Mobile-only fixed-bottom bar that opens `AddCommentForm` in a `Sheet`. Hidden when unauthenticated                                                                   |
| Create | `src/components/issues/StickyCommentComposer.test.tsx`              | Unit tests: visibility rules, sheet open/close, signed-in only                                                                                                       |
| Modify | `src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx`               | Replace dual breadcrumbs + mobile metadata strip + sidebar grid with eyebrow + widened PageHeader + subtitle + IssueMetadata + IssueTimeline + StickyCommentComposer |
| Modify | `src/components/issues/IssueTimeline.tsx`                           | Remove `hidden @xl:block` gating on `OwnerRequirementsCallout` (keep `@xl:ml-20` for visual alignment with avatar track)                                             |
| Delete | `src/components/issues/IssueSidebar.tsx`                            | Functionality moved into `IssueMetadata` (5 fields) and page subtitle row (reporter, date, watchers, watch button)                                                   |
| Modify | `src/test/unit/components/issues/issue-detail-permissions.test.tsx` | Update test selectors that target `IssueSidebar` to target `IssueMetadata` instead                                                                                   |
| Modify | `e2e/full/issues-crud.spec.ts`                                      | Update selectors targeting `mobile-nav-row`, `issue-badge-strip`, `issue-sidebar` test IDs                                                                           |
| Create | `e2e/full/issue-detail-sticky-composer.spec.ts`                     | Focused E2E: mobile signed-in shows sticky bar + opens sheet; mobile signed-out hides it; desktop never shows it                                                     |
| Modify | `.agent/skills/pinpoint-design-bible/SKILL.md`                      | Add "Detail Page with Inline Metadata" archetype to §5                                                                                                               |

---

## Phase 1: PageHeader Widening (Slice 1 PR)

This phase produces a small standalone PR. The change is a single type widening + conditional rendering. Branch off `main` (NOT off the feature branch), open a focused PR.

### Task 1: Widen PageHeader.title to accept React.ReactNode

**Files:**

- Modify: `src/components/layout/PageHeader.tsx`
- Test: `src/components/layout/PageHeader.test.tsx` (new)

**Branch setup:**

- [ ] **Step 1: Create the Slice 1 branch from origin/main**

```bash
git fetch origin
git checkout -b chore/page-header-react-node-title-PP-yxw.9 origin/main
git push -u origin chore/page-header-react-node-title-PP-yxw.9
```

Verify: `git branch -vv` shows `[origin/chore/page-header-react-node-title-PP-yxw.9]`.

- [ ] **Step 2: Write the failing test for ReactNode title rendering**

Create `src/components/layout/PageHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("auto-wraps a string title in an h1 with typography classes", () => {
    render(<PageHeader title="My Page" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("My Page");
    expect(h1).toHaveClass("text-balance");
    expect(h1).toHaveClass("text-3xl");
    expect(h1).toHaveClass("font-bold");
    expect(h1).toHaveClass("tracking-tight");
  });

  it("renders a ReactNode title directly without auto-wrapping", () => {
    render(
      <PageHeader
        title={
          <h1
            data-testid="custom-h1"
            className="text-balance text-3xl font-bold tracking-tight"
          >
            Custom Title
          </h1>
        }
      />
    );
    expect(screen.getByTestId("custom-h1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Custom Title"
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders titleAdornment alongside a string title", () => {
    render(
      <PageHeader
        title="My Page"
        titleAdornment={<span data-testid="adornment">Badge</span>}
      />
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "My Page"
    );
    expect(screen.getByTestId("adornment")).toBeInTheDocument();
  });

  it("renders actions in a flex container when provided", () => {
    render(
      <PageHeader
        title="My Page"
        actions={<button data-testid="action">Action</button>}
      />
    );
    expect(screen.getByTestId("action")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the new test file — expect compile error**

Run: `pnpm exec vitest run src/components/layout/PageHeader.test.tsx`

Expected: TypeScript error on the second test because `title: string` rejects a JSX element. The test won't even compile until we widen the type.

- [ ] **Step 4: Widen the title prop type and conditional-render in PageHeader.tsx**

Replace the contents of `src/components/layout/PageHeader.tsx` with:

```tsx
import type React from "react";
import { cn } from "~/lib/utils";

interface PageHeaderProps {
  /**
   * Title content. Pass a string for the default `<h1 className="text-balance text-3xl font-bold tracking-tight">` treatment,
   * or a React node for full control (e.g., to embed an editable title component). When passing a node, the consumer is
   * responsible for the heading element and matching typography.
   */
  title: React.ReactNode;
  titleAdornment?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  titleAdornment,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn("border-b border-outline-variant pb-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {typeof title === "string" ? (
            <h1 className="text-balance text-3xl font-bold tracking-tight">
              {title}
            </h1>
          ) : (
            title
          )}
          {titleAdornment}
        </div>
        {actions != null && (
          <div className="flex items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test file — expect all tests pass**

Run: `pnpm exec vitest run src/components/layout/PageHeader.test.tsx`

Expected: 4 tests pass. If any fail, fix and re-run before continuing.

- [ ] **Step 6: Run typecheck across the project to ensure no consumer broke**

Run: `pnpm run typecheck`

Expected: clean exit. Existing call sites all pass strings; `string` is still assignable to `React.ReactNode`, so they continue to typecheck without changes.

- [ ] **Step 7: Run the full check suite**

Run: `pnpm run check`

Expected: clean exit (types, lint, format, unit tests, yamllint, actionlint, ruff, shellcheck — all pass).

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/PageHeader.tsx src/components/layout/PageHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat(page-header): accept React.ReactNode for title (PP-yxw.9)

Widens PageHeader.title from string to React.ReactNode so consumers
that need an editable or composed title (e.g., issue detail with
EditableIssueTitle) can supply their own h1. String callers are
unchanged — auto-wrap behavior is preserved via typeof check.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2: Open Slice 1 PR

**Files:** none (PR creation only)

- [ ] **Step 1: Push the branch**

```bash
git push
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(page-header): accept React.ReactNode for title (PP-yxw.9)" --body "$(cat <<'EOF'
## Summary
- Widen `PageHeader.title` from `string` to `React.ReactNode`
- Render conditionally: string → auto-h1 with existing typography classes; ReactNode → rendered directly (consumer brings own heading)
- Backward compatible — every existing call site passes a string and continues to typecheck without changes

## Why
Slice 1 of the issue detail rework ([PP-yxw.9](https://github.com/timothyfroehlich/PinPoint/tree/feat/issue-detail-rework-PP-yxw.9)). Issue detail's `EditableIssueTitle` is JSX, not a string — without this widening, that page can't use `PageHeader` and ends up hand-rolling header chrome.

## Test plan
- [x] Unit tests cover string-mode auto-wrap and ReactNode-mode pass-through
- [x] `pnpm run check` passes (types, lint, format, unit tests)
- [ ] No regressions in other PageHeader call sites (admin, list, machine, location pages render unchanged)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI Gate to pass, then ask user to merge**

Run: `./scripts/workflow/pr-watch.py <PR-number>`

Once CI Gate is green, present the merge command to the user (do NOT run it):

```
gh pr merge --squash <PR-number>
```

Slice 1 is complete when the user merges this PR. **Slice 2 must wait until that merge lands.**

---

## Phase 2: Issue Detail Rework (Slice 2 PR)

**Prerequisite:** Phase 1 (Slice 1) must be merged to `origin/main`. The feature branch `feat/issue-detail-rework-PP-yxw.9` already exists; merge `origin/main` into it before starting Phase 2 to pick up Slice 1.

### Task 3: Sync feature branch with main

**Files:** none (git only)

- [ ] **Step 1: Switch back to the feature branch**

```bash
git checkout feat/issue-detail-rework-PP-yxw.9
```

- [ ] **Step 2: Fetch and merge origin/main (Slice 1 should now be on main)**

```bash
git fetch origin
git merge origin/main
```

Expected: Slice 1's commit appears in the log. If `drizzle/meta` conflicts, follow AGENTS.md §"Migration Conflict Resolution" protocol — never manually edit `drizzle/meta`.

- [ ] **Step 3: Verify PageHeader supports ReactNode**

Run: `git log --oneline origin/main | head -3`

Expected: see the Slice 1 commit (`feat(page-header): accept React.ReactNode for title`).

- [ ] **Step 4: Push the merged feature branch**

```bash
git push
```

### Task 4: Add new archetype to design bible

**Files:**

- Modify: `.agent/skills/pinpoint-design-bible/SKILL.md` (§5 Page Archetypes)

- [ ] **Step 1: Add the archetype entry to §5**

Open `.agent/skills/pinpoint-design-bible/SKILL.md`. Locate the line `### Detail Page with Sidebar (issue detail)` in §5 (around line 147-149). Replace its description, and add the new archetype after it:

```markdown
### Detail Page with Sidebar (machine detail)

`grid md:grid-cols-[minmax(0,1fr)_320px]` -- Sidebar `hidden md:block`, collapses to inline strips on mobile.
**Note:** Issue detail migrated off this archetype (see "Detail Page with Inline Metadata" below). Machine and Location detail still use this pattern.

### Detail Page with Inline Metadata (issue detail)

`max-w-6xl` single-column main flow. Page-level metadata renders inline in the main column above content rather than in a desktop sidebar. Use `IssueMetadata` (or equivalent) which uses container queries (`@container` + `@xl:`) to reflow from 1-column rows to 2-column grid based on the metadata block's available width — not the viewport width. Mobile uses a sticky bottom comment composer that opens a `Sheet`.

This archetype eliminates the desktop/mobile divergence inherent in "Detail Page with Sidebar." Use it for new detail pages, and migrate existing sidebar-based detail pages opportunistically.
```

- [ ] **Step 2: Verify the file still parses**

Run: `pnpm exec prettier --check .agent/skills/pinpoint-design-bible/SKILL.md`

Expected: clean. If prettier reflows tables, run `pnpm exec prettier --write` and re-check.

- [ ] **Step 3: Commit the design bible update**

```bash
git add .agent/skills/pinpoint-design-bible/SKILL.md
git commit -m "$(cat <<'EOF'
docs(design-bible): add Detail Page with Inline Metadata archetype (PP-yxw.9)

Documents the new single-column-with-container-query archetype that
issue detail adopts in this rework. Sidebar archetype still applies
to machine and location detail until migrated separately.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Create IssueMetadata component (with TDD)

**Files:**

- Create: `src/components/issues/IssueMetadata.tsx`
- Test: `src/components/issues/IssueMetadata.test.tsx`

- [ ] **Step 1: Write the failing test for the 5-row structure**

Create `src/components/issues/IssueMetadata.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IssueMetadata } from "./IssueMetadata";
import { type IssueWithAllRelations } from "~/lib/types";

const fixtureIssue = {
  id: "issue-1",
  title: "Flippers stuck",
  status: "in_progress",
  priority: "high",
  severity: "major",
  frequency: "frequent",
  assignedTo: "user-1",
  reportedBy: "user-1",
  invitedReportedBy: null,
  reporterName: null,
  reporterEmail: null,
  machineInitials: "PIN",
  issueNumber: 101,
  createdAt: new Date("2026-04-25"),
  updatedAt: new Date("2026-04-25"),
  closedAt: null,
  description: null,
  machine: {
    id: "machine-1",
    name: "Iron Maiden",
    initials: "PIN",
    ownerRequirements: null,
    owner: null,
    invitedOwner: null,
  },
  reportedByUser: { id: "user-1", name: "Tim F." },
  invitedReporter: null,
  comments: [],
  images: [],
  watchers: [],
} as unknown as IssueWithAllRelations;

const fixtureUsers = [{ id: "user-1", name: "Tim F." }];
const fixtureOwnership = {
  userId: "user-1",
  reporterId: "user-1",
  machineOwnerId: null,
};

describe("IssueMetadata", () => {
  it("renders all 5 metadata row labels", () => {
    render(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByText("Frequency")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
  });

  it("wraps the metadata grid in an @container element", () => {
    const { container } = render(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    const wrapper = container.querySelector(".\\@container");
    expect(wrapper).not.toBeNull();
  });

  it("applies @xl:col-span-2 to the Assignee row so it spans both columns at @xl: width", () => {
    render(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    const assigneeRow = screen.getByTestId("issue-metadata-row-assignee");
    expect(assigneeRow).toHaveClass("@xl:col-span-2");
  });

  it("applies @xl:grid-cols-2 to the inner grid for 2-column reflow", () => {
    render(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    const grid = screen.getByTestId("issue-metadata-grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("@xl:grid-cols-2");
  });

  it("applies @xl:border-l to even-numbered rows for visual column separation at @xl:", () => {
    render(
      <IssueMetadata
        issue={fixtureIssue}
        allUsers={fixtureUsers}
        currentUserId="user-1"
        accessLevel="member"
        ownershipContext={fixtureOwnership}
      />
    );
    expect(screen.getByTestId("issue-metadata-row-priority")).toHaveClass(
      "@xl:border-l"
    );
    expect(screen.getByTestId("issue-metadata-row-frequency")).toHaveClass(
      "@xl:border-l"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (component doesn't exist yet)**

Run: `pnpm exec vitest run src/components/issues/IssueMetadata.test.tsx`

Expected: FAIL with "Cannot find module './IssueMetadata'".

- [ ] **Step 3: Create the IssueMetadata component**

Create `src/components/issues/IssueMetadata.tsx`:

```tsx
import type React from "react";
import { type IssueWithAllRelations } from "~/lib/types";
import { AssignIssueForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/assign-issue-form";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { UpdateIssueSeverityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-severity-form";
import { UpdateIssuePriorityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form";
import { UpdateIssueFrequencyForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-frequency-form";
import { type OwnershipContext } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { cn } from "~/lib/utils";

interface IssueMetadataUser {
  id: string;
  name: string;
}

interface IssueMetadataProps {
  issue: IssueWithAllRelations;
  allUsers: IssueMetadataUser[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

export function IssueMetadata({
  issue,
  allUsers,
  currentUserId,
  accessLevel,
  ownershipContext,
}: IssueMetadataProps): React.JSX.Element {
  return (
    <div className="@container">
      <div
        data-testid="issue-metadata-grid"
        className="grid grid-cols-1 @xl:grid-cols-2 rounded-lg border border-outline-variant bg-card overflow-hidden"
      >
        <Row label="Status" testId="issue-metadata-row-status">
          <UpdateIssueStatusForm
            issueId={issue.id}
            currentStatus={issue.status}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row
          label="Priority"
          testId="issue-metadata-row-priority"
          leftBorderAtXl
        >
          <UpdateIssuePriorityForm
            issueId={issue.id}
            currentPriority={issue.priority}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row label="Severity" testId="issue-metadata-row-severity">
          <UpdateIssueSeverityForm
            issueId={issue.id}
            currentSeverity={issue.severity}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row
          label="Frequency"
          testId="issue-metadata-row-frequency"
          leftBorderAtXl
        >
          <UpdateIssueFrequencyForm
            issueId={issue.id}
            currentFrequency={issue.frequency}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
        <Row label="Assignee" testId="issue-metadata-row-assignee" spanBothAtXl>
          <AssignIssueForm
            issueId={issue.id}
            assignedToId={issue.assignedTo ?? null}
            users={allUsers}
            currentUserId={currentUserId}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </Row>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  testId: string;
  children: React.ReactNode;
  leftBorderAtXl?: boolean;
  spanBothAtXl?: boolean;
}

function Row({
  label,
  testId,
  children,
  leftBorderAtXl,
  spanBothAtXl,
}: RowProps): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      className={cn(
        "grid grid-cols-[90px_1fr] items-center gap-3 px-4 py-2.5 min-h-[44px]",
        "border-b border-outline-variant/40 last:border-b-0",
        leftBorderAtXl && "@xl:border-l @xl:border-outline-variant/40",
        spanBothAtXl && "@xl:col-span-2"
      )}
    >
      <span className="text-xs uppercase tracking-wide text-muted-foreground font-bold">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/issues/IssueMetadata.test.tsx`

Expected: 5 tests pass.

- [ ] **Step 5: Run typecheck**

Run: `pnpm run typecheck`

Expected: clean. The `Update*Form` and `AssignIssueForm` components must accept the prop shape we're passing — verify the imports resolve.

- [ ] **Step 6: Commit**

```bash
git add src/components/issues/IssueMetadata.tsx src/components/issues/IssueMetadata.test.tsx
git commit -m "$(cat <<'EOF'
feat(issues): add IssueMetadata component (PP-yxw.9)

New labeled-rows component that replaces IssueSidebar (desktop) and
the bespoke mobile metadata strip. Five rows (status, priority,
severity, frequency, assignee) with container-query 2-column reflow
at @xl: container width and an Assignee row that spans both columns
in 2-col mode. Each row consumes the existing Update*Form components,
preserving permission gating.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: Create StickyCommentComposer component (with TDD)

**Files:**

- Create: `src/components/issues/StickyCommentComposer.tsx`
- Test: `src/components/issues/StickyCommentComposer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/issues/StickyCommentComposer.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StickyCommentComposer } from "./StickyCommentComposer";

describe("StickyCommentComposer", () => {
  it("renders the trigger as a fixed-position bar", () => {
    render(<StickyCommentComposer issueId="issue-1" />);
    const trigger = screen.getByRole("button", { name: /add a comment/i });
    expect(trigger).toBeInTheDocument();
  });

  it("the wrapper is hidden at md: viewport (md:hidden)", () => {
    const { container } = render(<StickyCommentComposer issueId="issue-1" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("md:hidden");
  });

  it("the wrapper is fixed to the bottom of the viewport above the BottomTabBar", () => {
    const { container } = render(<StickyCommentComposer issueId="issue-1" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("fixed");
    // Bottom positioning leaves room for the 56px tab bar + safe-area inset
    expect(wrapper.className).toMatch(
      /bottom-\[calc\(56px\+env\(safe-area-inset-bottom\)\)\]/
    );
  });

  it("opens a Sheet when the trigger is clicked", async () => {
    render(<StickyCommentComposer issueId="issue-1" />);
    const trigger = screen.getByRole("button", { name: /add a comment/i });
    fireEvent.click(trigger);
    // Sheet content should appear (Radix Dialog primitive)
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/issues/StickyCommentComposer.test.tsx`

Expected: FAIL with "Cannot find module './StickyCommentComposer'".

- [ ] **Step 3: Create the StickyCommentComposer component**

Create `src/components/issues/StickyCommentComposer.tsx`:

```tsx
"use client";

import type React from "react";
import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { AddCommentForm } from "~/components/issues/AddCommentForm";

interface StickyCommentComposerProps {
  issueId: string;
}

/**
 * Mobile-only fixed-bottom bar that opens AddCommentForm in a Sheet.
 *
 * - Visible only below `md:` viewport (md:hidden)
 * - Positioned above the BottomTabBar (z-30 < tabbar's z-50; bottom offset clears the 56px tab bar + safe-area)
 * - Caller is responsible for gating on auth status (do not render when unauthenticated)
 */
export function StickyCommentComposer({
  issueId,
}: StickyCommentComposerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-30 border-t border-outline-variant bg-card/95 backdrop-blur-sm px-3 py-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-full border border-outline-variant bg-background px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/40"
          aria-label="Add a comment"
        >
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          <span>Add a comment…</span>
        </button>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add a comment</SheetTitle>
            <SheetDescription>
              Comment on this issue. Mentions and image attachments are
              supported.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <AddCommentForm issueId={issueId} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/issues/StickyCommentComposer.test.tsx`

Expected: 4 tests pass. Note: the `findByRole("dialog")` test relies on Radix mounting the sheet content; if jsdom struggles with the portal, the test may need to match by role differently. If that happens, adjust to query for `screen.findByText("Add a comment")` (the SheetTitle) instead.

- [ ] **Step 5: Run typecheck**

Run: `pnpm run typecheck`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/issues/StickyCommentComposer.tsx src/components/issues/StickyCommentComposer.test.tsx
git commit -m "$(cat <<'EOF'
feat(issues): add StickyCommentComposer for mobile (PP-yxw.9)

Mobile-only fixed-bottom bar (md:hidden) that opens AddCommentForm
in a bottom Sheet. Positioned above the BottomTabBar. Caller is
responsible for gating on auth status (signed-in only); the component
itself doesn't read auth state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: Remove @xl: gating on OwnerRequirementsCallout in IssueTimeline

**Files:**

- Modify: `src/components/issues/IssueTimeline.tsx` (around line 473-480)

- [ ] **Step 1: Locate the gated callout block**

Open `src/components/issues/IssueTimeline.tsx` and find the block that renders `OwnerRequirementsCallout`:

```tsx
{
  index === 0 && ownerRequirements && machineName && (
    <div className="hidden @xl:ml-20 @xl:block">
      <OwnerRequirementsCallout
        ownerRequirements={ownerRequirements}
        machineName={machineName}
      />
    </div>
  );
}
```

- [ ] **Step 2: Remove the `hidden` and `@xl:block` classes (keep `@xl:ml-20` for alignment)**

Replace with:

```tsx
{
  index === 0 && ownerRequirements && machineName && (
    <div className="@xl:ml-20">
      <OwnerRequirementsCallout
        ownerRequirements={ownerRequirements}
        machineName={machineName}
      />
    </div>
  );
}
```

The callout is now visible at every container width. The `@xl:ml-20` margin still applies only when the avatar track is visible, so the callout aligns with the content column on wide containers and runs full-width on narrow ones.

- [ ] **Step 3: Run the IssueTimeline-related tests**

Run: `pnpm exec vitest run src/components/issues`

Expected: all existing tests still pass. (No tests directly target the `@xl:` gating, so this should be a no-op for the test suite.)

- [ ] **Step 4: Commit**

```bash
git add src/components/issues/IssueTimeline.tsx
git commit -m "$(cat <<'EOF'
fix(issues): remove @xl: gating on OwnerRequirementsCallout (PP-yxw.9)

The callout was hidden below @xl: container width and re-rendered in
the page chrome on mobile, producing a dual-render. With the new
inline-metadata layout, the callout has a single canonical location
inside the timeline at every viewport. Margin alignment via @xl:ml-20
is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 8: Restructure page.tsx

**Files:**

- Modify: `src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx`

This is the largest task. Replace the page's body with the new structure: `PageContainer` → eyebrow → widened `PageHeader` (with `EditableIssueTitle` as the title node) → subtitle → `IssueMetadata` → `IssueTimeline` (and the page renders `StickyCommentComposer` at the end, conditionally).

- [ ] **Step 1: Read the current page to understand the imports and data flow**

Run: `cat src/app/(app)/m/\[initials\]/i/\[issueNumber\]/page.tsx | head -50`

Verify the data fetching (the `Promise.all` with `db.query.issues.findFirst` etc.) is exactly as described in the spec — that block does not change. We're only restructuring the JSX.

- [ ] **Step 2: Replace the JSX body of the page**

Open `src/app/(app)/m/[initials]/i/[issueNumber]/page.tsx`. Replace everything from the `return (` line to the matching `);` with the new structure. The data fetching and prep before the return stays unchanged.

```tsx
return (
  <>
    <PageContainer size="standard">
      <div className="space-y-2">
        <BackToIssuesLink href={issuesPath} />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex rounded-full border border-outline-variant bg-muted/40 px-2.5 py-0.5 font-mono text-xs font-bold">
            {formatIssueId(initials, issue.issueNumber)}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <Link
            href={`/m/${initials}`}
            data-testid="machine-link"
            className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
          >
            {issue.machine.name}
          </Link>
          {ownerName ? (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>Game Owner:</span>
              {issue.machine.owner?.id ? (
                <Link
                  href={`/issues?owner=${issue.machine.owner.id}`}
                  className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                >
                  {ownerName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{ownerName}</span>
              )}
            </>
          ) : null}
        </div>
      </div>

      <PageHeader
        title={
          <EditableIssueTitle
            issueId={issue.id}
            title={issue.title}
            canEdit={userCanEditTitle}
            className="text-balance text-3xl font-bold tracking-tight"
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Reported by{" "}
          <span className="font-medium text-foreground">{reporter.name}</span>
        </span>
        {isUserMachineOwner(issueWithRelations, reporter.id) && (
          <OwnerBadge size="sm" />
        )}
        <span className="text-muted-foreground/50">·</span>
        <span>{formatDate(issue.createdAt)}</span>
        <span className="text-muted-foreground/50">·</span>
        <span>{issue.watchers.length} watching</span>
        {accessLevel !== "unauthenticated" && (
          <WatchButton
            issueId={issue.id}
            initialIsWatching={isWatching}
            className="ml-1 h-7 rounded-full px-3 py-0 text-xs"
          />
        )}
      </div>

      <IssueMetadata
        issue={issueWithRelations}
        allUsers={allUsers}
        currentUserId={user?.id ?? null}
        accessLevel={accessLevel}
        ownershipContext={ownershipContext}
      />

      <section className="@container">
        <IssueTimeline
          issue={issueWithRelations}
          currentUserId={user?.id ?? null}
          currentUserRole={accessLevel}
          currentUserInitials={
            currentUserProfile?.name.slice(0, 2).toUpperCase() ?? "??"
          }
          ownerRequirements={ownerRequirements}
          machineName={issue.machine.name}
        />
      </section>
    </PageContainer>

    {accessLevel !== "unauthenticated" && (
      <StickyCommentComposer issueId={issue.id} />
    )}
  </>
);
```

- [ ] **Step 3: Update the imports at the top of the file**

Replace the existing import block with:

```tsx
import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { eq, asc, and, notInArray } from "drizzle-orm";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueMetadata } from "~/components/issues/IssueMetadata";
import { StickyCommentComposer } from "~/components/issues/StickyCommentComposer";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { WatchButton } from "~/components/issues/WatchButton";
import {
  getMachineOwnerId,
  getMachineOwnerName,
  isUserMachineOwner,
} from "~/lib/issues/owner";
import { formatIssueId, resolveIssueReporter } from "~/lib/issues/utils";
import type { IssueWithAllRelations } from "~/lib/types";
import { BackToIssuesLink } from "~/components/issues/BackToIssuesLink";
import { getLastIssuesPath } from "~/lib/cookies/preferences";
import { EditableIssueTitle } from "./editable-issue-title";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { formatDate } from "~/lib/dates";
import {
  type OwnershipContext,
  checkPermission,
  getAccessLevel,
} from "~/lib/permissions/helpers";
```

Note: removes `IssueSidebar` and `SidebarActions` imports (no longer used directly). Adds `IssueMetadata`, `StickyCommentComposer`, `PageContainer`, `PageHeader`, `formatDate`, `isUserMachineOwner`, `resolveIssueReporter`, `OwnerBadge`. Removes `OwnerRequirementsCallout` (now rendered inside `IssueTimeline`).

- [ ] **Step 4: Add `const reporter = resolveIssueReporter(issueWithRelations);` to the data prep section**

Below the existing line `const ownerName = getMachineOwnerName(issueWithRelations);`, add:

```tsx
const reporter = resolveIssueReporter(issueWithRelations);
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm run typecheck`

Expected: clean. If errors arise around `WatchButton`'s `className` prop, verify the existing prop shape — it should accept a `className` override.

- [ ] **Step 6: Run lint**

Run: `pnpm run lint`

Expected: clean. Some unused imports may flag — remove them per the lint output.

- [ ] **Step 7: Run the responsive overflow smoke test**

Run: `pnpm exec playwright test e2e/smoke/responsive-overflow.spec.ts --project=chromium`

Expected: all tested routes pass `assertNoHorizontalOverflow()` at mobile (375px) and desktop (1024px) viewports, including issue detail.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/m/\[initials\]/i/\[issueNumber\]/page.tsx
git commit -m "$(cat <<'EOF'
refactor(issues): restructure detail page using IssueMetadata + sticky composer (PP-yxw.9)

Removes the desktop sidebar grid (md:grid-cols-[1fr_320px]), the
mobile-only metadata strip (border-y py-2), and the dual breadcrumb
implementations. Replaces them with PageContainer + eyebrow row +
widened PageHeader (using EditableIssueTitle as the title node) +
subtitle row + IssueMetadata + IssueTimeline. Mobile signed-in users
get a sticky bottom composer.

OwnerRequirementsCallout is no longer rendered here — it lives inside
IssueTimeline at every viewport now.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 9: Delete IssueSidebar and update tests

**Files:**

- Delete: `src/components/issues/IssueSidebar.tsx`
- Modify: `src/test/unit/components/issues/issue-detail-permissions.test.tsx` (replace IssueSidebar references)
- Modify: `src/test/integration/issue-detail-permissions.test.ts` (verify still relevant)

- [ ] **Step 1: Confirm IssueSidebar is unused**

Run: `rg -l "IssueSidebar" src/`

Expected: only `src/components/issues/IssueSidebar.tsx` itself appears (and possibly its test file). If any other file references it, that's a missed migration — fix before deleting.

- [ ] **Step 2: Delete IssueSidebar.tsx**

```bash
git rm src/components/issues/IssueSidebar.tsx
```

- [ ] **Step 3: Find and update test references**

Run: `rg -l "IssueSidebar|issue-sidebar" src/test e2e`

For each match, update to use `IssueMetadata` (component name) or `issue-metadata-grid` (data-testid) instead. Common updates:

- `screen.getByTestId("issue-sidebar")` → `screen.getByTestId("issue-metadata-grid")`
- `import { IssueSidebar } from ...` → `import { IssueMetadata } from "~/components/issues/IssueMetadata"`

- [ ] **Step 4: Update `src/test/unit/components/issues/issue-detail-permissions.test.tsx`**

If this file exercises `IssueSidebar` directly, replace its render call:

```tsx
// Before
import { IssueSidebar } from "~/components/issues/IssueSidebar";
render(<IssueSidebar issue={...} ... />);

// After
import { IssueMetadata } from "~/components/issues/IssueMetadata";
render(<IssueMetadata issue={...} ... />);
```

The props are nearly identical; the integration tests already cover the permission gating logic via the underlying `Update*Form` components.

- [ ] **Step 5: Update `e2e/full/issues-crud.spec.ts`**

Run: `rg -n "mobile-nav-row|issue-badge-strip|issue-sidebar" e2e/`

For each test ID match, update:

- `mobile-nav-row` is gone (the mobile-only breadcrumb row was removed) — remove tests that depend on this distinction; rely on the unified breadcrumb that exists at every viewport
- `issue-badge-strip` is gone (the mobile bespoke strip was removed) — replace with `issue-metadata-grid`
- `issue-sidebar` is gone — replace with `issue-metadata-grid`

- [ ] **Step 6: Run the full check suite**

Run: `pnpm run check`

Expected: types, lint, format, unit tests all pass.

- [ ] **Step 7: Commit**

```bash
git add src/test/ e2e/
git commit -m "$(cat <<'EOF'
refactor(issues): delete IssueSidebar and update tests for IssueMetadata (PP-yxw.9)

IssueSidebar is removed; its functionality moved into IssueMetadata
(5 editable fields) and the page subtitle row (reporter, date,
watchers, watch button). Test selectors updated from issue-sidebar /
mobile-nav-row / issue-badge-strip to issue-metadata-grid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 10: Add E2E coverage for sticky composer

**Files:**

- Create: `e2e/full/issue-detail-sticky-composer.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `e2e/full/issue-detail-sticky-composer.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signInAsMember } from "~/test/e2e/auth-helpers";
import { seedIssue } from "~/test/e2e/seed-helpers";

// Sticky composer is mobile-only and signed-in only.
// We use Mobile Chrome for mobile tests and standard Chromium desktop for the negation.

test.describe("StickyCommentComposer — mobile signed-in", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("renders the sticky bar and opens the comment sheet on tap", async ({
    page,
    request,
  }) => {
    const issue = await seedIssue(request, { title: "Test sticky composer" });
    await signInAsMember(page);
    await page.goto(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);

    const trigger = page.getByRole("button", { name: /add a comment/i });
    await expect(trigger).toBeVisible();

    await trigger.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Add a comment")).toBeVisible();
  });
});

test.describe("StickyCommentComposer — mobile signed-out", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("does not render the sticky bar when the user is not signed in", async ({
    page,
    request,
  }) => {
    const issue = await seedIssue(request, {
      title: "Test sticky composer (signed-out)",
    });
    await page.goto(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);

    const trigger = page.getByRole("button", { name: /add a comment/i });
    await expect(trigger).not.toBeVisible();

    // The inline "Log in to comment" placeholder in IssueTimeline is the canonical CTA
    await expect(page.getByText(/log in to comment/i)).toBeVisible();
  });
});

test.describe("StickyCommentComposer — desktop never renders", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("does not render at desktop viewport even when signed in", async ({
    page,
    request,
  }) => {
    const issue = await seedIssue(request, {
      title: "Test sticky composer (desktop)",
    });
    await signInAsMember(page);
    await page.goto(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);

    // The sticky composer wrapper is hidden via md:hidden, so it should not be visible.
    // We assert there's NO sticky/fixed Add a comment button — the inline composer in the timeline is the only one.
    const fixedTriggers = page
      .locator(".fixed")
      .getByRole("button", { name: /add a comment/i });
    await expect(fixedTriggers).toHaveCount(0);
  });
});
```

Note: the helpers `signInAsMember` and `seedIssue` may have different names in this project — adjust to match `e2e/support/` actual exports. If a `seedIssue` helper doesn't exist, follow the pattern in `e2e/full/issues-crud.spec.ts` for issue creation/setup.

- [ ] **Step 2: Run the new E2E spec**

Run: `pnpm exec playwright test e2e/full/issue-detail-sticky-composer.spec.ts --project=chromium`

Expected: 3 tests pass. If a helper import fails, adjust to match existing conventions in `e2e/full/`.

- [ ] **Step 3: Add the page route to the responsive-overflow regression spec if not already there**

Run: `rg -n "issue.*detail|i/.*issueNumber" e2e/smoke/responsive-overflow.spec.ts`

Expected: issue detail is already in the spec. If not, add it following the existing pattern (10 routes covered, see `bd memories responsive-overflow`). The spec asserts `assertNoHorizontalOverflow()` at all 3 browser viewports.

- [ ] **Step 4: Run the responsive-overflow smoke test**

Run: `pnpm exec playwright test e2e/smoke/responsive-overflow.spec.ts --project=chromium`

Expected: pass at all viewports.

- [ ] **Step 5: Commit**

```bash
git add e2e/full/issue-detail-sticky-composer.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add sticky composer coverage for mobile signed-in/out + desktop (PP-yxw.9)

Three scenarios: mobile signed-in shows the sticky bar and opens a
sheet on tap; mobile signed-out hides the bar and shows the inline
"Log in to comment" placeholder instead; desktop at any viewport
never renders the sticky bar.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 11: Final verification and Slice 2 PR

**Files:** none (verification + PR creation)

- [ ] **Step 1: Run the full preflight suite**

Run: `pnpm run preflight`

Expected: clean exit. All of: types, lint, format, unit tests, integration tests, build all pass.

- [ ] **Step 2: Run the smoke test suite**

Run: `pnpm run smoke`

Expected: pass on Chromium and Mobile Chrome (all files), Firefox and Mobile Safari (cross-browser subset).

- [ ] **Step 3: Confirm the branch is up to date with origin/main**

```bash
git fetch origin
git log --oneline origin/main..HEAD | head -20
```

Expected: only the Slice 2 commits (Tasks 4-10). If `origin/main` has advanced again, run `git merge origin/main` and re-run preflight.

- [ ] **Step 4: Push the branch**

```bash
git push
```

- [ ] **Step 5: Open the Slice 2 PR**

```bash
gh pr create --title "feat(issues): inline metadata + sticky mobile composer (PP-yxw.9)" --body "$(cat <<'EOF'
## Summary
- Replace `IssueSidebar` (desktop) + bespoke mobile metadata strip with new `IssueMetadata` component (labeled rows, container-query 2-col reflow at `@xl:`)
- Add `StickyCommentComposer` (mobile-only, signed-in only) that opens `AddCommentForm` in a `Sheet`
- Restructure `page.tsx`: single eyebrow row replaces dual breadcrumbs; widened `PageHeader` carries `EditableIssueTitle`; subtitle row carries reporter / date / watchers / watch toggle
- Consolidate `OwnerRequirementsCallout` to a single in-timeline location (no more dual rendering at `@xl:` vs mobile chrome)
- Add new "Detail Page with Inline Metadata" archetype to the design bible

## Why
Phase 2 of the issue detail rework ([PP-yxw.9](https://github.com/timothyfroehlich/PinPoint/issues?q=PP-yxw.9)). The legacy "Detail Page with Sidebar" archetype forced a bespoke mobile rendering path; this rework adopts a single inline-metadata layout that adapts via container query and works identically at every viewport.

Design: [`docs/superpowers/specs/2026-05-01-issue-detail-rework-design.md`](docs/superpowers/specs/2026-05-01-issue-detail-rework-design.md)

## Test plan
- [x] `IssueMetadata` unit tests cover all 5 rows, layout classes, container-query class presence
- [x] `StickyCommentComposer` unit tests cover visibility, sheet open/close, fixed positioning
- [x] E2E: mobile signed-in shows + opens sheet, mobile signed-out hides + shows inline CTA, desktop never renders
- [x] `e2e/smoke/responsive-overflow.spec.ts` passes at all viewports
- [x] `pnpm run preflight` and `pnpm run smoke` clean
- [ ] Manual verification: status / priority / severity / frequency / assignee popovers all work; permission gates respected; reporter / Game Owner / Owner flag render correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Watch CI**

Run: `./scripts/workflow/pr-watch.py <PR-number>`

When CI Gate is green, address Copilot comments per AGENTS.md §"GitHub Copilot Reviews". Then present the merge command for the user:

```
gh pr merge --squash <PR-number>
```

---

## Self-Review

Run after writing the plan, before handoff.

**Spec coverage check:**

| Spec section                                                                                      | Plan coverage                                                                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| §2 D1: Replace IssueSidebar + mobile strip with IssueMetadata                                     | Tasks 5, 8, 9                                                                                                         |
| §2 D2: Container-query reflow at `@xl:` (576px in design bible; 40rem in spec — aligned to bible) | Task 5 (component itself)                                                                                             |
| §2 D3: Widen PageHeader.title                                                                     | Tasks 1, 2 (Slice 1 PR)                                                                                               |
| §2 D4: Drop dual breadcrumbs, replace with eyebrow                                                | Task 8 (page.tsx restructure)                                                                                         |
| §2 D5: StickyCommentComposer mobile-only signed-in                                                | Tasks 6, 8 (page wires it conditionally), 10 (E2E)                                                                    |
| §2 D6: Move OwnerRequirementsCallout to single canonical location                                 | Tasks 7 (timeline), 8 (page.tsx removes its mobile rendering)                                                         |
| §2 D7: New design bible archetype                                                                 | Task 4                                                                                                                |
| §3 Kept-as-is                                                                                     | Verified by no Tasks touching IssueTimeline structure, comment forms, image attachments, watch button component, etc. |
| §6 Responsive behavior (Layer 1 + Layer 2)                                                        | Task 5 implements the container query; Task 8 uses md: only for sticky composer visibility                            |
| §7 Permissions rendering                                                                          | Inherited from existing `Update*Form` components which already gate themselves                                        |
| §10 Migration plan                                                                                | Tasks map 1:1 to file-level changes                                                                                   |
| §13 Acceptance criteria                                                                           | All 8 criteria are touched by Tasks 1-11                                                                              |

**Placeholder scan:** none. Every step has concrete code, exact file paths, exact commands.

**Type consistency check:** `IssueMetadata` props match `IssueSidebar`'s prop shape (issue, allUsers, currentUserId, accessLevel, ownershipContext) — verified in Task 5 against `IssueSidebar.tsx`'s current signature. `StickyCommentComposer` takes only `issueId: string` — verified consistent across Tasks 6 (component), 8 (page.tsx usage), 10 (E2E). `PageHeader.title: React.ReactNode` — Task 1 introduces, Task 8 consumes — consistent.

**Architectural concerns:**

- The plan keeps `SidebarActions` for now (Task 9 deletes only `IssueSidebar`). `SidebarActions` becomes orphaned by Task 8 (page.tsx no longer renders it directly). Listed as phase-2 cleanup in the spec; not in this plan's scope.
- The `WatchButton` className override for the subtitle pill mode is a soft-styling change. If the existing `className` prop doesn't fully accept the override (e.g., the component has hard-coded conflicting classes), Task 8 may need a small `WatchButton` adjustment. Flagged in the design doc §5.6 as "Exact classes TBD during implementation".

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-issue-detail-rework.md`.**
