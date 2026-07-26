# Machine Edit Page Implementation Plan (PP-o355.19)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **PinPoint override:** load `pinpoint-superpowers-bridge` first. Never merge locally; finish through a PR and hand Tim `! scripts/workflow/merge-pr.sh <PR> --human`.

**Goal:** Replace the 593-line Edit Machine modal with a routable page at `/m/[initials]/edit` whose sections have independent save models.

**Architecture:** A Server Component at `src/app/(app)/m/[initials]/edit/page.tsx` (deliberately outside the `(tabs)` route group — it is a page, not another tab) loads the machine, resolves permissions, and composes three sections. **Details** is one client form with its own Save. **Pinball Map** has no save bar; each control acts on its own. **Danger zone** holds ownership transfer, which submits separately. All three reuse the existing `updateMachineAction` — no new server action is needed, because that action already treats an absent form field as "leave this column untouched."

**Tech Stack:** Next.js App Router (Server Components + Server Actions), React 19 `useActionState`, shadcn/ui, Tailwind v4 semantic tokens, Drizzle, Vitest + RTL, Playwright.

## Global Constraints

- **Server Components default** (CORE-ARCH-001) — `"use client"` only on interaction leaves.
- **Progressive enhancement** (CORE-ARCH-002) — `<form action={serverAction}>`, direct action references, no inline wrapper functions.
- **Supabase SSR** (CORE-SSR-001/002) — `createClient()` then `auth.getUser()` immediately, no logic between.
- **Permissions via the matrix** (CORE-ARCH-008) — `checkPermission()` from `~/lib/permissions/index`. Never hand-roll an ownership comparison as an authorization gate.
- **Type safety** (CORE-TS-007) — ts-strictest: no `any`, no `!`, no unsafe `as`. Path alias `~/` always (CORE-TS-008).
- **Semantic color tokens only** — `text-warning`, `border-outline-variant`, `text-on-primary`, `text-destructive`, `bg-surface`, `border-outline`. Raw palette classes (`bg-cyan-500`) and hex are ESLint errors.
- **Accessibility floor** (CORE-A11Y-001..006) — real `<button>`/`<a>` elements, `aria-hidden` on decorative icons, headings associated with sections via `aria-labelledby`.
- **Escape parens in shell paths**: `src/app/\(app\)/m/\[initials\]/edit/page.tsx`.
- **Test at the cheapest layer** (CORE-TEST-005) — RTL unit for form-state logic; E2E only for multi-step journeys.
- **`pnpm run check` before every commit** (~12s). This plan touches no migrations or schema, so `preflight` is not required; run `pnpm run smoke` once at the end.

## Verified Facts (do not re-derive — these were checked against the code)

These four behaviours of `updateMachineAction` (`src/app/(app)/m/actions.ts`) are what make three independent forms safe against one shared action. **If any turns out false, stop and re-plan — the whole design rests on them.**

1. **Owner is untouched when `ownerId` is absent.** The non-promote branch guards on `if (ownerId) { shouldUpdateOwner = true; ... }` (~line 861). An empty-string `ownerId` is mapped to `undefined` before validation, so it also cannot clear an owner.
2. **Description is untouched when the field is absent.** `parseDescriptionFormField`'s docblock is explicit: "Presence of the field is the marker: absent → leave the column untouched; empty → clear to null."
3. **PinballMap link columns are untouched without the marker.** They are written only when `formData.get("pbmLinkPresent") === "1"`, which `PinballMapLinkField` renders.
4. **`name` is REQUIRED** by `updateMachineSchema` (`src/app/(app)/m/schemas.ts:69`) — `z.string().min(1).max(100)`, not optional. Any form posting to this action must carry a `name`. This is why the ownership form resubmits the current name as a hidden field.

`presenceStatus` is optional and untouched when absent.

## File Structure

**Create:**

| File                                                              | Responsibility                                                                      |
| :---------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| `src/app/(app)/m/[initials]/edit/page.tsx`                        | Server Component: auth, permission gate, data loading, section composition          |
| `src/app/(app)/m/[initials]/edit/machine-details-form.tsx`        | Client: Details form — name, catalog picker, description, availability, Cancel/Save |
| `src/app/(app)/m/[initials]/edit/machine-details-form.test.tsx`   | RTL: description serialization, Cancel reset, dirty note                            |
| `src/app/(app)/m/[initials]/edit/pinballmap-sync-now.tsx`         | Client: "Sync now" submit button                                                    |
| `src/app/(app)/m/[initials]/edit/machine-owner-transfer.tsx`      | Client: Danger-zone ownership transfer (disclosure + confirms)                      |
| `src/app/(app)/m/[initials]/edit/machine-owner-transfer.test.tsx` | RTL: disclosure, disabled-until-changed, hidden name field                          |

**Modify:**

| File                                          | Change                                                                                            |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `src/app/(app)/m/[initials]/(tabs)/page.tsx`  | Edit control becomes a `<Link>` to the page; drop the now-dead `allUsers` and catalog-title reads |
| `e2e/full/technician-role.spec.ts:28,87`      | Navigate to the page; submit is "Save details"                                                    |
| `e2e/full/invite-signup.spec.ts:160`          | Owner change now goes through the Danger-zone disclosure, no dialog                               |
| `e2e/smoke/responsive-overflow.spec.ts:44-54` | Add the edit route to `authenticatedRoutes`                                                       |

**Delete:**

| File                                                      | Why                                                                                                                                                  |
| :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/m/[initials]/update-machine-form.tsx`      | Replaced by the page                                                                                                                                 |
| `src/app/(app)/m/[initials]/update-machine-form.test.tsx` | Its description-serialization cases move to the new Details test; its unsaved-changes-guard cases die with the dialog (a page has no dismiss vector) |

**Reference drafts:** working implementations of all four new source files are parked at `/private/tmp/claude-501/-Users-froeht-Code-PinPoint/9362cbe3-abad-4176-b8d8-ba63af54586c/scratchpad/drafts/`. The code in this plan supersedes them where they differ.

---

### Task 1: Route skeleton + Details section

The page exists, is permission-gated, and its Details section saves independently.

**Files:**

- Create: `src/app/(app)/m/[initials]/edit/page.tsx`
- Create: `src/app/(app)/m/[initials]/edit/machine-details-form.tsx`
- Test: `src/app/(app)/m/[initials]/edit/machine-details-form.test.tsx`

**Interfaces:**

- Consumes: `updateMachineAction` / `UpdateMachineResult` from `~/app/(app)/m/actions`; `getMachineForLayout` from `../_data`; `PinballMapLinkField`; `RichTextEditor` from `~/components/editor/RichTextEditorDynamic`.
- Produces: `MachineDetailsForm` with props `{ machineId: string; name: string; presenceStatus: MachinePresenceStatus; description: ProseMirrorDoc | null; canLink: boolean; pinballmapMachineId: number | null; pinballmapExcluded: boolean; pinballmapExcludedReason: string | null; pinballmapTitleName: string | null }`. Tasks 2 and 3 add sections to the same `page.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/m/[initials]/edit/machine-details-form.test.tsx`. Mock the editor so the test drives a plain textarea rather than TipTap, and mock the server action so nothing hits the network.

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineDetailsForm } from "./machine-details-form";

vi.mock("~/app/(app)/m/actions", () => ({
  updateMachineAction: vi.fn(),
}));

// The real editor is a dynamic TipTap import. Swap it for a textarea that
// pushes a ProseMirror-shaped doc through the same onChange contract.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({
    onChange,
    ariaLabel,
  }: {
    onChange: (doc: unknown) => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      onChange={(e) =>
        onChange({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: e.target.value }],
            },
          ],
        })
      }
    />
  ),
}));

vi.mock("~/components/machines/PinballMapLinkField", () => ({
  PinballMapLinkField: () => <div data-testid="pbm-link-field" />,
}));

const baseProps = {
  machineId: "11111111-1111-1111-1111-111111111111",
  name: "Godzilla (Premium)",
  presenceStatus: "on_the_floor" as const,
  description: null,
  canLink: true,
  pinballmapMachineId: 42,
  pinballmapExcluded: false,
  pinballmapExcludedReason: null,
  pinballmapTitleName: "Godzilla (Premium)",
};

function hiddenDescription(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>(
    'input[name="description"]'
  );
  if (!field) throw new Error("hidden description field not rendered");
  return field;
}

describe("MachineDetailsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes the editor's doc into the hidden description input", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText("Machine description"), "Hi");

    expect(JSON.parse(hiddenDescription().value)).toMatchObject({
      type: "doc",
    });
  });

  it("serializes a null description to an empty string", () => {
    render(<MachineDetailsForm {...baseProps} />);
    expect(hiddenDescription().value).toBe("");
  });

  it("shows an unsaved-changes note once a field is edited", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "No unsaved changes"
    );

    await user.type(screen.getByLabelText(/Machine Name/), "!");

    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "Unsaved changes"
    );
  });

  it("restores the original description and clears the dirty note on Cancel", async () => {
    const user = userEvent.setup();
    render(<MachineDetailsForm {...baseProps} />);

    await user.type(screen.getByLabelText("Machine description"), "draft");
    expect(hiddenDescription().value).not.toBe("");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(hiddenDescription().value).toBe("");
    expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
      "No unsaved changes"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- 'src/app/(app)/m/[initials]/edit/machine-details-form.test.tsx'`
Expected: FAIL — cannot resolve `./machine-details-form`.

- [ ] **Step 3: Write the Details form**

Create `src/app/(app)/m/[initials]/edit/machine-details-form.tsx`:

```tsx
"use client";

import type React from "react";
import { useActionState, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  updateMachineAction,
  type UpdateMachineResult,
} from "~/app/(app)/m/actions";
import { PinballMapLinkField } from "~/components/machines/PinballMapLinkField";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

export interface MachineDetailsFormProps {
  machineId: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  description: ProseMirrorDoc | null;
  /** Viewer may set/change the PinballMap catalog link. */
  canLink: boolean;
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  pinballmapExcludedReason: string | null;
  pinballmapTitleName: string | null;
}

/**
 * Details section of the machine edit page (PP-o355.19).
 *
 * The section owns its own save: everything inside this form is written by one
 * `updateMachineAction` submit, and nothing outside it rides along. Ownership
 * deliberately does NOT live here — it moved to the Danger zone, which submits
 * its own form. Because this form carries no `ownerId` field, the action leaves
 * the owner columns untouched.
 *
 * The PinballMap catalog picker renders here rather than in the PinballMap
 * section because it is genuinely part of this save today — it submits with
 * these fields. PP-o355.21 moves it into that section with its own Save title
 * button; until then, putting it under a heading that implies otherwise would
 * misrepresent the save model.
 */
export function MachineDetailsForm({
  machineId,
  name,
  presenceStatus,
  description,
  canLink,
  pinballmapMachineId,
  pinballmapExcluded,
  pinballmapExcludedReason,
  pinballmapTitleName,
}: MachineDetailsFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  const [isDirty, setIsDirty] = useState(false);
  // The RichTextEditor is uncontrolled after mount (content is an initial
  // prop), so its doc is mirrored here to serialize into the hidden field.
  const [descriptionDoc, setDescriptionDoc] = useState<ProseMirrorDoc | null>(
    description
  );
  // Cancel remounts the subtree by changing the key — a native form reset
  // cannot restore a contenteditable widget.
  const [resetKey, setResetKey] = useState(0);

  // A successful save makes the submitted values the new baseline.
  useEffect(() => {
    if (state?.ok) {
      setIsDirty(false);
    }
  }, [state]);

  const handleCancel = (): void => {
    setDescriptionDoc(description);
    setResetKey((k) => k + 1);
    setIsDirty(false);
  };

  return (
    <form
      key={resetKey}
      action={formAction}
      // Any native input event marks the section dirty. Radix Select changes
      // do not bubble `input`, so Availability flags dirtiness explicitly.
      onInput={() => setIsDirty(true)}
      className="space-y-6"
      data-testid="machine-details-form"
    >
      <input type="hidden" name="id" value={machineId} />

      {state && !state.ok && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="edit-name" className="text-foreground">
          Machine Name <span aria-hidden="true">*</span>
        </Label>
        <Input
          id="edit-name"
          name="name"
          type="text"
          required
          defaultValue={name}
          placeholder="e.g., Medieval Madness"
          enterKeyHint="next"
          className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {canLink && (
        <PinballMapLinkField
          defaultMachineId={pinballmapMachineId}
          defaultName={pinballmapTitleName}
          defaultExcluded={pinballmapExcluded}
          defaultExcludedReason={pinballmapExcludedReason}
        />
      )}

      <div className="space-y-2">
        {/* No htmlFor: RichTextEditor is a contenteditable widget with no
            focusable `id`. Its accessible name comes from `ariaLabel`. */}
        <Label className="text-foreground">Description</Label>
        <RichTextEditor
          content={description}
          onChange={(doc) => {
            setDescriptionDoc(doc);
            setIsDirty(true);
          }}
          mentionsEnabled={false}
          placeholder="Add a description for this machine..."
          ariaLabel="Machine description"
          compact={false}
          className="min-h-[120px]"
        />
        <input
          type="hidden"
          name="description"
          value={descriptionDoc ? JSON.stringify(descriptionDoc) : ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-presence" className="text-foreground">
          Availability
        </Label>
        <Select
          name="presenceStatus"
          defaultValue={presenceStatus}
          onValueChange={() => setIsDirty(true)}
        >
          <SelectTrigger
            id="edit-presence"
            className="border-outline bg-surface text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALID_MACHINE_PRESENCE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {getMachinePresenceLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-3">
        <span
          className={
            isDirty
              ? "mr-auto text-sm text-warning"
              : "mr-auto text-sm text-muted-foreground"
          }
          data-testid="details-dirty-note"
        >
          {isDirty
            ? "Unsaved changes"
            : state?.ok
              ? "Saved"
              : "No unsaved changes"}
        </span>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-primary text-on-primary hover:bg-primary/90"
          loading={isPending}
        >
          Save details
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- 'src/app/(app)/m/[initials]/edit/machine-details-form.test.tsx'`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the page skeleton**

Create `src/app/(app)/m/[initials]/edit/page.tsx`. Sections for Pinball Map and Danger zone arrive in Tasks 2 and 3.

```tsx
import type React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, pinballmapCatalog } from "~/server/db/schema";
import {
  getAccessLevel,
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { getMachineForLayout } from "../_data";
import { MachineDetailsForm } from "./machine-details-form";

/**
 * Machine edit page (/m/[initials]/edit) — PP-o355.19.
 *
 * Replaces the Edit Machine modal. The driver was never size alone: **a page
 * lets sections have different save models.** Details fields belong to one
 * Save; ownership transfer is its own deliberate act; PinballMap operations
 * write to a third-party service, can fail, and need to report — none of which
 * a modal that dismisses on save can do.
 *
 * Deliberately OUTSIDE the `(tabs)` route group: this is a full page with its
 * own header, not another tab on the machine.
 *
 * Removing the Dialog wrapper also removes PP-o355.13's repro path — a Radix
 * popover portalled to <body> being read as an outside-click and dismissing the
 * whole modal.
 */
export default async function MachineEditPage({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { machine } = await getMachineForLayout(initials);
  if (!machine) {
    notFound();
  }

  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;

  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  };

  // Send anyone who may not edit back to the machine, where the disabled Edit
  // button explains why (edit-button-tooltip). A bare 404 would be a lie — the
  // machine exists, the viewer just cannot edit it.
  if (
    !user ||
    !checkPermission("machines.edit", accessLevel, ownershipContext)
  ) {
    redirect(`/m/${initials}`);
  }

  const canLink = checkPermission(
    "machines.pinballmap.link",
    accessLevel,
    ownershipContext
  );

  const pinballmapTitleName =
    canLink && machine.pinballmapMachineId !== null
      ? ((
          await db.query.pinballmapCatalog.findFirst({
            where: eq(
              pinballmapCatalog.pinballmapMachineId,
              machine.pinballmapMachineId
            ),
            columns: { name: true },
          })
        )?.name ?? null)
      : null;

  return (
    <PageContainer size="narrow">
      <Link
        href={`/m/${machine.initials}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {machine.initials} · {machine.name}
      </Link>

      <PageHeader title={`Edit ${machine.name}`} />

      {/* Details — these fields save together. */}
      <section className="space-y-4" aria-labelledby="section-details">
        <h2 id="section-details" className="text-base font-semibold">
          Details
        </h2>
        <MachineDetailsForm
          machineId={machine.id}
          name={machine.name}
          presenceStatus={machine.presenceStatus}
          description={machine.description}
          canLink={canLink}
          pinballmapMachineId={machine.pinballmapMachineId}
          pinballmapExcluded={machine.pinballmapExcluded}
          pinballmapExcludedReason={machine.pinballmapExcludedReason}
          pinballmapTitleName={pinballmapTitleName}
        />
      </section>
    </PageContainer>
  );
}
```

- [ ] **Step 6: Verify the gate compiles and the suite is green**

Run: `pnpm run check`
Expected: PASS. If ESLint flags the `?? null` chain formatting, accept `pnpm run format`'s output rather than rewriting the expression.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/m/[initials]/edit"
git commit -m "feat(machines): add the machine edit page with an independent Details save (PP-o355.19)"
```

---

### Task 2: Pinball Map section

The section exists as a container with the location link, the last-synced line, a working "Sync now", and the existing listing control. **No PinballMap behaviour changes** — PP-o355.21 rebuilds the control itself.

**Files:**

- Create: `src/app/(app)/m/[initials]/edit/pinballmap-sync-now.tsx`
- Modify: `src/app/(app)/m/[initials]/edit/page.tsx`

**Interfaces:**

- Consumes: `syncPinballMapNowAction` from `~/app/(app)/m/pinballmap-actions` (already `(prevState, formData)` shaped); `PinballmapListingControl`; `getPinballMapState`; `pinballmapLocationUrl`; `formatDateTime` from `~/lib/dates`.
- Produces: `PinballmapSyncNow` — a no-prop client component.

- [ ] **Step 1: Write the sync button**

Create `src/app/(app)/m/[initials]/edit/pinballmap-sync-now.tsx`:

```tsx
"use client";

import type React from "react";
import { useActionState } from "react";
import { syncPinballMapNowAction } from "~/app/(app)/m/pinballmap-actions";

/**
 * "Sync now" — the manual refresh in the PinballMap section header of the
 * machine edit page (PP-o355.19).
 *
 * `syncPinballMapNowAction` is already form-action shaped, so this is a plain
 * `<form action={...}>` and works without JavaScript (CORE-ARCH-002). The
 * action self-throttles at the `syncLocationSnapshot` seam and reports
 * `THROTTLED` rather than hammering PinballMap (CORE-PBM-001).
 */
export function PinballmapSyncNow(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(
    syncPinballMapNowAction,
    undefined
  );

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={isPending}
        className="text-primary underline underline-offset-2 hover:no-underline disabled:opacity-60"
        data-testid="pbm-sync-now"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {state && !state.ok && (
        <span className="ml-2 text-destructive" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Add the imports to the page**

In `src/app/(app)/m/[initials]/edit/page.tsx`, extend the icon import and add four imports beside the existing ones:

```tsx
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PinballmapListingControl } from "~/components/machines/PinballmapListingControl";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { formatDateTime } from "~/lib/dates";
import { PinballmapSyncNow } from "./pinballmap-sync-now";
```

- [ ] **Step 3: Load the sync state**

Replace the single-await `pinballmapTitleName` block from Task 1 with a concurrent pair — the two reads are independent:

```tsx
const pinballmapTitlePromise: Promise<string | null> =
  canLink && machine.pinballmapMachineId !== null
    ? db.query.pinballmapCatalog
        .findFirst({
          where: eq(
            pinballmapCatalog.pinballmapMachineId,
            machine.pinballmapMachineId
          ),
          columns: { name: true },
        })
        .then((linkedTitle) => linkedTitle?.name ?? null)
    : Promise.resolve(null);

const [pinballmapTitleName, pbmState] = await Promise.all([
  pinballmapTitlePromise,
  canLink ? getPinballMapState() : Promise.resolve(null),
]);

const locationUrl = pinballmapLocationUrl();
```

- [ ] **Step 4: Render the section**

First add the sync-visibility check beside the existing `canLink` check. `machines.pinballmap.link` is not the right gate for the Sync-now button: `syncPinballMapNowAction` enforces `machines.pinballmap.sync`, which the matrix grants to technicians and admins only, while `machines.pinballmap.link` also grants `member: "owner"`. Gating the button on `canLink` would show an owner-member a control guaranteed to fail server-side.

```tsx
const canSync = checkPermission(
  "machines.pinballmap.sync",
  accessLevel,
  ownershipContext
);
```

Then add immediately after the Details `</section>`:

```tsx
{
  /* Pinball Map — no save bar: each control here acts on its own.
          PP-o355.21 rebuilds the listing control and moves the catalog title
          row in from Details, where it currently rides the Details save. */
}
<section
  className="space-y-4 border-t border-outline-variant pt-6"
  aria-labelledby="section-pinballmap"
>
  <div className="flex flex-wrap items-baseline justify-between gap-2">
    <h2 id="section-pinballmap" className="text-base font-semibold">
      <a
        href={locationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
      >
        Pinball Map
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </h2>
    {canLink && (
      <p className="text-sm text-muted-foreground">
        {pbmState?.lastSyncedAt
          ? `last synced ${formatDateTime(pbmState.lastSyncedAt)}`
          : "never synced"}
        {canSync && (
          <>
            {" · "}
            <PinballmapSyncNow />
          </>
        )}
      </p>
    )}
  </div>

  <PinballmapListingControl
    machineId={machine.id}
    hasCatalogLink={machine.pinballmapMachineId !== null}
    listed={machine.pinballmapListed}
    lmxId={machine.pinballmapLmxId}
    canLink={canLink}
    pinballmapUrl={locationUrl}
  />
</section>;
```

- [ ] **Step 5: Cover the error branch (RTL)**

Create `src/app/(app)/m/[initials]/edit/pinballmap-sync-now.test.tsx`. `PinballmapSyncNow`'s `state && !state.ok` branch is form-state lifecycle — class C, so RTL unit is the cheapest catching layer (CORE-TEST-005). The template lives one file away: `PinballmapListingControl.test.tsx` covers this exact bug class (an async server-action failure surfaced through `useActionState`) — mirror its structure rather than inventing a harness.

- Mock `~/app/(app)/m/pinballmap-actions` at the module boundary so nothing reaches pinballmap.com (CORE-PBM-001 / CORE-TEST-006).
- Test 1: resolve `err("THROTTLED", <message>)`, click the button, assert the message via `findByRole("alert")`.
- Test 2: resolve `ok(...)`, click, `waitFor` the button to leave its disabled state, then assert `queryByRole("alert")` is null. Waiting on pending-to-false matters: `isPending` and `state` come off the same dispatch, so without it the assertion can pass vacuously before the action settles.

- [ ] **Step 6: Verify**

Run: `pnpm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/m/[initials]/edit"
git commit -m "feat(machines): add the Pinball Map section to the machine edit page (PP-o355.19)"
```

---

### Task 3: Danger zone — ownership transfer

Ownership stops riding the Details save and becomes its own deliberate act.

**Files:**

- Create: `src/app/(app)/m/[initials]/edit/machine-owner-transfer.tsx`
- Test: `src/app/(app)/m/[initials]/edit/machine-owner-transfer.test.tsx`
- Modify: `src/app/(app)/m/[initials]/edit/page.tsx`

**Interfaces:**

- Consumes: `updateMachineAction`, `AssigneeNotMemberMeta` from `~/app/(app)/m/actions`; `OwnerSelect` + `OwnerSelectUser` from `~/components/machines/OwnerSelect`.
- Produces: `MachineOwnerTransfer` with props `{ machineId: string; machineName: string; ownerId: string | null; invitedOwnerId: string | null; ownerName: string | null; invitedOwnerName: string | null; allUsers: OwnerSelectUser[]; canEditAnyMachine: boolean; isOwner: boolean }`.

**Why an inline disclosure rather than a dialog:** `OwnerSelect` is a Popover + cmdk picker, and Radix portals popover content outside the dialog subtree — the exact mechanism behind PP-o355.13. Reintroducing a picker inside a Dialog would reintroduce that bug in the very PR that removes it. The transfer _confirm_ is still an AlertDialog, which is safe: plain text and two buttons, no portalled picker.

- [ ] **Step 1: Write the failing test**

Create `src/app/(app)/m/[initials]/edit/machine-owner-transfer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MachineOwnerTransfer } from "./machine-owner-transfer";

vi.mock("~/app/(app)/m/actions", () => ({
  updateMachineAction: vi.fn(),
}));

// OwnerSelect is a Popover + cmdk picker; swap it for a plain select that
// honours the same `onValueChange` contract.
vi.mock("~/components/machines/OwnerSelect", () => ({
  OwnerSelect: ({ onValueChange }: { onValueChange: (id: string) => void }) => (
    <select
      aria-label="Owner"
      onChange={(e) => onValueChange(e.target.value)}
      defaultValue=""
    >
      <option value="">Unassigned</option>
      <option value="owner-1">Current Owner</option>
      <option value="owner-2">New Owner</option>
    </select>
  ),
}));

const baseProps = {
  machineId: "11111111-1111-1111-1111-111111111111",
  machineName: "Godzilla (Premium)",
  ownerId: "owner-1",
  invitedOwnerId: null,
  ownerName: "Current Owner",
  invitedOwnerName: null,
  allUsers: [],
  canEditAnyMachine: true,
  isOwner: false,
};

describe("MachineOwnerTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the current owner before the disclosure is opened", () => {
    render(<MachineOwnerTransfer {...baseProps} />);
    expect(screen.getByText(/Owned by Current Owner/)).toBeVisible();
    expect(screen.queryByLabelText("Owner")).not.toBeInTheDocument();
  });

  it("reveals the picker when Change owner is clicked", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);

    await user.click(screen.getByTestId("open-owner-transfer"));

    expect(screen.getByLabelText("Owner")).toBeVisible();
  });

  it("keeps Transfer disabled until a different owner is picked", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    const submit = screen.getByRole("button", { name: "Transfer ownership" });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Owner"), "owner-2");

    expect(submit).toBeEnabled();
  });

  it("carries the current name so the shared update action's required field is satisfied", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    const nameField =
      document.querySelector<HTMLInputElement>('input[name="name"]');
    expect(nameField?.value).toBe("Godzilla (Premium)");
  });

  it("does not submit a description field, so a transfer cannot clear it", async () => {
    const user = userEvent.setup();
    render(<MachineOwnerTransfer {...baseProps} />);
    await user.click(screen.getByTestId("open-owner-transfer"));

    expect(document.querySelector('input[name="description"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- 'src/app/(app)/m/[initials]/edit/machine-owner-transfer.test.tsx'`
Expected: FAIL — cannot resolve `./machine-owner-transfer`.

- [ ] **Step 3: Write the component**

Create `src/app/(app)/m/[initials]/edit/machine-owner-transfer.tsx`:

```tsx
"use client";

import type React from "react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { Button } from "~/components/ui/button";
import {
  updateMachineAction,
  type UpdateMachineResult,
  type AssigneeNotMemberMeta,
} from "~/app/(app)/m/actions";
import {
  OwnerSelect,
  type OwnerSelectUser,
} from "~/components/machines/OwnerSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";

export interface MachineOwnerTransferProps {
  machineId: string;
  /**
   * Current machine name — resubmitted unchanged so the shared update action
   * can satisfy its required `name` field without altering it.
   */
  machineName: string;
  ownerId: string | null;
  invitedOwnerId: string | null;
  ownerName: string | null;
  invitedOwnerName: string | null;
  allUsers: OwnerSelectUser[];
  canEditAnyMachine: boolean;
  isOwner: boolean;
}

/**
 * Ownership transfer — the Danger zone row on the machine edit page
 * (PP-o355.19).
 *
 * Ownership used to ride the Edit Machine modal's single Save. On the page it
 * has its own submit, so changing the owner is deliberate rather than a side
 * effect of saving a description typo.
 *
 * **Why an inline disclosure and not a dialog.** `OwnerSelect` is a Popover +
 * cmdk picker, and Radix portals popover content outside the dialog subtree —
 * the exact mechanism behind PP-o355.13 (a click inside the picker read as an
 * outside-click and dismissed the modal). Expanding in place keeps the picker
 * out of any portal-vs-dismiss interaction. The confirm below IS an
 * AlertDialog, which is safe: plain text and two buttons, no portalled picker.
 *
 * This form carries `id`, `name` and `ownerId` only. `updateMachineAction`
 * leaves presence, description and PinballMap link columns untouched when their
 * fields are absent, so a transfer cannot clobber unsaved edits in Details.
 */
export function MachineOwnerTransfer({
  machineId,
  machineName,
  ownerId,
  invitedOwnerId,
  ownerName,
  invitedOwnerName,
  allUsers,
  canEditAnyMachine,
  isOwner,
}: MachineOwnerTransferProps): React.JSX.Element {
  const currentOwnerId = ownerId ?? invitedOwnerId ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(currentOwnerId);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const transferConfirmedRef = useRef(false);

  const [promoteAssignee, setPromoteAssignee] = useState<
    AssigneeNotMemberMeta["assignee"] | null
  >(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  const [state, formAction, isPending] = useActionState<
    UpdateMachineResult | undefined,
    FormData
  >(updateMachineAction, undefined);

  const handledStateRef = useRef<typeof state>(undefined);

  // Collapse the disclosure once the transfer lands.
  useEffect(() => {
    if (state?.ok) {
      setIsOpen(false);
    }
  }, [state]);

  // Offer promotion when the server reports the pick is still a guest.
  useEffect(() => {
    if (
      state &&
      state !== handledStateRef.current &&
      !state.ok &&
      state.code === "ASSIGNEE_NOT_MEMBER" &&
      state.meta?.assignee
    ) {
      handledStateRef.current = state;
      setPromoteAssignee(state.meta.assignee);
      setIsPromoteOpen(true);
    }
  }, [state]);

  const displayOwnerName = ownerName ?? invitedOwnerName;
  const selectedOwnerName =
    allUsers.find((u) => u.id === selectedOwnerId)?.name ?? "the selected user";

  // A non-privileged owner handing the machine away loses their own access, so
  // they get a confirm. Admins and technicians keep access either way.
  const needsTransferConfirm =
    !canEditAnyMachine && isOwner && selectedOwnerId !== currentOwnerId;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    if (transferConfirmedRef.current) {
      transferConfirmedRef.current = false;
      return;
    }
    if (needsTransferConfirm) {
      e.preventDefault();
      setShowTransferConfirm(true);
    }
  };

  const handleConfirmTransfer = (): void => {
    setShowTransferConfirm(false);
    transferConfirmedRef.current = true;
    formRef.current?.requestSubmit();
  };

  const confirmPromote = (): void => {
    if (!promoteAssignee || !formRef.current) return;
    setIsPromoteOpen(false);
    const fd = new FormData(formRef.current);
    fd.set("forcePromoteUserId", promoteAssignee.id);
    // useActionState dispatch must run inside a transition — outside one,
    // React 19 silently skips the server action.
    startTransition(() => {
      formAction(fd);
    });
  };

  const cancelTransfer = (): void => {
    setSelectedOwnerId(currentOwnerId);
    setIsOpen(false);
  };

  return (
    <div className="py-2" data-testid="owner-transfer">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-foreground">Transfer ownership</p>
          <p className="text-sm text-muted-foreground">
            {displayOwnerName
              ? `Owned by ${displayOwnerName}. `
              : "No owner assigned. "}
            The new owner is notified and inherits issue alerts.
          </p>
        </div>
        {!isOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => setIsOpen(true)}
            data-testid="open-owner-transfer"
          >
            Change owner…
          </Button>
        )}
      </div>

      {isOpen && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={handleSubmit}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="id" value={machineId} />
          <input type="hidden" name="name" value={machineName} />

          {state && !state.ok && state.code !== "ASSIGNEE_NOT_MEMBER" && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <p className="text-sm font-medium">{state.message}</p>
            </div>
          )}

          <OwnerSelect
            users={allUsers}
            defaultValue={currentOwnerId}
            onValueChange={setSelectedOwnerId}
            showHelpText={false}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={cancelTransfer}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={isPending}
              disabled={selectedOwnerId === currentOwnerId}
            >
              Transfer ownership
            </Button>
          </div>
        </form>
      )}

      {/*
       * Promote-and-assign confirmation.
       * Duplicated from create-machine-form.tsx — pending extraction at 3rd
       * consumer.
       *
       * Radix portals DialogContent outside the form tree, so the confirm
       * button cannot implicitly submit the form. We read the live form DOM via
       * formRef, inject forcePromoteUserId, and dispatch the action directly.
       */}
      <Dialog open={isPromoteOpen} onOpenChange={setIsPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to member and assign?</DialogTitle>
            <DialogDescription>
              This updates the user&apos;s role and assigns them as owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p>
              <strong>{promoteAssignee?.name}</strong>
              <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {promoteAssignee?.type === "invited"
                  ? "(INVITED · GUEST)"
                  : "(GUEST)"}
              </span>{" "}
              is currently a guest. Assigning them as owner of{" "}
              <strong>{machineName}</strong> will promote them to member.
            </p>
            <p className="text-sm text-muted-foreground">
              As a member they&apos;ll be able to edit the machine&apos;s
              details and owner requirements.
            </p>
            <Alert>
              <AlertDescription>
                Promotion and assignment run in one transaction — both succeed
                or both roll back.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPromoteOpen(false);
                setPromoteAssignee(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmPromote}>Promote and assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Non-admin owners are handing away their own access. */}
      <AlertDialog
        open={showTransferConfirm}
        onOpenChange={setShowTransferConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              You are transferring ownership of {machineName} to{" "}
              {selectedOwnerName}. You will lose the ability to edit this
              machine. Only an admin can reverse this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmTransfer}
            >
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- 'src/app/(app)/m/[initials]/edit/machine-owner-transfer.test.tsx'`
Expected: PASS, 5 tests.

- [ ] **Step 5: Mount the section on the page**

Add these imports to `page.tsx`:

```tsx
import { getUnifiedUsers } from "~/lib/users/queries";
import { MachineOwnerTransfer } from "./machine-owner-transfer";
```

Extend the concurrent read from Task 2 to three entries and map the users:

```tsx
const [pinballmapTitleName, pbmState, allUsersRaw] = await Promise.all([
  pinballmapTitlePromise,
  canLink ? getPinballMapState() : Promise.resolve(null),
  getUnifiedUsers({ includeEmails: false }),
]);

const allUsers = allUsersRaw.map((u) => ({
  id: u.id,
  name: u.name,
  lastName: u.lastName,
  machineCount: u.machineCount,
  status: u.status,
  role: u.role,
}));

const canEditAnyMachine =
  accessLevel === "admin" || accessLevel === "technician";
const isOwner =
  user.id === machine.ownerId || user.id === machine.invitedOwnerId;
```

Add the section after the Pinball Map `</section>`:

```tsx
{
  /* Danger zone — applies immediately. Machine deletion joins this
          section in PP-o355.25. */
}
<section
  className="space-y-4 border-t border-outline-variant pt-6"
  aria-labelledby="section-danger"
>
  <h2 id="section-danger" className="text-base font-semibold">
    Danger zone
  </h2>
  <div className="rounded-lg border border-destructive/35 px-4 py-2">
    <MachineOwnerTransfer
      machineId={machine.id}
      machineName={machine.name}
      ownerId={machine.ownerId}
      invitedOwnerId={machine.invitedOwnerId}
      ownerName={machine.owner?.name ?? null}
      invitedOwnerName={machine.invitedOwner?.name ?? null}
      allUsers={allUsers}
      canEditAnyMachine={canEditAnyMachine}
      isOwner={isOwner}
    />
  </div>
</section>;
```

- [ ] **Step 6: Verify**

Run: `pnpm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/m/[initials]/edit"
git commit -m "feat(machines): move ownership transfer to a Danger zone with its own submit (PP-o355.19)"
```

---

### Task 4: Switch the entry point, delete the modal, repair the E2E specs

The modal's last consumer goes away, the file is deleted, and every spec that drove the dialog is updated to drive the page.

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx`
- Modify: `e2e/full/technician-role.spec.ts:28,87`
- Modify: `e2e/full/invite-signup.spec.ts:160`
- Modify: `e2e/smoke/responsive-overflow.spec.ts`
- Delete: `src/app/(app)/m/[initials]/update-machine-form.tsx`, `update-machine-form.test.tsx`

- [ ] **Step 1: Point the Edit control at the page**

In `src/app/(app)/m/[initials]/(tabs)/page.tsx`, replace the whole `EditMachineDialog` block with a link. Keep the `data-testid` so existing selectors still resolve:

```tsx
// Edit-machine control lives in the owner card. Editing is a full page
// (/m/[initials]/edit, PP-o355.19) rather than a modal — the sections there
// have different save models, which a single-Save dialog cannot express.
const editControl =
  canEdit && user ? (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="w-full border-outline text-foreground hover:bg-surface-variant"
    >
      <Link
        href={`/m/${machine.initials}/edit`}
        data-testid="edit-machine-button"
      >
        <Pencil className="mr-2 size-4" aria-hidden="true" />
        Edit Machine
      </Link>
    </Button>
  ) : user && editDeniedReason !== null ? (
    <EditButtonWithTooltip reason={editDeniedReason} />
  ) : null;
```

Fix the imports — add `Link`, `Pencil`, `Button`; drop `EditMachineDialog`, `getUnifiedUsers`, and `pinballmapCatalog`:

```tsx
import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Pencil } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { deriveMachineStatus } from "~/lib/machines/status";
import { Button } from "~/components/ui/button";
import { EditButtonWithTooltip } from "../edit-button-tooltip";
```

- [ ] **Step 2: Drop the reads that only the dialog needed**

Still in `(tabs)/page.tsx`, delete the `canEditAnyMachine` / `isOwner` consts (now unused), and replace the three-way `Promise.all` with a single conditional await. This is a real win — the QR-scan landing no longer pays for a full user list or a catalog lookup:

```tsx
// PinballMap linking (bead B / PP-o355.2) gates the maintainer-facing desync
// signal below. The catalog picker itself moved to the edit page
// (PP-o355.19), so this landing no longer resolves the linked title's display
// name or the unified-user list — both were dialog-only reads.
const canLink = checkPermission(
  "machines.pinballmap.link",
  accessLevel,
  ownershipContext
);
const machineStatus = deriveMachineStatus(openIssues);

// The stored PBM snapshot drives the desync signal, which is a maintainer-
// facing alert (it points at a mismatch to resolve). Only read it when the
// viewer may act on it (`canLink`) AND the machine is linked — so the public
// QR-scan landing never pays for (or shows) it. Location-wide singleton.
const pbmState =
  canLink && machine.pinballmapMachineId !== null
    ? await getPinballMapState()
    : null;
```

- [ ] **Step 3: Delete the modal and its test**

```bash
git rm "src/app/(app)/m/[initials]/update-machine-form.tsx" \
       "src/app/(app)/m/[initials]/update-machine-form.test.tsx"
```

The deleted test's description-serialization cases are already covered by Task 1's test. Its four unsaved-changes-guard cases are **deliberately not ported**: they tested a dialog's dismiss vectors (outside-click, Esc, close button), and a page has none. The dirty note in Task 1 replaces the affordance.

- [ ] **Step 4: Verify nothing still imports the modal**

Run: `rg -n "update-machine-form" --glob '!node_modules' --glob '!docs' .`
Expected: exactly one hit — the `create-machine-form.tsx:167` comment, which is prose, not an import. Then run `pnpm run check` and expect PASS.

- [ ] **Step 5: Repair `technician-role.spec.ts`**

Both blocks (lines ~28 and ~87) click the edit button, expect a dialog, and submit "Update Machine". Replace both submit calls and add a URL assertion after the click. At line ~28:

```ts
const editButton = page.getByTestId("edit-machine-button");
await expect(editButton).toBeVisible();
await editButton.click();
await expect(page).toHaveURL(/\/edit$/);
const nameInput = page.getByLabel("Machine Name");
await nameInput.fill(seededMachines.addamsFamily.name);
await page.getByRole("button", { name: "Save details" }).click();
await page.goto(`/m/${seededMachines.addamsFamily.initials}`);
await expect(
  page.getByRole("heading", { name: seededMachines.addamsFamily.name })
).toBeVisible();
```

At line ~87, the same shape:

```ts
    const editButton = page.getByTestId("edit-machine-button");
    await expect(editButton).toBeVisible();
    await editButton.click();
    await expect(page).toHaveURL(/\/edit$/);

    const nameInput = page.getByLabel("Machine Name");
    await nameInput.fill("TAF Technician Edit");
    await page.getByRole("button", { name: "Save details" }).click();

    await page.goto("/m/TAF");
    await expect(
      page.getByRole("heading", { name: "TAF Technician Edit" })
```

The explicit `page.goto` back to the machine replaces the modal's close-and-reveal behaviour: saving on a page leaves you on the page.

- [ ] **Step 6: Repair `invite-signup.spec.ts`**

Ownership now lives behind the Danger-zone disclosure. Replace the block at ~line 159:

```ts
// Open the machine edit page (admin has edit permission)
await page.getByTestId("edit-machine-button").click();
await expect(page).toHaveURL(/\/edit$/);

// Ownership lives in the Danger zone behind a disclosure (PP-o355.19).
await page.getByTestId("open-owner-transfer").click();

// Click the owner dropdown and select the invited user (shown with
// "(INVITED)" suffix). Invited users are hidden by default — toggle the
// checkbox to reveal them.
const ownerSelect = page.getByTestId("owner-select");
await ownerSelect.click();
await page.getByLabel(/Show guests and invited users/i).click();
await page
  .getByRole("option", { name: /Owner Transfer.*\(Invited\)/i })
  .click();

await page.getByRole("button", { name: /^Transfer ownership$/ }).click();
await expect(page.getByTestId("open-owner-transfer")).toBeVisible({
  timeout: 10000,
});
hdOwnerChanged = true;
```

The final assertion replaces "dialog closes": a successful transfer collapses the disclosure, so the "Change owner…" button returns.

- [ ] **Step 7: Add the route to the overflow smoke manifest**

In `e2e/smoke/responsive-overflow.spec.ts`, add one entry to `authenticatedRoutes` (after the `/timeline` line):

```ts
  `/m/${machineInitials}/edit`,
```

This is the cheapest "renders without 500" plus layout-overflow guard for the new page (bug class D).

- [ ] **Step 8: Run the affected specs**

```bash
pnpm exec playwright test e2e/full/technician-role.spec.ts --project=chromium
pnpm exec playwright test e2e/smoke/responsive-overflow.spec.ts --project=chromium
```

Expected: PASS. Run `invite-signup.spec.ts` as a whole file — its describe blocks share state via `beforeAll`, so a single test cannot be run alone:

```bash
pnpm exec playwright test e2e/full/invite-signup.spec.ts --project=chromium
```

Never invoke `pnpm exec playwright test` with no path — it runs every spec in one process and cross-contaminates seed state.

- [ ] **Step 9: Full check and commit**

```bash
pnpm run check
pnpm run smoke
git add -A
git commit -m "feat(machines): route Edit to the new page and delete the modal (PP-o355.19)"
```

---

## Landing

1. `node scripts/workflow/pr-screenshots.mjs <PR>` — this PR is UI-touching, so screenshots are required before it can be called ready. Add `/m/TAF/edit` to the screenshot manifest if it is not picked up automatically.
2. Push, open the PR **ready-for-review**, let CI run the full suite.
3. Record this plan's path + branch in the bead: `bd update PP-o355.19 --design="docs/superpowers/plans/2026-07-25-machine-edit-page-PP-o355.19.md @ feat/machine-edit-page"`.
4. Hand Tim: `! scripts/workflow/merge-pr.sh <PR> --human`. Never merge by any path yourself.
5. Close **PP-o355.19** only after merge. **PP-o355.13** (modal closes on click) is closed by the same merge — its repro path no longer exists. **PP-o355.25** (machine deletion) unblocks.

## Out of Scope — do not do these here

- **Machine deletion** → PP-o355.25. The existing `deleteMachineAction` is dead code that bypasses `checkPermission`, cannot be used by admins, and hard-deletes issue history. Do not wire it.
- **Rebuilding the listing control / moving the catalog title row into the Pinball Map section** → PP-o355.21.
- **Any tie-guard or auto-link behaviour** → PP-o355.15 / PP-o355.20.
- **Extracting the promote-and-assign dialog.** After this PR there are exactly two copies (create-machine-form and owner-transfer), which is the Rule of Three's "wait" case. Leave the existing "pending extraction at 3rd consumer" comment in place.
