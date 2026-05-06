# CREATE Form Reset Pattern

**Last updated**: 2026-05-03 (PP-rvv)

## When to use

Apply this pattern to any CREATE form (not edit forms — those typically navigate
or close on success). It guarantees that every field — native and React-controlled
— returns to its empty state on success, before any redirect.

## The rule

A CREATE form is "fully reset" when, on successful submit:

1. The Server Action **returns** `ok({ ..., redirectTo })` — it does **not** call
   `redirect()` server-side.
2. A `useEffect` in the form watches `state?.ok` (or `state.success`) and runs:
   - `formRef.current?.reset()` — clears all native uncontrolled inputs
   - explicit `setState("")` / `setState(null)` for every controlled field
   - a key bump on uncontrolled child editors (e.g. `RichTextEditor`) to remount
     them
3. **Then**, finally, `window.location.assign(state.value.redirectTo)` (or the
   action's equivalent).

The "return-redirect" requirement (item 1) is the load-bearing piece. When a
Server Action calls `redirect()` server-side, Next.js throws a redirect error
that propagates **before** `useActionState` returns success to the client, so
the cleanup `useEffect` never fires. Returning `redirectTo` shifts the redirect
to the client and lets cleanup run first.

## Canonical references

The cleanest existing examples (no special edge cases):

- `src/components/issues/AddCommentForm.tsx` — Result type, stays mounted on
  success, `formRef.reset()` + clear controlled state.
- `src/components/users/InviteUserDialog.tsx` — uses `react-hook-form`'s
  `form.reset()` (which handles both native + RHF state in one call) plus a
  `useEffect` that resets when the dialog closes.

## Why both `formRef.reset()` and explicit `setState` are needed

| Field type                                                | Cleared by `formRef.reset()`?                              |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Native `<input>`, `<textarea>`, `<select>` (uncontrolled) | ✅                                                         |
| Native fields rendered with `value={...}` (controlled)    | ❌ — React re-renders the value back                       |
| shadcn/ui `Select`                                        | ❌ — internal state is React, hidden input is React-driven |
| `RichTextEditor` (TipTap) `content` prop                  | ❌ — internal editor state must be remounted via `key`     |
| Image-upload arrays (`useState<ImageMetadata[]>`)         | ❌ — pure React state                                      |

So both passes are required: native reset clears the form's DOM state, and
explicit `setState` clears React's view of every controlled field.

## Action shape

```ts
// Result-style (preferred for new actions)
export type CreateThingResult = Result<
  { thingId: string; redirectTo: string },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER",
  ...
>;

// Inside the action, on success:
return ok({ thingId: thing.id, redirectTo: `/things/${thing.slug}` });
```

```ts
// ActionState-style (used by `submitPublicIssueAction`)
export interface ActionState {
  error?: string;
  success?: boolean;
  redirectTo?: string;
}

return { success: true, redirectTo: target };
```

Either shape works — pick whichever matches the rest of the action surface you
own. The form's effect just reads `state.ok` / `state.success` and the
redirect-URL field.

## Form skeleton

```tsx
"use client";

export function CreateThingForm(): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createThingAction,
    undefined
  );

  // Controlled fields
  const [name, setName] = useState("");
  const [body, setBody] = useState<ProseMirrorDoc | null>(null);
  const [editorKey, setEditorKey] = useState(0); // remount RichTextEditor on reset

  // Reset before navigating away on success.
  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setName("");
    setBody(null);
    setEditorKey((k) => k + 1);
    window.location.assign(state.value.redirectTo);
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <RichTextEditor key={editorKey} content={body} onChange={setBody} />
      <input
        type="hidden"
        name="body"
        value={body ? JSON.stringify(body) : ""}
      />
      <Button type="submit" loading={isPending}>
        Create
      </Button>
    </form>
  );
}
```

## Optional: a "Clear" button

For long CREATE forms (≥3 fields), add a Clear button next to Submit. Always
gate it behind an `<AlertDialog>` confirmation — the user just typed several
fields and accidental clicks should not destroy that work. Reuse the same
`resetForm` helper the success-effect uses.

```tsx
const resetForm = (): void => {
  formRef.current?.reset();
  setName("");
  setBody(null);
  setEditorKey((k) => k + 1);
};
```

Skip the Clear button when:

- The form has only one logical field (e.g. `AddCommentForm` — single editor +
  optional images).
- The form lives in a dialog whose close already resets it
  (`InviteUserDialog`).

## E2E coverage

Every CREATE form needs at least one E2E assertion that, after a successful
submit, every field reads back as empty/placeholder. For forms that navigate
away on success, the simplest test is: submit, wait for the redirect, navigate
back to the form route, and assert empty values. See `e2e/full/form-resets.spec.ts`.

## Edge cases

- **URL-derived defaults**: if a field's value came from a URL param
  (`?machine=MM`), preserve it across reset. See `unified-report-form.tsx` —
  the reset effect calls `setSelectedMachineId(defaultMachineId ?? "")` rather
  than `""`.
- **localStorage drafts**: clear them in the same effect (`window.localStorage.removeItem(...)`).
  Make sure the save-draft effect short-circuits on `state.success` so it
  doesn't race the reset and re-write the values you just cleared.
- **shadcn `Select`**: prefer controlling it with a `value` prop. If a child
  component holds its own `useState` for the selected value (like
  `OwnerSelect`), bump a `key` on the component to remount it on reset.

## Silent-fallback footgun: native `<select>` + stale option ID (PP-lql)

A controlled native `<select value="X">` whose `value` does not match any
`<option>` does **not** error or render visibly broken — browsers display the
first non-disabled `<option>` and `FormData.get(name)` returns its value. This
is HTML-spec behavior, not a React bug.

This combines disastrously with localStorage-backed drafts: if the saved ID
references a record that has since been deleted (or that belongs to a
different tenant after a session change), restoration silently puts the form
into a state where the dropdown shows — and submits — the alphabetically-first
record. The Zod `uuid()` schema and any "does this id exist?" server checks
both pass, because the submitted UUID _is_ a valid record. The user never sees
an error, and an entity is created against the wrong target.

**Mitigation pattern (apply when restoring an option-ID from localStorage or
any other side-channel):**

```ts
useEffect(() => {
  if (typeof window === "undefined" || hasRestored.current) return;
  hasRestored.current = true;

  const draft = readDraftFromLocalStorage();
  if (!draft?.machineId) return;

  // Validate against the live list before restoring.
  if (machinesList.some((m) => m.id === draft.machineId)) {
    setSelectedMachineId(draft.machineId);
  }
  // (rest of the draft fields can still restore independently)
}, [machinesList]);

// Defense in depth — catches any other path that puts a stale id into state.
useEffect(() => {
  if (
    selectedMachineId &&
    !machinesList.some((m) => m.id === selectedMachineId)
  ) {
    setSelectedMachineId("");
  }
}, [selectedMachineId, machinesList]);
```

**Better long-term**: replace native `<select>` with the project's shadcn
`Select` for any field whose options come from a list that can change between
sessions. shadcn's command-palette pattern surfaces the "no match" state
clearly instead of silently picking the first option.

Regression coverage:

- `src/app/(app)/report/select-fallback.test.tsx` — JSDOM unit test pinning
  the silent-fallback behavior in HTML.
- `e2e/full/report-stale-machine.spec.ts` — seeds a stale localStorage draft,
  asserts the form renders an empty placeholder and refuses to submit until
  the user picks a machine.
