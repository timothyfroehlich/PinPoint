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

Use the `useActionState` hook (formerly `useFormState`) to handle form submissions with progressive enhancement automatically. This replaces older patterns like "Flash Messages" stored in cookies.

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

### Key Takeaways

- **✅ DO**: Use `<form action={serverAction}>`.
- **✅ DO**: Use `useActionState` for feedback and validation errors.
- **❌ DON'T**: Manually `fetch()` to API routes unless absolutely necessary.
- **❌ DON'T**: Rely on complex cookie-based "Flash Messages" for simple form feedback.
