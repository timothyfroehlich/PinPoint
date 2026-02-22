---
applyTo: "**/*actions*.ts,src/app/**/actions.ts,src/lib/actions/**/*.ts"
---

# Server Actions Instructions (Mutations & Progressive Enhancement)

## Principles

- Use "use server" directive inside action files or function bodies when required.
- Actions encapsulate validation + mutation + response shaping.
- Progressive enhancement: forms submit directly to Server Actions without JS reliance.

## Validation Pattern

```ts
"use server";
import { z } from "zod";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

const createIssueSchema = z.object({
  machineId: z.string().uuid(),
  title: z.string().min(1),
  severity: z.enum(["minor", "playable", "unplayable"]),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export async function createIssue(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const raw = {
    machineId: formData.get("machineId"),
    title: formData.get("title"),
    severity: formData.get("severity"),
  };
  const parsed = createIssueSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  await db.insert(issues).values({
    machine_id: parsed.data.machineId,
    title: parsed.data.title,
    severity: parsed.data.severity,
  });
  return { ok: true };
}
```

## Return Type Requirements

- Explicit return types for exported actions.
- Use simple result envelopes: `{ ok: boolean; error?: string }` or domain-specific payloads logically.

## Error Handling

- Provide generic user-facing errors; avoid leaking stack traces.
- Do not throw raw DB errors to client—wrap or return structured error field.

## Cache Interaction

- After mutations that affect read views, call `revalidatePath()` on relevant route segments.
- Avoid premature global cache invalidation—targeted paths only.

## Permissions Matrix Sync (CORE-ARCH-008)

- When adding or changing authorization checks in server actions, update `src/lib/permissions/matrix.ts` to match.
- The help page `/help/permissions` is auto-generated from the matrix — drift causes users to see incorrect capability information.
- `true` = unconditional access, `"own"` = only resources the user created. Verify these match the actual `if` checks.

## Forbidden Patterns

- Multi-tenant permission checks (obsolete).
- Deep client-side state management replacements (actions should stay server-focused).
- Mixing heavy business logic and validation—extract pure helpers if complexity grows.

## Progressive Enhancement Form Pattern

```tsx
// In a Server Component
import { createIssue } from "./actions";

export default async function NewIssuePage({
  machineId,
}: {
  machineId: string;
}) {
  return (
    <form action={createIssue} className="space-y-4">
      <input type="hidden" name="machineId" value={machineId} />
      <input name="title" required className="input" />
      <select name="severity" required>
        <option value="minor">Minor</option>
        <option value="playable">Playable</option>
        <option value="unplayable">Unplayable</option>
      </select>
      <button type="submit" className="btn">
        Create Issue
      </button>
    </form>
  );
}
```

## Testing Guidance

- Integration tests simulate form submission by constructing `FormData` and calling the action.
- Unit test pure validation logic if extracted.
- Avoid per-test DB instances (worker-scoped only).

## Copilot Should NOT Suggest

- tRPC procedure wrappers.
- Organization scoping or RLS logic.
- Client-side fetch POST wrappers when a form action suffices.

---

Last Updated: 2025-11-09
