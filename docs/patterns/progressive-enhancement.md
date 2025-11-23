# Progressive Enhancement Patterns

## Forms That Work Without JavaScript

```typescript
// Server Action form (works without JS)
export default async function CreateMachineForm() {
  return (
    <form action={createMachineAction}>
      <input name="name" required />
      <button type="submit">Create Machine</button>
    </form>
  );
}

// Enhanced with Client Component for better UX (optional)
"use client";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create Machine"}
    </button>
  );
}
```

**Key points**:

- Forms must work without JavaScript (CORE-ARCH-002)
- Use Server Actions with `<form action={serverAction}>`
- Never wrap Server Actions in inline async functions (breaks serialization)
- Enhance with Client Components for loading states (optional)
- Use `useFormStatus()` hook for pending state
