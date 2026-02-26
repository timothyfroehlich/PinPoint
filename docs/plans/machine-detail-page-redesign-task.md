# Task: Machine Detail Page Redesign

## Context

Branch: `feature/opdb-model-integration` (PinPoint-Secondary worktree)
Dev server: `pnpm dev` on port 3100
Supabase: already running

This branch added OPDB (Open Pinball Database) metadata to machines. The OPDB library, schema migration, API route, and OpdbModelSelect component are committed. The uncommitted changes include a machine detail page refactor that needs UI polish.

**TypeScript bugs have already been fixed** in schemas.ts and actions.ts. This task is purely UI work.

## What to Build

Redesign the machine detail page (`/m/[initials]`) with these 13 changes:

---

### 1. Add `variant="mini"` to IssueCard

**File**: `src/components/issues/IssueCard.tsx`

Current variants: `"normal" | "compact"`. Add `"mini"`.

Mini variant renders a **single-row layout** inside `<Card>`:

- Padding: `p-2`
- Layout: `flex items-center gap-2`
- Left: issue ID in mono — `<span className="text-xs text-muted-foreground font-mono shrink-0">{formatIssueId(initials, issue.issueNumber)}</span>`
- Center: title truncated — `<span className="text-sm text-foreground truncate flex-1 min-w-0">{issue.title}</span>`
- Right: **single status badge only** — `<IssueBadge type="status" value={issue.status} variant="strip" showTooltip={false} />`
- NO machine name, date, severity, priority, or frequency badges
- Keep `<Link>` wrapper and `hover:glow-primary` effect from existing variants
- `<Card>` uses same classes: `border-outline-variant bg-surface hover:glow-primary hover:border-primary/50`
- Closed issues still get `bg-surface-variant/30`

Import `IssueBadge` from `~/components/issues/IssueBadge` (already exported).

The early-return pattern for mini should go before the existing normal/compact rendering:

```tsx
if (variant === "mini") {
  return (
    <Link href={...} className="block">
      <Card className={cn("transition-all cursor-pointer border-outline-variant", isClosed ? "bg-surface-variant/30" : "bg-surface hover:glow-primary", className)} data-testid={dataTestId ?? "issue-card"}>
        <div className="flex items-center gap-2 p-2">
          <span className="text-xs text-muted-foreground font-mono shrink-0">{formatIssueId(initials, issue.issueNumber)}</span>
          <span className={cn("text-sm truncate flex-1 min-w-0", isClosed ? "text-muted-foreground" : "text-foreground")}>{issue.title}</span>
          <IssueBadge type="status" value={issue.status} variant="strip" showTooltip={false} />
        </div>
      </Card>
    </Link>
  );
}
```

---

### 2. Add icon prop + no-reflow fix to InlineEditableField

**File**: `src/components/inline-editable-field.tsx`

**Add `icon` prop:**

```tsx
interface InlineEditableFieldProps {
  // ... existing props ...
  icon?: React.ElementType;
}
```

**Render icon in label row** — replace the plain `<p>` label (currently at line ~109-116) with:

```tsx
<div className="flex items-center gap-1.5">
  {icon && (
    <icon
      className={cn(
        "size-3.5",
        variant === "private" ? "text-primary/60" : "text-on-surface-variant/60"
      )}
      aria-hidden="true"
    />
  )}
  <p
    className={cn(
      "text-[10px] font-bold uppercase tracking-wider",
      variant === "private" ? "text-primary" : "text-on-surface-variant"
    )}
  >
    {label}
  </p>
</div>
```

Note: Destructure `icon` as `icon: Icon` in the function params to use it as a JSX component:

```tsx
export function InlineEditableField({
  // ... other props ...
  icon: Icon,
}: InlineEditableFieldProps) {
```

**No-reflow fix** — add `min-h-[80px]` to the display div (currently line ~155-190). This matches the textarea's `min-h-[80px]`, preventing layout jump on mode switch:

```tsx
<div
  className={cn(
    "group relative min-h-[80px]",
    canEdit && "cursor-pointer rounded-md hover:bg-surface-variant/50"
  )}
  // ... rest unchanged
>
```

**Edit affordance** — change pencil from invisible-until-hover to subtly visible:

```tsx
// Change from:
className = "... opacity-0 transition-opacity group-hover:opacity-100";
// To:
className = "... opacity-30 transition-opacity group-hover:opacity-100";
```

---

### 3. Stack notes vertically with background, divider, and icons

**File**: `src/app/(app)/m/[initials]/machine-text-fields.tsx`

**Layout change** — replace `grid grid-cols-1 xl:grid-cols-2 gap-4` with a wrapped vertical stack:

```tsx
import { Separator } from "~/components/ui/separator";
import { FileText, Trophy, Shield, Lock } from "lucide-react";

// In the return:
<div className="rounded-xl border border-outline-variant/30 bg-surface-variant/10 p-4 space-y-4">
  <InlineEditableField
    icon={FileText}
    label="Description"
    // ... rest unchanged
  />
  <InlineEditableField
    icon={Trophy}
    label="Tournament Notes"
    // ... rest unchanged
  />

  {(canViewOwnerRequirements || canViewOwnerNotes) && (
    <Separator className="bg-outline-variant/50" />
  )}

  {canViewOwnerRequirements && (
    <InlineEditableField
      icon={Shield}
      label="Owner's Requirements"
      // ... rest unchanged
    />
  )}
  {canViewOwnerNotes && (
    <InlineEditableField
      icon={Lock}
      label="Owner's Notes (Private)"
      variant="private"
      // ... rest unchanged
    />
  )}
</div>;
```

---

### 4. Issues expando: mini cards + view-all link in header

**File**: `src/app/(app)/m/[initials]/issues-expando.tsx`

Changes:

1. Switch `IssueCard` from `variant="compact"` to `variant="mini"`
2. Reduce spacing: `space-y-3` → `space-y-2`
3. Add "View all" link in the header right side, replacing/alongside the "of X total" count:

```tsx
import { ExternalLink } from "lucide-react";
// Remove: import { Button } from "~/components/ui/button";
// Remove: import { History } from "lucide-react";

// In the header right-side div:
<div className="flex items-center gap-3">
  {totalIssuesCount > issues.length && (
    <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
      of {totalIssuesCount} total
    </span>
  )}
  <Link
    href={`/issues?machine=${machineInitials}`}
    className="text-[11px] text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
  >
    View all
    <ExternalLink className="size-3" />
  </Link>
</div>;
```

4. **Remove the footer entirely** — delete the `{(totalIssuesCount > 0 || issues.length > 0) && (...)}` block at the bottom that contains the "View tracking history" button.

---

### 5. Page layout: swap columns, widen, status accent, remove subtitle

**File**: `src/app/(app)/m/[initials]/page.tsx`

**Remove subtitle** — delete these lines (currently around line 257):

```tsx
<p className="mt-1 text-sm text-on-surface-variant">
  Machine details and issue tracking
</p>
```

**Add status-colored header accent** — compute the accent class after `machineStatus` is derived:

```tsx
const statusAccentClass = {
  operational: "border-l-success",
  needs_service: "border-l-warning",
  unplayable: "border-l-error",
}[machineStatus];
```

Apply to the header outer div:

```tsx
// Change from:
<div className="border-b border-outline-variant bg-surface-container">
// To:
<div className={cn("border-b border-outline-variant bg-surface-container border-l-4", statusAccentClass)}>
```

**Swap columns** — in the two-column content area, put issues on the left with machine info:

```tsx
<div className="flex flex-col lg:flex-row gap-6">
  {/* Left: Machine Info + Open Issues */}
  <div className="w-full lg:w-96 shrink-0 space-y-4">
    <MachineInfoDisplay
      machine={machine}
      canEdit={canEdit}
      editDeniedReason={editDeniedReason}
      isAuthenticated={!!user}
    />
    <IssuesExpando
      issues={openIssues}
      machineName={machine.name}
      machineInitials={machine.initials}
      totalIssuesCount={totalIssuesCount}
    />
  </div>

  {/* Right: Notes */}
  <div className="flex-1 min-w-0">
    <MachineTextFields
      machineId={machine.id}
      description={machine.description}
      tournamentNotes={machine.tournamentNotes}
      ownerRequirements={machine.ownerRequirements}
      ownerNotes={machine.ownerNotes}
      canEditGeneral={canEdit}
      canEditOwnerNotes={canEditOwnerNotes}
      canViewOwnerRequirements={canViewOwnerRequirements}
      canViewOwnerNotes={canViewOwnerNotes}
    />
  </div>
</div>
```

Width changes from `lg:w-80` to `lg:w-96`.

---

### 6. Replace owner avatar with OwnerBadge

**File**: `src/app/(app)/m/[initials]/machine-info-display.tsx`

Add import:

```tsx
import { OwnerBadge } from "~/components/issues/OwnerBadge";
```

Replace the custom avatar circle (the `<div className="size-4 rounded-full bg-primary/20 ...">` block, around lines 110-112) with:

```tsx
<OwnerBadge size="sm" />
```

Keep the owner name `<span>` next to it. The surrounding conditional (`machine.owner || machine.invitedOwner`) stays the same.

---

### 7. Fix E2E tests

**File**: `e2e/smoke/machine-details-redesign.spec.ts`

Several tests reference elements that no longer exist:

**Test 1** ("should display full-width details card with two-column layout"):

- Remove assertion for `heading: "Machine Information"` — heading is now "Machine Details"
- Remove `owner-display`, `detail-open-issues`, `detail-open-issues-count` testId assertions — these don't exist
- Replace with: assert `issues-section` is visible, assert machine name heading is visible

**Tests 2-3** ("should show issues expando collapsed by default" and "should expand and collapse issues section"):

- **Delete both tests entirely** — the issues section is always visible now, no longer collapsible
- References to `issues-expando`, `issues-expando-trigger` test IDs are gone

**Test "should show Report Issue button in header"** (line 195-201):

- Replace `page.getByTestId("machine-report-issue")` with `page.getByRole("link", { name: "Report Issue" })`

**Test "should display owner requirements callout on issue page"** (line 203-257):

- Remove the `await page.getByTestId("issues-expando-trigger").click()` line — issues are always visible
- The rest (clicking first issue card, checking callout) should work

---

## Verification Checklist

```bash
# 1. Type check
pnpm exec tsc --noEmit

# 2. Full check (types + lint + format + unit tests)
pnpm run check

# 3. Visual verification
# Browse to http://localhost:3100/m/MM or any machine page

# 4. Full preflight (includes build + integration)
pnpm run preflight

# 5. E2E test
pnpm exec playwright test e2e/smoke/machine-details-redesign.spec.ts
```

## Important Project Rules

- **No `any`, no `!`, no unsafe `as`** — project uses ts-strictest
- **Path aliases**: always use `~/` (e.g., `~/lib/utils`)
- **Server Components default**: only `"use client"` for interactivity
- **Run `pnpm run preflight` before considering work complete**
- **Never use `--no-verify`** on git commands
- **Escape parentheses** in shell paths: `src/app/\(app\)/...`
