# Form & Interaction Patterns

Server Action form shapes, dropdown actions, and CSS-first interaction.

### Forms with a direct Server Action reference

```typescript
// Direct Server Action reference
import { createIssue } from "~/server/actions/issues";

export function CreateIssueForm() {
  return (
    <form action={createIssue}>
      <input name="title" required />
      <textarea name="description" />
      <button type="submit">Create Issue</button>
    </form>
  );
}

// BAD: Inline wrapper (breaks Next.js form handling)
<form action={async () => { await createIssue(); }}>
```

### Forms with useActionState (React 19)

```typescript
"use client";
import { useActionState } from "react";
import { createIssue } from "~/server/actions/issues";

export function CreateIssueForm() {
  const [state, formAction] = useActionState(createIssue, { message: "" });

  return (
    <form action={formAction}>
      <input name="title" required />
      {state.message && <p className="text-destructive-text">{state.message}</p>}
      <button type="submit">Create Issue</button>
    </form>
  );
}
```

### Dropdowns with Server Actions

```typescript
"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { deleteIssue } from "~/server/actions/issues";

export function IssueActionsMenu({ issueId }: { issueId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* Use onSelect, not forms inside dropdowns */}
        <DropdownMenuItem
          onSelect={async () => {
            await deleteIssue(issueId);
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// BAD: Form inside dropdown (unmounts before submission)
<DropdownMenuItem>
  <form action={deleteIssue}>
    <button>Delete</button>
  </form>
</DropdownMenuItem>
```

## CSS-First Interaction

### CSS-Only Patterns

```typescript
// CSS-only hover effects
<div className="group">
  <Button className="group-hover:bg-primary/90">
    Hover Me
  </Button>
</div>

// Peer patterns for form validation
<Input className="peer" />
<p className="peer-invalid:visible invisible text-destructive">
  Invalid input
</p>
```

### Mutations go through a Server Action

```typescript
// Mutation submitted through a Server Action
<form action={createIssue}>
  <input name="title" required />
  <button type="submit">Submit</button>
</form>

// Also fine: a form containing a Radix Select dispatches the same Server
// Action directly. Carrying `action={...}` would let React 19's post-action
// reset replay the Select's mount-time value. `onSubmit` is not the problem —
// leaving the Server Action path is.
<form onSubmit={(e) => { e.preventDefault(); dispatchForm(); }}>

// BAD: hand-rolled fetch to an API route — bypasses the Server Action path
<form onSubmit={async (e) => {
  e.preventDefault();
  await fetch("/api/issues", { method: "POST", body: payload });
}}>
```

There is no no-JS requirement — that rule was retired (PP-nw80). This is about
keeping one mutation path (CORE-ARCH-005/007), not about surviving without
JavaScript. The Radix Select carve-out — why it exists, both shapes it bit, and
why controlling the Select does not help — is in `SKILL.md` § Server Action Forms.
