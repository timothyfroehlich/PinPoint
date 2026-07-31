# Server Action Form Patterns

## Philosophy

**JavaScript is required.** PinPoint is an authenticated tool for the members of one physical club, on known devices, on the club's own wifi. No surface is required to work with JavaScript disabled, and no work is owed to preserve that mode. The progressive-enhancement non-negotiable (002) was retired on 2026-07-27 after an audit found it measured a proxy that had stopped correlating with whether a user could finish the task — see `docs/superpowers/specs/2026-07-27-core-arch-002-scope-design.md` (PP-nw80).

What survives is the architecture, which was never justified by no-JS support:

### Core Principles

1.  **Server Actions are the mutation path**: Use Next.js Server Actions for all data mutations — not `onSubmit` + `fetch` to an API route. Reference them directly, never through an inline wrapper (CORE-ARCH-005).
2.  **Enhance, Don't Duplicate**: Build one implementation. Layer client-side feedback (toasts, optimistic UI) on top with `useActionState` (CORE-ARCH-007).
3.  **Fail honestly**: When a control cannot perform its action, let it visibly do nothing or surface a real error. Never confirm success for a submission whose input could not have been collected (CORE-ARCH-012).

## Modern Patterns

### Forms with `useActionState`

Use the `useActionState` hook to handle form submission state — pending, errors, success — in one place. This replaces older patterns like "Flash Messages" stored in cookies.

```tsx
"use client";

import { useActionState } from "react";
import { createMachineAction } from "./actions";

const initialState = {
  message: "",
};

export function CreateMachineForm() {
  const [state, formAction] = useActionState(createMachineAction, initialState);

  return (
    <form action={formAction}>
      <input name="name" required />
      <button type="submit">Create Machine</button>
      {state?.message && <p aria-live="polite">{state.message}</p>}
    </form>
  );
}
```

### Any form containing a Radix Select: dispatch directly, not via `action={...}`

**This is the single biggest footgun in this codebase.** It caused a P0 (PP-0fvr) and four more live data-loss bugs (PP-1ajq).

`@radix-ui/react-select` >= 2.3.3 attaches a form-`reset` listener that replays `onValueChange` with the Select's **mount-time** value. React 19 auto-resets a `<form action={...}>` once the action settles — **on failure as well as success**, since React only sees that the action returned. Put those together and every Radix Select in the form snaps back about a second after submit.

The remedy is to remove the native submission path: build `FormData` by hand and call the `useActionState` dispatch directly inside `startTransition`. No form submission ever completes, so React never fires the reset.

```tsx
const dispatchForm = (): void => {
  if (!formRef.current) return;
  const fd = new FormData(formRef.current);
  startTransition(() => {
    formAction(fd);
  });
};
```

How it surfaced in each shape:

- **Auto-submitting from `onValueChange`** (the four inline issue-metadata forms, PP-0fvr): the replay looked like a real user selection and fired a **second write carrying the stale value** — silently reverting every status/priority/severity/frequency change.
- **Submitting from a real button** (edit-machine, create-machine, unified-report, delete-account — PP-1ajq): no bad write, but a **failed** save silently wiped unsaved edits while the form was still on screen. Worst case was delete-account, where a reverted machine-reassignment left the confirmation text intact and the destructive button enabled.
- **A form with no Select at all** (machine owner transfer, `src/app/(app)/m/[initials]/(tabs)/edit/machine-owner-transfer.tsx` — PP-o355.19): the heading says "any form containing a Radix Select" because that is the common case, but **Radix is only one symptom riding on React's reset**. Here a native reset blanked the form's _controlled_ hidden `id`/`name` inputs in the DOM without re-rendering React — the state behind them never changed, so React had no reason to re-sync — leaving a second attempt after a failed transfer to submit an **empty machine id**. If your form carries controlled hidden inputs, it has this bug whether or not a Select is anywhere near it.

Three things worth knowing before you try to fix this some other way:

- **Making the Select controlled does not help.** Radix's replay calls `onValueChange`, so the stale value is written straight into your state.
- **Mocking `useActionState` is why this stayed invisible to a green suite for five days.** The regression guards (`src/test/unit/components/{issues,machines,settings,report}/*revert*.test.tsx`, plus the co-located `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx`) deliberately mock neither `react` nor the Select wrappers. Keep it that way.
- **"No Select" is not a clean bill of health.** See the owner-transfer case above — reach for this remedy whenever a form's values live anywhere React won't re-render on reset, not just when Radix is present.

Success-path resets are a separate concern — see [CREATE Form Reset Pattern](./create-form-reset.md).

### Key Takeaways

- **✅ DO**: Use `<form action={serverAction}>` — **unless the form contains a Radix Select**, in which case dispatch directly (above).
- **✅ DO**: Use `useActionState` for feedback and validation errors.
- **❌ DON'T**: Manually `fetch()` to API routes unless absolutely necessary.
- **❌ DON'T**: Rely on complex cookie-based "Flash Messages" for simple form feedback.
- **❌ DON'T**: Mock `useActionState` in a test meant to catch form-reset regressions.
