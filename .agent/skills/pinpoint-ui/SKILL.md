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
6. **Tailwind CSS v4 + semantic tokens**: Use `bg-primary`, `text-destructive`, etc. — no raw palette classes (`bg-cyan-500`, `text-red-500`) and no hardcoded hex
7. **TooltipProvider is hoisted**: `<TooltipProvider>` is mounted once in `ClientProviders` — don't add nested providers. See `pinpoint-design-bible` §12.

### Adding Components

```bash
pnpm exec shadcn@latest add [component]
```

### Issue Field Display Order

The canonical display order for issue metadata fields is:

1. Status
2. Priority
3. Severity
4. Frequency

When assignee is present in edit contexts, it comes first.

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

Single-select user pickers all follow the **Picker Pattern** (Popover + cmdk Command) — see `pinpoint-design-bible` §12 for the canonical pattern + rules. Don't reimplement; copy from one of these.

| File                                         | What It Teaches                                                                                     |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `src/components/issues/AssigneePicker.tsx`   | Picker pattern, "Unassigned" sentinel, "Me" quick-select, callback-driven assignment via `onAssign` |
| `src/components/machines/OwnerSelect.tsx`    | Picker pattern, hide-guests toggle, invite-on-the-fly via `<InviteUserDialog>`                      |
| `src/components/machines/MachineFilters.tsx` | Inline filter bar (not a picker — filter composition + sort dropdown for the list page)             |

### Styling & Tokens

| File                                       | What It Teaches                                                             |
| :----------------------------------------- | :-------------------------------------------------------------------------- |
| `src/app/globals.css`                      | Material Design 3 color system, Tailwind v4 @theme block, custom properties |
| `src/lib/issues/status.ts` (STATUS_CONFIG) | Canonical color assignments per status (Tailwind class names)               |

### Layout

Every authenticated page should compose `<MainLayout>` → `<PageContainer>` → `<PageHeader>` → content. See `pinpoint-design-bible` §5 for the size mapping (narrow/standard/wide/full).

| File                                        | What It Teaches                                                                                                   |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| `src/components/layout/MainLayout.tsx`      | App shell (AppHeader + content + BottomTabBar), horizontal padding                                                |
| `src/components/layout/PageContainer.tsx`   | Width + vertical padding wrapper. `size="narrow" \| "standard" (default) \| "wide" \| "full"`                     |
| `src/components/layout/PageHeader.tsx`      | Page title (h1, text-balance, 3xl bold) + optional `titleAdornment` + optional `actions`. Bottom border separator |
| `src/components/layout/AppHeader.tsx`       | Unified responsive header (icon-only at md:, icon+text at lg:)                                                    |
| `src/components/layout/BottomTabBar.tsx`    | Mobile tab bar (md:hidden), More sheet with secondary nav                                                         |
| `src/components/layout/nav-config.ts`       | Shared NAV_ITEMS array used by AppHeader and BottomTabBar                                                         |
| `src/components/layout/HelpMenu.tsx`        | Help dropdown (Feedback, What's New, Help, About) with badge                                                      |
| `src/components/layout/ClientProviders.tsx` | Hoists `<TooltipProvider>` (`delayDuration={300}`) — don't add nested providers                                   |

## Label Standards

- Status group labels: import from `STATUS_GROUP_LABELS` in `src/lib/issues/status.ts` ("Open", "In Progress", "Closed"). Never hardcode the strings.
- Quick-select labels for "current user" filters are "Me" (assignee) and "My machines" (machines). Both shipped — see `AssigneePicker` and `MachineFilters`.
- Status `wait_owner`: use `STATUS_CONFIG.wait_owner.label` as the canonical display string (currently "Pending Owner"). Mockups occasionally use "Wait Owner"; the config wins.

## Color System

- **Use semantic tokens** (`bg-primary`, `text-destructive`, `text-muted-foreground`, `border-success/40`). Raw Tailwind palette classes (`bg-cyan-500`, `text-red-500`, `border-fuchsia-500`) and hardcoded hex are **forbidden in component code** — see design-bible §1 for the full rule and the design-layer config exceptions.
- Status / severity / priority / frequency colors come from `STATUS_CONFIG` / `SEVERITY_CONFIG` / `PRIORITY_CONFIG` / `FREQUENCY_CONFIG` in `src/lib/issues/status.ts` — never freestyle.
- Theme tokens are defined in `src/app/globals.css` via Tailwind v4 `@theme` block. Dark-only — `dark:` utility classes are dead code, remove them when you touch the file.
- Primary: `--color-primary` (APC Neon Green `#4ade80`)
- Secondary: `--color-secondary` (Teal `#2dd4bf`) — **purple/fuchsia secondary was removed in PR #1204; do not reintroduce.**
- For the full visual identity (surface hierarchy, glow rules, accessibility constraints) see `pinpoint-design-bible` §1–§2.

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
      {state.message && <p className="text-destructive">{state.message}</p>}
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
<p className="peer-invalid:visible invisible text-destructive">
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
// Canonical page structure: PageContainer + PageHeader + body grid.
// MainLayout wraps the route — don't re-add it here.
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";

export default async function MachinesPage() {
  const machines = await getMachines();

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Machines"
        actions={
          <Button asChild>
            <Link href="/m/new">Add Machine</Link>
          </Button>
        }
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {machines.map((machine) => (
          <MachineCard key={machine.id} machine={machine} />
        ))}
      </div>
    </PageContainer>
  );
}
```

### Responsive Grid

Per the **Two-Layer Responsive Framework** (AGENTS.md rule #16): viewport breakpoints (`md:`, `lg:`, `xl:`) for page-level grid columns; container queries for component internals. **`sm:` is padding/spacing only — never `sm:grid-cols-*`.**

```typescript
// Page-level grid (Layer 1, viewport breakpoints)
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

/* GOOD: Use Tailwind v4's Preflight (already in src/app/globals.css) */
@import "tailwindcss";

@theme {
  /* token definitions */
}
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

// GOOD: Tailwind utilities with semantic tokens
<div className="mt-2.5 text-destructive">
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
