# Unsaved-Changes Guard for the Machine Manage Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the machine Manage tab from silently discarding typed edits when the user navigates away, restoring the discard-confirm the Edit modal had before PP-o355.19 replaced it with a page.

**Architecture:** Two independent listeners on `MachineDetailsForm`, both armed only while the form is dirty: a `beforeunload` handler for exits that unload the document (reload, tab close, off-site links), and a capture-phase `click` listener on `document` that intercepts same-origin in-app `<Link>` navigation — which `beforeunload` never sees, because App Router navigations never unload the document. An intercepted click parks its destination in state and opens a Radix `AlertDialog` reusing the exact copy the old modal used; confirming clears dirtiness and completes the trip via `router.push`.

**Tech Stack:** React 19 (`useEffect`, `useState`), Next.js App Router (`next/navigation` `useRouter`), Radix `AlertDialog` via `~/components/ui/alert-dialog`, Vitest + React Testing Library (jsdom).

## Global Constraints

- **Bead:** PP-o355.19. Branch `feat/machine-edit-page`, PR #1762. All work happens in the worktree `/Users/froeht/Code/PinPoint/.claude/worktrees/pbm-list-unlist` — never the root checkout.
- **Baseline Widely available is the UI floor** (CORE-UI-005/006): use `event.preventDefault()` on `BeforeUnloadEvent`. Do **not** set the legacy `event.returnValue`, and do **not** return a string from the handler — both are deprecated, and neither is needed on any browser this project supports.
- **No custom text in the `beforeunload` prompt.** Browsers have ignored custom strings for a decade; the wording is the browser's. Any test asserting on prompt text is testing the browser.
- **Honest failure** (CORE-ARCH-012): a guard that silently fails to guard is worse than no guard. Where a vector genuinely cannot be intercepted (see Task 4), document it in code rather than pretending coverage.
- **`"use client"`** is already at the top of `machine-details-form.tsx`; do not add a new client boundary.
- **Do not modify `RouteTabStrip` or `MachineTabStrip`.** They are shared by every machine page; see "Approach rejected" below.
- **Type safety** (CORE-TS-007): ts-strictest. No `any`, no non-null `!`, no unsafe `as`. `event.target` is `EventTarget | null` and must be narrowed with `instanceof Element` before `.closest()`.
- **Run `pnpm run check`** (~12s) before every commit. This task touches no server action, migration, or middleware, so `preflight` is **not** required.
- **Test layer** (CORE-TEST-005): this is class C/H — form-state and UI logic. It belongs in **RTL unit tests**, co-located at `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx`. Do **not** write an E2E spec for it.
- **Every test must be verified red before its fix.** Comment out the implementation, watch the test fail with a meaningful message, restore it. A test that passes against the unfixed code is not a guard.

---

## Context an implementer needs

### What broke and why it wasn't caught

PP-o355.19 converted the machine Edit **modal** into the Manage **tab**. The modal guarded discards through a single controlled `onOpenChange`, which every dismiss vector (Esc, outside click, the X) funnelled through:

```tsx
// The DELETED src/app/(app)/m/[initials]/update-machine-form.tsx, for reference:
const handleOpenChange = (next: boolean): void => {
  if (!next && isDirty && !isPending) {
    setShowDiscardConfirm(true);
    return;
  }
  setOpen(next);
};
```

The conversion dropped it, justified in the plan with "a page has no dismiss vector." That is wrong in a specific way: a page has no _dismiss_ vector but it has _navigation_ vectors, and `MachineTabStrip` renders Info / Settings / Service / Timeline links **directly above this form**. Typing a paragraph of Description and clicking "Info" discards it with no prompt.

### Why the existing dirty state is trustworthy

`isDirty` is already correct and is **not** part of this work. It is set by three things, all already in place:

- `onInput` on the `<form>` — covers every native input, including the TipTap contenteditable, whose `input` events bubble.
- An explicit `onValueChange` on the Availability Radix `Select`, which does not bubble `input`.
- The `onDirty` callback from `PinballMapLinkField`, for the cmdk items and the edition `Select`.

It is cleared by `handleCancel` and by the success effect. Trust it.

### The DOM you are intercepting

`MachineTabStrip` → `RouteTabStrip` (`src/components/layout/RouteTabStrip.tsx:122`) renders `next/link` `<Link>`, which emits a real `<a href="...">` into the DOM. A capture-phase `click` listener on `document` therefore sees the click **before** Next's own handler, and `preventDefault()` + `stopPropagation()` stops the navigation.

### Approach rejected, and why

The "clean" alternative is a React context that `RouteTabStrip` consumes to ask permission before navigating. It is rejected here: `RouteTabStrip` is shared by every machine page and several others, so a guard-aware prop or context spreads a one-page concern across a shared layout component, and every consumer then has to opt out. The document-level listener is uglier in isolation but has **zero blast radius** — it exists only while this one form is dirty, and unregisters itself the moment it isn't.

---

## File Structure

| File                                                                   | Responsibility                                                                         | Change                                  |
| :--------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :-------------------------------------- |
| `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx`      | Owns the guard: both listeners, the pending-destination state, and the confirm dialog. | Modify                                  |
| `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx` | RTL guards for both vectors and the pass-through cases.                                | Modify (extend the existing `describe`) |

No new files. The guard is ~70 lines in one component with one consumer; extracting a `useUnsavedChangesGuard` hook now would be premature (CORE-ARCH-010, Rule of Three — this is use #1). If a second form needs it, extract then, and Tim's refinement applies: DRY at **two** when the shared thing is large or load-bearing.

---

### Task 1: `beforeunload` for document-unloading exits

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx`
- Test: `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx`

**Interfaces:**

- Consumes: the existing `isDirty` state (`useState<boolean>`) already declared in this component.
- Produces: nothing other components use. Task 2 adds a second, independent `useEffect` beside this one.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe("MachineDetailsForm", ...)` block in `machine-details-form.test.tsx`. Note the helper dispatches a **cancelable** event — jsdom will not report `defaultPrevented` on a non-cancelable one, and the test would pass vacuously.

```tsx
/** Dispatch a cancelable beforeunload and report whether anything blocked it. */
function beforeUnloadWasBlocked(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

it("does not block unload when the form is untouched", () => {
  render(<MachineDetailsForm {...baseProps} />);
  expect(beforeUnloadWasBlocked()).toBe(false);
});

it("blocks unload once the form is dirty", async () => {
  const user = userEvent.setup();
  render(<MachineDetailsForm {...baseProps} />);

  await user.type(screen.getByLabelText(/Machine Name/), "!");

  expect(beforeUnloadWasBlocked()).toBe(true);
});

it("stops blocking unload after Cancel reverts the edits", async () => {
  const user = userEvent.setup();
  render(<MachineDetailsForm {...baseProps} />);

  await user.type(screen.getByLabelText(/Machine Name/), "!");
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(beforeUnloadWasBlocked()).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run 'src/app/\(app\)/m/\[initials\]/\(tabs\)/edit/machine-details-form.test.tsx'`

Expected: "blocks unload once the form is dirty" FAILS with `expected false to be true`. The other two PASS already (nothing registers a handler yet) — that is fine; they are the pass-through guards that stop a later over-eager implementation from blocking unload permanently.

- [ ] **Step 3: Add the effect**

Insert immediately after the existing "A successful save makes the submitted values the new baseline" `useEffect` (around line 98):

```tsx
/**
 * Unsaved-changes guard, part 1 of 2: exits that unload the document —
 * reload, tab close, and off-site links.
 *
 * Armed only while dirty. A permanently-registered handler makes every
 * navigation slower and is treated as abuse by some browsers, so the
 * subscription itself is the signal.
 *
 * The prompt's wording belongs to the browser; custom strings have been
 * ignored for a decade, so `preventDefault()` is the whole API.
 */
useEffect(() => {
  if (!isDirty) return;
  const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}, [isDirty]);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run 'src/app/\(app\)/m/\[initials\]/\(tabs\)/edit/machine-details-form.test.tsx'`

Expected: PASS, all three.

- [ ] **Step 5: Confirm the guard is real**

Comment out the `window.addEventListener` line, re-run, and confirm "blocks unload once the form is dirty" fails with `expected false to be true`. Restore it.

- [ ] **Step 6: Run the full check and commit**

```bash
FORCE_MEM_PRECHECK=skip pnpm run check
git add "src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx" "src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx"
git commit -m "feat(machines): warn before unloading the Manage tab with unsaved edits (PP-o355.19)"
```

---

### Task 2: Intercept in-app link navigation and confirm before discarding

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx`
- Test: `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx`

**Interfaces:**

- Consumes: `isDirty` (Task 1's dependency, unchanged), and `useRouter` from `next/navigation`.
- Produces: `pendingHref: string | null` state — non-null exactly while the confirm dialog is open, holding the destination as a root-relative path (`/m/TAF/settings?x=1#y`). Task 3 asserts on the dialog this drives.

- [ ] **Step 1: Mock `next/navigation` and write the failing tests**

Add the mock at the **top** of the test file, beside the existing `vi.mock` calls. `pushMock` must be `vi.hoisted` because `vi.mock` factories are hoisted above module-level `const`s:

```tsx
const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
}));
```

Add `pushMock.mockClear();` to the existing `beforeEach`.

Then add this nested block at the end of the outer `describe`:

```tsx
describe("unsaved-changes navigation guard", () => {
  /** A tab-strip-style link rendered as a sibling, like RouteTabStrip's. */
  function renderWithTabLink(): void {
    render(
      <>
        <a href="/m/TAF/settings">Settings</a>
        <MachineDetailsForm {...baseProps} />
      </>
    );
  }

  it("lets a link through when the form is untouched", async () => {
    const user = userEvent.setup();
    renderWithTabLink();

    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(
      screen.queryByText("Discard unsaved changes?")
    ).not.toBeInTheDocument();
  });

  it("intercepts a link and asks before discarding", async () => {
    const user = userEvent.setup();
    renderWithTabLink();

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(
      await screen.findByText("Discard unsaved changes?")
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("stays put and keeps the edits when the user keeps editing", async () => {
    const user = userEvent.setup();
    renderWithTabLink();

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.click(
      await screen.findByRole("button", { name: "Keep editing" })
    );

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Machine Name/)).toHaveValue(
      "Godzilla (Premium)!"
    );
  });

  it("completes the navigation when the user discards", async () => {
    const user = userEvent.setup();
    renderWithTabLink();

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.click(
      await screen.findByRole("button", { name: "Discard changes" })
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/m/TAF/settings");
    });
  });

  it("lets a modified click through — it opens a new tab, so nothing is lost", async () => {
    const user = userEvent.setup();
    renderWithTabLink();

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.keyboard("{/Meta}");

    expect(
      screen.queryByText("Discard unsaved changes?")
    ).not.toBeInTheDocument();
  });

  it("lets a link to the current page through", async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="/">Here</a>
        <MachineDetailsForm {...baseProps} />
      </>
    );

    await user.type(screen.getByLabelText(/Machine Name/), "!");
    await user.click(screen.getByRole("link", { name: "Here" }));

    expect(
      screen.queryByText("Discard unsaved changes?")
    ).not.toBeInTheDocument();
  });
});
```

Note on the last test: jsdom's default URL is `http://localhost:3000/`, so `href="/"` is the current path and must pass through untouched.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run 'src/app/\(app\)/m/\[initials\]/\(tabs\)/edit/machine-details-form.test.tsx'`

Expected: the four interception tests FAIL with `Unable to find an element with the text: Discard unsaved changes?` (or, for the discard test, `pushMock` never called). The two pass-through tests PASS already.

- [ ] **Step 3: Add the imports and state**

Add to the import block at the top of `machine-details-form.tsx`:

```tsx
import { useRouter } from "next/navigation";
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
```

Add beside the other `useState` declarations, after `shownState`:

```tsx
const router = useRouter();
// Non-null exactly while the discard dialog is open; holds where the user
// was heading so "Discard changes" can finish the trip.
const [pendingHref, setPendingHref] = useState<string | null>(null);
```

- [ ] **Step 4: Add the interception effect**

Place it immediately after Task 1's `beforeunload` effect:

```tsx
/**
 * Unsaved-changes guard, part 2 of 2: in-app navigation.
 *
 * `MachineTabStrip` renders Info/Settings/Service/Timeline links directly
 * above this form (via `RouteTabStrip`, which emits real `next/link`
 * anchors). App Router navigations never unload the document, so
 * `beforeunload` cannot see them — one click used to discard a paragraph of
 * Description with no prompt. App Router exposes no navigation-guard API, so
 * the click itself is the only seam.
 *
 * Capture phase, so this runs before Next's own handler. Registered on
 * `document` rather than the form because the links are OUTSIDE this
 * component's subtree — and unregistered the moment the form is clean, so it
 * has no reach beyond the window where there is something to lose.
 */
useEffect(() => {
  if (!isDirty) return;
  const handleClick = (event: MouseEvent): void => {
    // A modified or non-primary click opens a new tab or window, so THIS
    // document — and the edits in it — survives. Let it through.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    // Opens elsewhere, or downloads without navigating.
    if (anchor.target !== "" && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;

    const destination = new URL(anchor.href, window.location.href);
    // Off-site: the document unloads, so `beforeunload` already covers it.
    if (destination.origin !== window.location.origin) return;
    // Same page (including a bare fragment): discards nothing.
    if (
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setPendingHref(
      `${destination.pathname}${destination.search}${destination.hash}`
    );
  };
  document.addEventListener("click", handleClick, true);
  return () => {
    document.removeEventListener("click", handleClick, true);
  };
}, [isDirty]);
```

- [ ] **Step 5: Add the confirm handlers**

Add beside `handleCancel`:

```tsx
const keepEditing = (): void => {
  setPendingHref(null);
};

const discardAndLeave = (): void => {
  const destination = pendingHref;
  setPendingHref(null);
  // Clear dirtiness FIRST so both listeners unsubscribe before the
  // navigation starts — otherwise the guard is still armed on the way out.
  setIsDirty(false);
  if (destination !== null) router.push(destination);
};
```

- [ ] **Step 6: Render the dialog**

The component currently returns a bare `<form>`. Wrap the return in a fragment and add the dialog as a sibling **after** the closing `</form>`, so the dialog is never a descendant of the form it guards (a nested submit button inside a form is a real footgun; `AlertDialogAction` renders a `<button>`).

```tsx
{
  /* Copy is carried over verbatim from the Edit modal this page replaced,
          so the choice reads identically to anyone who used the old dialog. */
}
<AlertDialog
  open={pendingHref !== null}
  onOpenChange={(open) => {
    if (!open) keepEditing();
  }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
      <AlertDialogDescription>
        You&apos;ve made changes to {name} that haven&apos;t been saved. Leaving
        now will discard them.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={keepEditing}>Keep editing</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={discardAndLeave}>
        Discard changes
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>;
```

`name` is already a prop of this component — do not add one.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run 'src/app/\(app\)/m/\[initials\]/\(tabs\)/edit/machine-details-form.test.tsx'`

Expected: PASS, all of them — including every test from before this plan started. If the pre-existing "restores the original name, availability, and description on Cancel" test now fails, the fragment wrapping in Step 6 is malformed; fix that rather than the test.

- [ ] **Step 8: Confirm the guard is real**

Comment out `event.preventDefault();` and `setPendingHref(...)` in the effect, re-run, confirm "intercepts a link and asks before discarding" fails. Restore.

- [ ] **Step 9: Run the full check and commit**

```bash
FORCE_MEM_PRECHECK=skip pnpm run check
git add "src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx" "src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx"
git commit -m "feat(machines): confirm before in-app navigation discards Manage edits (PP-o355.19)"
```

---

### Task 3: Fix the "Saved" note lying about in-flight edits

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx:94-98`
- Test: `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx`

**Interfaces:**

- Consumes: `isDirty`, and the existing `useActionState` `state`.
- Produces: nothing new. This narrows an existing effect.

**Why this is in the same plan:** it is the third finding from the same review, and it compounds Task 2 directly. The success effect clears dirtiness when the _action returns_, not for the _snapshot that was submitted_, and the inputs are not disabled while saving. Keep typing during the round trip and the note flips to "Saved" over edits that were never in the submitted `FormData` — and because `isDirty` is now what arms the guard, those edits also lose their protection and vanish on the next click.

- [ ] **Step 1: Write the failing test**

```tsx
it("keeps guarding edits made while a save is in flight", async () => {
  // The action resolves only when we say so, so we can type mid-flight.
  let resolveSave: (value: UpdateMachineResult) => void = () => undefined;
  vi.mocked(updateMachineAction).mockReturnValue(
    new Promise<UpdateMachineResult>((resolve) => {
      resolveSave = resolve;
    })
  );
  const user = userEvent.setup();
  render(<MachineDetailsForm {...baseProps} />);

  await user.type(screen.getByLabelText(/Machine Name/), "!");
  await user.click(screen.getByRole("button", { name: "Save details" }));

  // Typed AFTER the FormData snapshot was taken — never submitted.
  await user.type(screen.getByLabelText(/Machine Name/), "?");
  resolveSave(ok({ machineId: baseProps.machineId }));

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Save details" })
    ).not.toBeDisabled();
  });

  expect(screen.getByTestId("details-dirty-note")).toHaveTextContent(
    "Unsaved changes"
  );
});
```

Add `import type { UpdateMachineResult } from "~/app/(app)/m/actions";` to the test file's imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run 'src/app/\(app\)/m/\[initials\]/\(tabs\)/edit/machine-details-form.test.tsx' -t "in flight"`

Expected: FAIL — the note reads "Saved".

- [ ] **Step 3: Track the submitted snapshot**

Add beside the other state:

```tsx
// Bumped on every submit; the value captured at dispatch identifies WHICH
// snapshot a settling action belongs to.
const submitSeqRef = useRef(0);
const inFlightSeqRef = useRef(0);
```

In `handleSubmit`, immediately after `const fd = new FormData(formRef.current);`:

```tsx
submitSeqRef.current += 1;
inFlightSeqRef.current = submitSeqRef.current;
```

Then replace the success effect:

```tsx
// A successful save makes the SUBMITTED values the new baseline — but only
// those. Anything typed after the snapshot was taken is still unsaved, and
// clearing dirtiness for it would both mislabel the note "Saved" and disarm
// the navigation guard protecting it (PP-o355.19 review).
useEffect(() => {
  if (state?.ok && submitSeqRef.current === inFlightSeqRef.current) {
    setIsDirty(false);
  }
}, [state]);
```

Finally, mark the form dirty-since-submit by bumping `submitSeqRef` on input. Change the form's `onInput`:

```tsx
      onInput={() => {
        setIsDirty(true);
        // Typing after a dispatch means the in-flight snapshot is already
        // stale, so its success must not clear dirtiness.
        submitSeqRef.current += 1;
      }}
```

and add the same `submitSeqRef.current += 1;` beside `setIsDirty(true)` in the Availability `onValueChange` and in the `onDirty` handler passed to `PinballMapLinkField`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `FORCE_MEM_PRECHECK=skip pnpm exec vitest run 'src/app/\(app\)/m/\[initials\]/\(tabs\)/edit/machine-details-form.test.tsx'`

Expected: PASS, all — including the pre-existing "shows an unsaved-changes note once a field is edited" and the Task 1/2 tests. The plain save path still clears dirtiness because nothing bumped the sequence between dispatch and settle.

- [ ] **Step 5: Confirm the guard is real**

Revert the effect to `if (state?.ok)`, re-run, confirm the in-flight test fails. Restore.

- [ ] **Step 6: Run the full check and commit**

```bash
FORCE_MEM_PRECHECK=skip pnpm run check
git add "src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx" "src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx"
git commit -m "fix(machines): stop a save marking mid-flight edits as Saved (PP-o355.19)"
```

---

### Task 4: Document the Back-button gap honestly

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx` (comment only)

**Interfaces:** none.

**Why a task and not a fix:** the browser Back button inside the app fires `popstate`, which is **not cancellable** — `preventDefault()` on it does nothing. The only way to guard it is to push a sentinel history entry on mount and re-push it on every `popstate`, which means the user's Back button stops working while the form is dirty. That failure mode — a user who cannot leave — is worse than the one it prevents, and it breaks in ways that are very hard to test. `beforeunload` **does** cover Back when it leaves the origin; only same-app Back is exposed.

CORE-ARCH-012 is about not claiming to have done something you haven't. A guard that covers two of three vectors while reading as complete is that same failure in comment form.

- [ ] **Step 1: Add the note to the part-2 docblock**

Append inside the "part 2 of 2" comment added in Task 2:

```tsx
   * KNOWN GAP — the browser Back button within the app. It fires `popstate`,
   * which is not cancellable; guarding it requires pushing a sentinel history
   * entry and re-pushing on every pop, which breaks the Back button for as long
   * as the form is dirty. A user who cannot leave is a worse bug than the one
   * that fixes, so Back still discards silently. (`beforeunload` does cover
   * Back when it leaves the origin — only same-app Back is exposed.) Revisit if
   * this is observed in real use; do not "fix" it speculatively.
```

- [ ] **Step 2: Run the full check and commit**

```bash
FORCE_MEM_PRECHECK=skip pnpm run check
git add "src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.tsx"
git commit -m "docs(machines): record why same-app Back is not guarded (PP-o355.19)"
```

---

### Task 5: Re-shoot screenshots and hand off

**Files:** none in git.

- [ ] **Step 1: Confirm the local stack is up**

```bash
pnpm run dev:status
```

If Supabase is down, `supabase start` from this worktree. If Next is down, `pnpm run dev`. Note that `dev:status` reports Supabase as down when only the non-core containers are stopped — confirm with `curl -fsS http://localhost:54921/auth/v1/health` before restarting anything.

- [ ] **Step 2: Push, then re-shoot at the new head**

```bash
git push
FORCE_MEM_PRECHECK=skip node scripts/workflow/pr-screenshots.mjs 1762
```

The script posts the sticky comment successfully and **then throws** `Unexpected token 'h', "https://gi"... is not valid JSON` on parsing the response (PP-5hxi). That error is expected and is **not** a failure — verify by reading the comment back:

```bash
gh api repos/timothyfroehlich/PinPoint/issues/comments/5091235503 \
  --jq '{sha:(.body|capture("(?<s>[0-9a-f]{7,40})").s), imgs:([.body|scan("!\\[")]|length), fails:([.body|scan("capture failed")]|length)}'
```

Expect `imgs: 18`, `fails: 0`, and `sha` matching the new head. A `capture failed` cell is usually a cold Turbopack compile — warm the routes with `curl` and re-run the **whole** script. Never re-run with `--pages`: it rebuilds the comment from only those pages and drops the rest.

- [ ] **Step 3: Watch CI**

```
Monitor(command: "./scripts/workflow/pr-watch.py 1762", persistent: false, timeout_ms: 3600000)
```

If it reports a Supabase container-start failure (`failed to bind host port ... address already in use`), that is the known `supabase-start` infra flake, not this change — log it before re-running:

```bash
bash scripts/workflow/log-gha-flake.sh 1762 <run-id> supabase-start "<symptom>"
```

- [ ] **Step 4: Hand off — do not merge**

Merging is human-only via **every** path (PP-wi85). Do not run `gh pr merge`, MCP `merge_pull_request`, or `scripts/workflow/merge-pr.sh` — not even `--dry-run`. `mark-claude-review.sh` is also blocked for agents by the auto-mode classifier, so the review attestation is Tim's to run too.

Once CI is green and screenshots are posted, give Tim both commands and stop:

```
! scripts/workflow/mark-claude-review.sh 1762 "<one-line findings summary>"
! scripts/workflow/merge-pr.sh 1762 --human
```

Leave PP-o355.19 and PP-o355.13 **open** — a code-tied bead closes when its PR merges, not when it is pushed.

---

## Self-Review

**Spec coverage.** The source "spec" here is the medium code review's findings 2 and 3. Finding 2 (no unsaved-changes guard) → Tasks 1, 2, 4. Finding 3 (in-flight edits marked "Saved") → Task 3. Finding 4 (`PinballmapListingControl` unreferenced) is informational and already answered by the corrected docblock in commit `52291f99`; no task. Findings 1 is already fixed in `7de0a299`.

**Placeholder scan.** No TBDs. Every code step carries the literal code to write; every test step carries the literal test and the exact command plus expected output.

**Type consistency.** `pendingHref: string | null` is introduced in Task 2 Step 3 and consumed in Steps 5 and 6 under the same name and type. `keepEditing` / `discardAndLeave` are defined in Step 5 and referenced in Step 6. `submitSeqRef` / `inFlightSeqRef` are introduced and used only within Task 3. `beforeUnloadWasBlocked` is defined in Task 1 Step 1 and reused in the same file thereafter. `pushMock` is `vi.hoisted` in Task 2 Step 1 and asserted in the same block.

**One gap accepted deliberately:** same-app Back (Task 4), documented in code rather than half-guarded.

---

## Execution Handoff

Plan saved to `/Users/froeht/Code/PinPoint/.claude/worktrees/pbm-list-unlist/docs/superpowers/plans/2026-08-01-unsaved-changes-guard-PP-o355.19.md`.

Tasks 1–4 all modify the same two files, so they must run **sequentially** — never dispatch them in parallel. Task 5 runs after all four land.
