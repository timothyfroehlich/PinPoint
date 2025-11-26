# Progressive Enhancement Patterns

## Philosophy: Pragmatic Progressive Enhancement

We believe in **Pragmatic Progressive Enhancement**. This means we prioritize a solid, functional baseline for all users, but we do not let strict "no-JS" requirements hold back the user experience or development velocity for complex, interactive features.

### Core Principles

1.  **Server Actions are the Baseline**: Use Next.js Server Actions for all data mutations. They work without JavaScript by default and are the most robust way to handle form submissions.
2.  **Enhance, Don't Duplicate**: Do not write two separate implementations (one for JS, one for no-JS). Build the Server Action first, then layer on client-side feedback (like toast notifications or optimistic UI) using `useActionState` (React 19).
3.  **Complexity Allowance**: For highly interactive features (e.g., drag-and-drop boards, rich text editors, real-time visualizations), it is acceptable to require JavaScript. In these cases, provide a simple fallback message or a basic read-only view if possible.

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
