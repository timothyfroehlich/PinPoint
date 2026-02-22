---
name: pinpoint-ui
description: shadcn/ui patterns, progressive enhancement, Server Components, Client Components, form handling, Tailwind CSS v4, accessibility. Use when building UI, forms, components, or when user mentions UI/styling/components/forms.
---

# PinPoint UI Guide

## When to Use This Skill

Use this skill when:

- Building or modifying UI components
- Creating forms
- Working with shadcn/ui components
- Styling with Tailwind CSS v4
- Implementing progressive enhancement
- Deciding between Server and Client Components
- User mentions: "UI", "component", "form", "styling", "Tailwind", "shadcn", "button", "input"

## Quick Reference

### Critical UI Rules

1. **Server Components first**: Default to Server Components, use "use client" only for interactivity
2. **Progressive enhancement**: Forms must work without JavaScript
3. **shadcn/ui only**: No MUI components
4. **Direct Server Action references**: No inline wrappers in forms
5. **Dropdown Server Actions**: Use `onSelect`, not forms
6. **Tailwind CSS v4**: Use CSS variables, no hardcoded hex colors

### Adding Components

```bash
pnpm exec shadcn@latest add [component]
```

## Key Files Registry

These are the canonical pattern sources. Read these files to understand PinPoint's UI patterns -- they ARE the documentation.

### Status & Filter System

| File                                            | What It Teaches                                                                      |
| :---------------------------------------------- | :----------------------------------------------------------------------------------- |
| `src/lib/issues/status.ts`                      | STATUS_CONFIG, STATUS_GROUPS, color system, all 11 statuses. Single source of truth. |
| `src/components/issues/IssueFilters.tsx`        | Smart badge grouping, filter composition, MultiSelect usage, "More Filters" pattern  |
| `src/components/issues/fields/StatusSelect.tsx` | Grouped select with icons, STATUS_GROUP_LABELS, separator pattern                    |
| `src/components/ui/multi-select.tsx`            | Grouped/flat modes, indeterminate group headers, selected-items-first sorting        |

### Pickers & Selects

| File                                         | What It Teaches                                                 |
| :------------------------------------------- | :-------------------------------------------------------------- |
| `src/components/issues/AssigneePicker.tsx`   | Listbox pattern, "Unassigned" special value, user search/filter |
| `src/components/machines/MachineFilters.tsx` | Inline filter bar, sort dropdown, owner display with metadata   |
| `src/components/machines/OwnerSelect.tsx`    | Owner select with machine count and invite status metadata      |

### Styling & Tokens

| File                                       | What It Teaches                                                             |
| :----------------------------------------- | :-------------------------------------------------------------------------- |
| `src/app/globals.css`                      | Material Design 3 color system, Tailwind v4 @theme block, custom properties |
| `src/lib/issues/status.ts` (STATUS_CONFIG) | Canonical color assignments per status (Tailwind class names)               |

### Layout

| File                                   | What It Teaches                                     |
| :------------------------------------- | :-------------------------------------------------- |
| `src/components/layout/PageShell.tsx`  | Page wrapper with size variants, consistent padding |
| `src/components/layout/MainLayout.tsx` | App shell, header, sidebar integration, mobile nav  |
| `src/components/layout/Sidebar.tsx`    | Navigation, collapsed state, mobile sheet pattern   |

## Label Standards (Decided)

- Status group labels: "Open" (not "New"), "In Progress", "Closed" -- see `STATUS_GROUP_LABELS` in `status.ts`
- Quick-select labels: "Me" (assignee), "My machines" (not "Your machines")
- Status "wait_owner": Use `STATUS_CONFIG.wait_owner.label` as canonical source (currently "Pending Owner"). Note: mockups use "Wait Owner" -- this may be reconciled later.

## Color System

- **Always use Tailwind token names** (e.g., `bg-cyan-500`), never hex values
- Status colors are defined in `STATUS_CONFIG` in `status.ts` -- never hardcode
- Theme uses Material Design 3 via CSS custom properties in `globals.css`
- Primary: `--color-primary` (APC Neon Green #4ade80)
- Secondary: `--color-secondary` (Fuchsia #d946ef)

## Core UI Patterns

### Server vs Client Components

```typescript
// Server Component (default)
export default async function MachinesPage() {
  const machines = await getMachines();

  return (
    <div>
      {machines.map((machine) => (
        <MachineCard key={machine.id} machine={machine} />
      ))}
    </div>
  );
}

// Client Component (only when needed)
"use client";
import { useState } from "react";

export function IssueFilter() {
  const [filter, setFilter] = useState("all");

  return (
    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
      <option value="all">All Issues</option>
      <option value="open">Open</option>
      <option value="resolved">Resolved</option>
    </select>
  );
}
```

### Forms with Progressive Enhancement

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
      {state.message && <p className="text-red-500">{state.message}</p>}
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

## Styling with Tailwind CSS v4

### CSS Variables (No Hardcoded Colors)

```typescript
// Use CSS variables from globals.css
<div className="bg-background text-foreground">
  <p className="text-muted-foreground">Muted text</p>
</div>

// BAD: Hardcoded hex colors
<div style={{ backgroundColor: "#ffffff", color: "#000000" }}>
```

### Component Styling

```typescript
// Use className with cn() for merging
import { cn } from "~/lib/utils";

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md bg-primary px-4 py-2 text-primary-foreground",
        className
      )}
      {...props}
    />
  );
}

// BAD: String concatenation (doesn't handle conflicts)
<button className={`base-classes ${className}`} />

// BAD: Inline styles
<button style={{ marginTop: '10px' }} />
```

### Global vs Local Styles

```typescript
// Global styles (globals.css)
// - Typography (headings, body text)
// - Theme variables (colors, spacing)

// Local styles (component className)
// - Component-specific layout
// - Responsive design
// - Interactive states (hover, focus)

// BAD: Hardcoded spacing in reusable components
export function Card({ children }: CardProps) {
  return <div className="m-4 p-4">{children}</div>; // Too opinionated
}

// GOOD: Allow className override
export function Card({ children, className }: CardProps) {
  return <div className={cn("rounded-lg border", className)}>{children}</div>;
}
```

## shadcn/ui Component Patterns

### Button Variants

```typescript
import { Button } from "~/components/ui/button";

<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Subtle Action</Button>
<Button variant="link">Link Style</Button>
```

### Dialog (Modal) Pattern

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function CreateIssueDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create Issue</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>
            Report a problem with a machine.
          </DialogDescription>
        </DialogHeader>
        <CreateIssueForm />
      </DialogContent>
    </Dialog>
  );
}
```

### Form with shadcn/ui

```typescript
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";

export function IssueForm() {
  return (
    <form action={createIssue} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" />
      </div>
      <Button type="submit">Create Issue</Button>
    </form>
  );
}
```

## Accessibility Patterns

### Semantic HTML

```typescript
// Semantic HTML
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/machines">Machines</a></li>
    <li><a href="/issues">Issues</a></li>
  </ul>
</nav>

// BAD: Div soup
<div className="nav">
  <div className="nav-item">Machines</div>
  <div className="nav-item">Issues</div>
</div>
```

### ARIA Labels

```typescript
// ARIA labels for screen readers
<Button aria-label="Delete issue">
  <TrashIcon className="h-4 w-4" />
</Button>

// Label association
<Label htmlFor="email">Email</Label>
<Input id="email" name="email" type="email" />
```

## Progressive Enhancement

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
<p className="peer-invalid:visible invisible text-red-500">
  Invalid input
</p>
```

### Fallback for No JS

```typescript
// Form works without JavaScript
<form action={createIssue} method="POST">
  <input name="title" required />
  <button type="submit">Submit</button>
</form>

// BAD: Requires JavaScript
<form onSubmit={(e) => {
  e.preventDefault();
  // Client-side only logic
}}>
```

## Layout Patterns

### Page Layout

```typescript
// Consistent page structure
export default async function MachinesPage() {
  const machines = await getMachines();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Machines</h1>
        <Button asChild>
          <Link href="/machines/new">Add Machine</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {machines.map((machine) => (
          <MachineCard key={machine.id} machine={machine} />
        ))}
      </div>
    </div>
  );
}
```

### Responsive Grid

```typescript
// Responsive grid with Tailwind
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {items.map((item) => (
    <Card key={item.id}>{item.name}</Card>
  ))}
</div>
```

## UI Anti-Patterns

### Don't Do These

**Global CSS Resets**:

```css
/* BAD: Breaks component internals */
* {
  margin: 0;
  padding: 0;
}

/* GOOD: Use Tailwind's Preflight */
@tailwind base;
```

**Hardcoded Spacing in Components**:

```typescript
// BAD: Rigid component
export function Card({ children }: CardProps) {
  return <div className="m-4 p-4">{children}</div>;
}

// GOOD: Flexible component
export function Card({ children, className }: CardProps) {
  return <div className={cn("rounded-lg", className)}>{children}</div>;
}
```

**Inline Styles**:

```typescript
// BAD: Inline styles
<div style={{ marginTop: '10px', color: '#ff0000' }}>

// GOOD: Tailwind utilities
<div className="mt-2.5 text-red-500">
```

## Troubleshooting

- **Styles not applying**: Check Tailwind specificity, check `cn()` usage, clear `.next` cache
- **Hydration errors**: Ensure no random data (dates, Math.random) renders without `useEffect` or `suppressHydrationWarning`. Check for invalid HTML nesting (`<div>` inside `<p>`).

## UI Checklist

Before committing UI code:

- [ ] Server Components by default (only "use client" when needed)
- [ ] Forms work without JavaScript
- [ ] Direct Server Action references (no inline wrappers)
- [ ] Dropdowns use `onSelect` for Server Actions
- [ ] CSS variables, no hardcoded colors
- [ ] `cn()` used for className merging
- [ ] Semantic HTML (nav, main, article, etc.)
- [ ] ARIA labels for icon-only buttons
- [ ] Responsive design (mobile-first)
- [ ] shadcn/ui components only (no MUI)

## External References

- shadcn/ui docs: Use Context7 MCP for latest components
- Tailwind CSS v4 docs: Use Context7 MCP for latest utilities
