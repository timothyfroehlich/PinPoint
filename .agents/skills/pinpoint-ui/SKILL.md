---
name: pinpoint-ui
description: shadcn/ui patterns, Server Action forms, Server Components, Client Components, form handling, Tailwind CSS v4, accessibility. Also the Radix Select form-reset footgun (useActionState dispatch, PP-0fvr/PP-1ajq), CREATE form reset (return-redirect + dual-pass reset), the native `<select>` stale-option-ID silent fallback (PP-lql), authoring config-driven enums with rich metadata (labels/icons/styles), discriminated-union component props, Server Action conventions (`Action` suffix, `checkPermission`, `Result`, `serverActionError`), colocated data access with React `cache()` and `revalidatePath`, derived machine status, and why `console.*` is correct inside client components. Use when building UI, forms, components, badges, server actions, or data fetching, or when user mentions UI/styling/components/forms/enums/dropdowns/logging.
---

# PinPoint UI Guide

## When to Use This Skill

Use this skill when:

- Building or modifying UI components
- Creating forms
- Working with shadcn/ui components
- Styling with Tailwind CSS v4
- Implementing Server Action forms, or resetting a CREATE form after a successful submit
- Any form that contains a Radix/shadcn `Select` (read **Server Action Forms** first — this is the codebase's biggest footgun)
- Deciding between Server and Client Components
- Authoring a new config-driven domain enum, or a badge component that renders several enum types
- Writing a Server Action or a colocated data-access module
- User mentions: "UI", "component", "form", "styling", "Tailwind", "shadcn", "button", "input", "select", "dropdown", "badge", "enum", "server action", "form reset"

## Quick Reference

### Critical UI Rules

1. **Server Components first**: Default to Server Components, use "use client" only for interactivity
2. **Honest failure** (CORE-ARCH-012): a control that cannot perform its action must not report that it did — never a success confirmation for input that could not have been collected. There is no no-JS requirement.
3. **shadcn/ui only**: No MUI components
4. **Direct Server Action references**: No inline wrappers in forms
5. **Dropdown Server Actions**: Use `onSelect`, not forms
6. **Tailwind CSS v4 + semantic tokens**: Use `bg-primary`, `text-destructive`, etc. — no raw palette classes (`bg-cyan-500`, `text-red-500`) and no hardcoded hex (enforced via ESLint `better-tailwindcss/no-restricted-classes`)
7. **TooltipProvider is hoisted**: `<TooltipProvider>` is mounted once in `ClientProviders` — don't add nested providers. See `pinpoint-design-bible` §12.
8. **Baseline Widely available is the floor** (CORE-UI-005): use `<dialog>`, container queries, `:has()`, `:user-invalid`, `inert`, `aspect-ratio`, `fetchpriority`, native form validation directly — no polyfills. Newly-available features (Popover API, View Transitions, anchor positioning) require a per-feature opt-in in `pinpoint-design-bible` §19. See **Browser Support** section below.
9. **Form correctness** (CORE-FORM-001..006): right `type`, correct `autocomplete` token, `:user-invalid` styling, `aria-invalid` blur sync, visible required-field indicator, `enterkeyhint` on sequential mobile fields. See **Form Correctness** below.
10. **Accessibility floor** (CORE-A11Y-001..006): skip link, `motion-reduce:` paired with animations, semantic `<table>` markup, real `<button>` (no `<div role="button">`), `title` is not a tooltip, `inert` background on modals. See **Accessibility** below.

## Browser Support

PinPoint targets **Baseline Widely available** — features cross-browser for ~2.5 years and safe without fallbacks. This is the canonical floor (CORE-UI-005); see `pinpoint-design-bible` §19 for the policy.

### In-scope today (reach for these directly)

| Feature                              | Baseline since |
| :----------------------------------- | :------------- |
| `<dialog>` + `.showModal()`          | Mar 2023       |
| Container queries (`@container`)     | Feb 2023       |
| `:has()`                             | Dec 2023       |
| `:user-valid` / `:user-invalid`      | Nov 2023       |
| `inert` attribute                    | Mar 2022       |
| `aspect-ratio`                       | Mar 2021       |
| `accent-color`                       | May 2022       |
| `fetchpriority` (img/script/link)    | Sep 2023       |
| CSS subgrid                          | Sep 2023       |
| `gap` on flexbox                     | Apr 2021       |
| `prefers-reduced-motion` (CSS query) | Jul 2020       |
| `focus-visible`                      | Mar 2022       |
| Native form validation + `required`  | (pre-Baseline) |
| `enterkeyhint` attribute             | Dec 2021       |
| Logical properties (`inline-start`)  | Mar 2023       |

### Newly available — defer unless opted in

Popover API (`popover="auto"`), View Transitions, anchor positioning, scroll-driven animations, `text-wrap: balance` mid-adoption, `interestfor`, the `closedby` attribute on `<dialog>`. These ship behind a per-feature opt-in documented in the design bible.

### How to check a feature's status

The Google Chrome `modern-web-guidance` catalog tags each guide with its Baseline status. Search the catalog first (see next section); if a guide recommends a non-Widely feature, use the guide's documented fallback or skip the recommendation.

## Modern Web Guidance Catalog

The `modern-web-guidance` plugin (Google Chrome marketplace; installed at `~/.claude/plugins/marketplaces/googlechrome/skills/modern-web-guidance/`) ships ~90 prescriptive guides — one per use case — and is PinPoint's canonical "is there a Widely-available primitive for this?" lookup tool.

### Use the catalog before implementing

```bash
# Search by intent
npx -y modern-web-guidance@latest search "<query>"

# Retrieve one or more guide bodies
npx -y modern-web-guidance@latest retrieve "<id>,<id2>"

# Browse the full catalog
npx -y modern-web-guidance@latest list
```

### Curated guide map (PinPoint use cases)

| When you're building...                  | Search / retrieve                                                       |
| :--------------------------------------- | :---------------------------------------------------------------------- |
| A sign-in / sign-up form                 | `autofill-sign-in-form`, `autofill-sign-up-form`, `forms`               |
| An address or anonymous-reporter form    | `autofill-address-form`, `forms`                                        |
| Post-interaction validation feedback     | `validate-input-after-interaction`, `required-field-feedback`           |
| Accessible error announcement            | `accessible-error-announcement`                                         |
| A modal / dialog / confirmation          | `html` §4, `light-dismiss-a-dialog`, `platform-controls-dismiss-dialog` |
| A mobile drawer / slide-in panel         | `navigation-drawer`                                                     |
| A tooltip on touch                       | `interest-triggered-tooltips` (most are Newly available — read)         |
| Image priority / LCP                     | `optimize-image-priority`, `optimize-preload-priority`                  |
| Skeletons, content-visibility            | `defer-rendering-heavy-content`                                         |
| Long-task scheduling / INP               | `break-up-long-tasks`, `identify-inp-causes`                            |
| Container-internal layout                | `css-layout`, `size-aware-styling`                                      |
| Conditional styles via DOM state         | `style-parent-with-has`                                                 |
| Hidden-but-findable content (accordions) | `search-hidden-content`                                                 |
| Reduced-motion / animation               | `accessibility` § Motion                                                |
| Table a11y                               | `accessibility` § Tables                                                |
| Skip-link / landmarks                    | `accessibility` § Landmarks, `html` §3                                  |

**Don't memorize**: re-search per task. The catalog is updated more often than this skill is.

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

- **Use semantic tokens** (`bg-primary`, `text-destructive`, `text-muted-foreground`, `border-success/40`). Raw Tailwind palette classes (`bg-cyan-500`, `text-red-500`, `border-fuchsia-500`) and hardcoded hex are **forbidden in component code** (enforced via ESLint flat config rule `better-tailwindcss/no-restricted-classes`) — see design-bible §1 for the full rule and the design-layer config exceptions.
- Status / severity / priority / frequency colors come from `STATUS_CONFIG` / `SEVERITY_CONFIG` / `PRIORITY_CONFIG` / `FREQUENCY_CONFIG` in `src/lib/issues/status.ts` — never freestyle.
- Theme tokens are defined in `src/app/globals.css` via Tailwind v4 `@theme` block. Dark-only — `dark:` utility classes are dead code, remove them when you touch the file.
- Primary: `--color-primary` (APC Neon Green `#4ade80`)
- Secondary: `--color-secondary` (Teal `#2dd4bf`) — **purple/fuchsia secondary was removed in PR #1204; do not reintroduce.**
- For the full visual identity (surface hierarchy, glow rules, accessibility constraints) see `pinpoint-design-bible` §1–§2.

## Config-Driven Enums (authoring a new one)

Consuming an existing domain enum is covered above — pull labels, icons and styles out of `STATUS_CONFIG` / `SEVERITY_CONFIG` / `PRIORITY_CONFIG` / `FREQUENCY_CONFIG`. This section is about **authoring** a new one.

A config-driven enum is a centralized configuration object for a domain enum that needs UI metadata (labels, styles, icons, descriptions). One module owns the values, the type, the metadata, and the accessors, so the DB schema, the Zod schema, and every component all read the same source. `src/lib/issues/status.ts` is the reference implementation: `IssueStatus` (11 values, 3 groups — new: 2, in_progress: 4, closed: 5), `IssueSeverity` (4), `IssuePriority` (3), `IssueFrequency` (3), each with labels, descriptions, Tailwind styles and Lucide icons.

**Authoring template** — seven pieces, in this order, in one file under `src/lib/<domain>/`:

1. **Named constants** for type-safe access and autocomplete: `export const MY_ENUM = { VALUE_A: "value_a", ... } as const;`
2. **Runtime array** for validation: `export const ALL_MY_ENUM_VALUES = Object.values(MY_ENUM);`
3. **Literal-typed array** for the Drizzle schema: `export const MY_ENUM_VALUES = ["value_a", ...] as const;`
4. **Derived type**: `export type MyEnum = (typeof MY_ENUM_VALUES)[number];`
5. **Config object** keyed by the type, so TypeScript enforces that every value has metadata: `export const MY_ENUM_CONFIG: Record<MyEnum, { label: string; description: string; styles: string; icon: LucideIcon }> = { ... };`
6. **Getter functions** — `getMyEnumLabel`, `getMyEnumIcon`, `getMyEnumStyles`. Components call these, never index the config inline.
7. **Optional grouping export** when the UI groups values (e.g. open vs. closed): `export const MY_ENUM_GROUPS = { groupA: [MY_ENUM.VALUE_A, ...] } as const;`

Then wire it up: the Drizzle column takes `{ enum: MY_ENUM_VALUES as unknown as [string, ...string[]] }`, the Zod schema takes `z.enum(MY_ENUM_VALUES)`, and the badge component calls the getters.

**Use this pattern when** the enum has UI metadata (status, severity, priority), appears in dropdowns with labels, carries colors/icons/descriptions, or needs grouping. **Don't** use it for simple string unions with no metadata (a plain type is enough) or for enums that never surface in the UI (a plain const is enough).

### Discriminated-union props for multi-type components

When one component renders several related enum types, discriminate the props on a `type` field so `value` narrows with it. The exemplar is `src/components/issues/IssueBadge.tsx`: a `{ variant?: "normal" | "strip"; size?: "normal" | "lg"; className?: string; showTooltip?: boolean }` base intersected with `{ type: "status"; value: IssueStatus } | { type: "severity"; value: IssueSeverity } | { type: "priority"; value: IssuePriority } | { type: "frequency"; value: IssueFrequency }`, switched on the discriminant. `IssueBadgeGrid` composes it from a `Pick<Issue, "status" | "severity" | "priority" | "frequency">`. The technique itself is textbook TypeScript — reach for `pinpoint-typescript` if you need narrowing or exhaustiveness help.

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
        <Label htmlFor="title">Title <span aria-hidden="true">*</span></Label>
        <Input id="title" name="title" required enterKeyHint="next" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" enterKeyHint="done" />
      </div>
      <Button type="submit">Create Issue</Button>
    </form>
  );
}
```

## Form Correctness

Forms are the highest-leverage place to follow the Widely-available web platform — the browser already does post-interaction validation, autofill, mobile-keyboard hints, and password-manager integration. Opt in correctly and most "form polish" tickets disappear.

### Input type

| Field                             | Type                                |
| :-------------------------------- | :---------------------------------- |
| Email (login, signup, reporter)   | `type="email"`                      |
| Phone                             | `type="tel"`                        |
| URL                               | `type="url"`                        |
| Password / new password / confirm | `type="password"`                   |
| Numeric ID (postal, etc.)         | `type="text" inputMode="numeric"`   |
| Number you do math on             | `type="number"`                     |
| Date / time                       | `type="date"` / `type="time"`       |
| Plain text                        | `type="text"` (the actual fallback) |

Wrong types lose the mobile keyboard hint and native format validation. `type="text"` for an email field is a CORE-FORM-001 violation.

### Autocomplete tokens

Password managers and browser autofill key on `autocomplete`. Wrong/missing tokens silently break credential flows.

```tsx
// Sign-in form
<Input id="email"            name="email"    type="email"    autoComplete="username" required />
<Input id="current-password" name="password" type="password" autoComplete="current-password" required />

// Sign-up form
<Input id="email"            name="email"            type="email"    autoComplete="username" required />
<Input id="new-password"     name="password"         type="password" autoComplete="new-password" required />
<Input id="confirm-password" name="confirm-password" type="password" autoComplete="off" required />
//                                                                                ^^^^^ off on confirm

// Anonymous-reporter form
<Input name="firstName" autoComplete="given-name" required />
<Input name="lastName"  autoComplete="family-name" required />
<Input name="email"     type="email" autoComplete="email" required />

// Domain-specific picker that should NOT autofill
<select id="machineId" name="machineId" autoComplete="off">…</select>
```

The full token list is in MDN; the auth-form-specific subset is in MWG `autofill-sign-in-form` and `autofill-sign-up-form`.

### `enterkeyhint` for mobile flow

Multi-field forms read better with the correct return-key label at each step. Baseline since Dec 2021.

```tsx
<Input enterKeyHint="next" /> // every field except the last
<Input enterKeyHint="next" />
<Input enterKeyHint="done" /> // last field
```

Use `"send"` on the last field of a message/search form, `"search"` on a search input, `"done"` on a generic last input.

### Post-interaction validation styling (`:user-invalid`)

> **Not yet implemented** — tracked under PP-kqbk.2. The shared `<Input>` currently only styles `aria-invalid:`. Add the `:user-invalid:` selectors in `src/components/ui/input.tsx` once; do not copy them per form site.

`:user-invalid` flips a CSS pseudo-class only **after** the user interacts with the control — no premature red rings on page load, no JS state to manage. Adding the two CSS variants below to the shared `<Input>` (and `<Textarea>`, `<Select>`) primitive gives the entire app post-interaction validation feedback for free.

```tsx
// Add to src/components/ui/input.tsx (and textarea.tsx, select.tsx)
<input
  className={cn(
    "border-input focus-visible:ring-ring",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/40",
    "[&:user-invalid]:border-destructive [&:user-invalid]:ring-destructive/40",
    className
  )}
/>
```

### Screen-reader error announcement (`aria-invalid`)

> **Not yet implemented** — tracked under PP-kqbk.2 (bundled with `:user-invalid` styling above).

`:user-invalid` is visual only — AT users need `aria-invalid="true"` to hear "invalid" next to the field label. Add the listener to `src/components/ui/input.tsx` once so every field across the app gets it automatically — don't copy it per form.

```tsx
// Add to src/components/ui/input.tsx (and textarea.tsx, select.tsx)
function syncInvalid(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.setAttribute(
    "aria-invalid",
    e.currentTarget.checkValidity() ? "false" : "true"
  );
}

// In the primitive's render: pass syncInvalid as the default onBlur,
// merging with any caller-supplied onBlur via composeEventHandlers.
```

### Required-field indicators

Mark required fields visually before submission, not via a post-submit error.

```tsx
<Label htmlFor="email">
  Email <span aria-hidden="true">*</span>
</Label>
<Input id="email" name="email" type="email" autoComplete="username" required />
```

For a form with many required fields, include a legend (`<p className="text-sm text-muted-foreground">* required</p>`) once near the top instead of explaining at every label.

## Native HTML primitives alongside shadcn/Radix

> **shadcn/Radix is the design system.** It owns Dialog, AlertDialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, Accordion, Form, etc. Don't migrate components off Radix to chase native primitives — Radix delivers consistent variants, theming, focus trapping, animation, and a single tested behavior across the app.
>
> The web platform has Widely-available primitives that **complement** the shadcn stack. Reach for them in two situations: (1) one-off uses that don't deserve a new shadcn variant, and (2) attributes/behaviors that drop straight onto shadcn components and strengthen them.

### Use `inert` to harden Radix modals (CORE-A11Y-006)

`inert` (Baseline since Mar 2022) removes a subtree from tab order, click handling, and the AT tree in one declarative step — stronger than `aria-hidden` (AT-only). Radix uses `aria-hidden` + pointer-events on the rest of the DOM when a modal opens; layering `inert` on top closes a small but real focus-leak gap.

```tsx
// Wrap the page content so it goes inert while any modal is open.
<div inert={anyModalOpen || undefined}>{/* main page content */}</div>
```

The shadcn primitives stay — `inert` is one attribute added to the background container, not a replacement.

### Native `<dialog>` only when a shadcn variant would be overkill

`<dialog>.showModal()` is Baseline Widely available (Baseline since Mar 2023; see Browser Support table) and ships focus trap + top-layer + `::backdrop` for free. Use it for one-off, self-contained, single-purpose dialogs that don't earn a place in the shadcn variant system — for example, a debug-only inspector panel, an `<a href="#fragment">`-driven help blurb, or a tightly-scoped picker that doesn't need theming.

**Default to shadcn `<Dialog>` / `<AlertDialog>` / `<Sheet>` / `<Drawer>` for product UI.** Native `<dialog>` is an option in your toolbox, not the new default. If a Radix modal is doing its job, leave it.

### `<details>` + `<summary>` for trivial disclosure

For collapsible content that doesn't animate and doesn't need the visual treatment of `<Accordion>` — collapsible debug panels, `<summary>` for an inline "show more" — the native pair is keyboard- and SR-accessible with zero JS. Use shadcn `<Accordion>` whenever the disclosure is part of the product UI (FAQs, settings panels, content sections).

### Native form validation works with shadcn `<Input>`

`<Input>` already forwards `required`, `pattern`, `minLength`, `maxLength`. The browser does the validation; `:user-invalid` styles the result. `useActionState` handles cross-field validation (e.g., "passwords match") and server-side checks. You don't choose between shadcn and native — they layer.

## Accessibility Patterns

The shadcn primitives (and the Radix layer underneath) already handle a lot of a11y — focus trap, `aria-modal`, focus return, descendant labeling. These rules cover what PinPoint must add on top.

### Semantic HTML

```tsx
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

### Skip-to-main link (CORE-A11Y-001)

> **Not yet implemented** — tracked under PP-kqbk.3. This rule applies to the implementation when it lands, and to any new layout introduced before then.

Add a skip link as the first child of `<body>` in `src/app/layout.tsx`, and add `id="main-content" tabIndex={-1}` to the `<main>` element in `MainLayout.tsx`. Without this, every page load forces a keyboard user through 6+ header tab stops before reaching content.

```tsx
<body>
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-primary"
  >
    Skip to main content
  </a>
  {/* … providers + children … */}
</body>
```

### Real `<button>` — never `<div role="button">` (CORE-A11Y-004)

`<button>` is fully restylable. A `<div role="button" tabIndex={0} onKeyDown onClick>` is a reimplementation that almost always misses Space key, focus return, or an accessible name. If the existing pattern is a styled `<div>`, replace it with `<button type="button">`.

```tsx
// GOOD
<button type="button" onClick={enterEditMode} className="block w-full text-left rounded-md p-2 hover:bg-muted">
  <RichTextDisplay value={value} />
</button>

// BAD
<div role="button" tabIndex={0} onClick={enterEditMode} onKeyDown={…}>
  <RichTextDisplay value={value} />
</div>
```

### Tooltip ≠ `title` attribute (CORE-A11Y-005)

`title` doesn't fire on touch and is inconsistently surfaced by screen readers. For supplemental hover/focus info, use shadcn `<Tooltip>` (it wires `aria-describedby`) and add an `aria-label` on the trigger when the visible label is missing.

For **disabled controls** that need a "why disabled" explanation, the tooltip-on-touch problem is a class-A blocker (mobile users see nothing). Either surface the reason as visible text near the control, bake it into the button's accessible name, or enable the control and validate on click.

### Data tables (CORE-A11Y-003)

```tsx
<table aria-label="Issues">
  <thead>
    <tr>
      <th scope="col" aria-sort={sortBy === "title" ? sortDir : "none"}>
        <button type="button" onClick={() => setSort("title")}>
          Title
        </button>
      </th>
      <th scope="col" aria-sort={sortBy === "status" ? sortDir : "none"}>
        <button type="button" onClick={() => setSort("status")}>
          Status
        </button>
      </th>
      {/* … */}
    </tr>
  </thead>
  {/* … */}
</table>
```

Reference: `src/components/issues/IssueList.tsx`. Apply the same semantics to every new sortable table.

### ARIA labels on icon-only triggers

```tsx
// Icon-only button
<Button aria-label="Delete issue">
  <Trash2 aria-hidden="true" />
</Button>

// Editable cell — name the field, not just the value
<DropdownMenuTrigger asChild>
  <Button aria-label={`Status: ${current.label} — change status`}>
    <StatusIcon aria-hidden="true" />
    {current.label}
  </Button>
</DropdownMenuTrigger>
```

### Label-to-control association (especially Radix `<Select>`)

`<Label htmlFor="x">` must target the actual interactive element. Radix `<SelectTrigger>` is a `<button>` underneath; pass `id` through to that trigger, not to the wrapping `<Select>` component.

```tsx
<Label htmlFor="severity">Severity</Label>
<Select name="severity" defaultValue="medium">
  <SelectTrigger id="severity"> {/* id goes here, on the trigger */}
    <SelectValue />
  </SelectTrigger>
  {/* … */}
</Select>
```

### Live regions for async feedback

shadcn `<Alert>` already carries `role="alert"`. Sonner toasts fire in `role="status"`. For async failures inside a row (optimistic update reverted), surface an inline `role="alert"` near the affected element — toast alone is fine for success, but failure needs a more durable announcement.

## Animation & Motion (CORE-A11Y-002)

`prefers-reduced-motion` is Baseline Widely available since Jul 2020. Tailwind exposes it as the `motion-reduce:` variant. Every `animate-*` and non-essential `transition-*` utility pairs with a `motion-reduce:` counterpart.

```tsx
// Loading spinner — static icon still communicates "loading" without motion
<Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />

// Skeleton pulse
<div className="h-4 w-32 animate-pulse motion-reduce:animate-none bg-muted rounded" />

// Layout transitions — keep the structural change, drop the motion
<div className="transition-[height] duration-300 motion-reduce:transition-none">
```

Essential motion (e.g., a sheet sliding into view — the slide is what tells the user what just happened) can opt out by omitting the `motion-reduce:` variant; document the choice in a one-line comment.

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
why controlling the Select does not help — is the next section.

## Server Action Forms

### The Radix Select carve-out: dispatch directly, never `action={...}`

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

`startTransition` is not optional — outside a transition React 19 silently skips the Server Action. The reference implementation is `src/app/(app)/report/unified-report-form.tsx` (the `<form onSubmit={...}>` around line 356), which also guards `e.target !== e.currentTarget` so a submit bubbling up from a portalled descendant form doesn't get cancelled here (React propagates events through the React tree, not the DOM tree).

How it surfaced in each shape:

- **Auto-submitting from `onValueChange`** (the four inline issue-metadata forms, PP-0fvr): the replay looked like a real user selection and fired a **second write carrying the stale value** — silently reverting every status/priority/severity/frequency change.
- **Submitting from a real button** (edit-machine, create-machine, unified-report, delete-account — PP-1ajq): no bad write, but a **failed** save silently wiped unsaved edits while the form was still on screen. Worst case was delete-account, where a reverted machine-reassignment left the confirmation text intact and the destructive button still enabled — a destructive control armed against a target the user could no longer see.

Two things worth knowing before you try to fix this some other way:

- **Making the Select controlled does not help.** Radix's replay calls `onValueChange`, so the stale value is written straight into your state — the controlled path is the very path the replay travels.
- **Mocking `useActionState` is why this stayed invisible to a green suite for five days.** The regression guards (`src/test/unit/components/{issues,machines,settings,report}/*revert*.test.tsx`) deliberately mock neither `react` nor the Select wrappers. Keep it that way: a test that mocks `useActionState` or the Select wrapper cannot observe the reset, and will pass while the bug is live.

This is the form-level surface of CORE-ARCH-012 (honest failure).

### Silent stale-value submission: native `<select>` + a stale option ID (PP-lql)

Same failure family — a value the user never chose gets submitted without any visible error.

A controlled native `<select value="X">` whose `value` does not match any `<option>` does **not** error or render visibly broken — browsers display the first non-disabled `<option>` and `FormData.get(name)` returns its value. This is HTML-spec behavior, not a React bug.

This combines disastrously with localStorage-backed drafts: if the saved ID references a record that has since been deleted (or that belongs to a different tenant after a session change), restoration silently puts the form into a state where the dropdown shows — and submits — the alphabetically-first record. The Zod `uuid()` schema and any "does this id exist?" server checks both pass, because the submitted UUID _is_ a valid record. The user never sees an error, and an entity is created against the wrong target.

**Mitigation** (apply when restoring an option-ID from localStorage or any other side channel): validate the restored ID against the live options list before writing it into state, and add a defense-in-depth effect that clears the selection whenever the current value is absent from the list. Regression coverage lives at `src/app/(app)/report/select-fallback.test.tsx` (JSDOM unit test pinning the HTML behavior) and `e2e/full/report-stale-machine.spec.ts` (seeds a stale draft, asserts an empty placeholder and a refusal to submit).

**Better long term**: replace native `<select>` with the project's shadcn `Select` for any field whose options come from a list that can change between sessions — the command-palette pattern surfaces "no match" instead of silently picking the first option.

### CREATE form reset

Applies to CREATE forms only. Edit forms typically navigate or close on success, so they don't need this. A CREATE form is "fully reset" when, on successful submit:

1. The Server Action **returns** `ok({ ..., redirectTo })` — it does **not** call `redirect()` server-side.
2. A `useEffect` watching `state?.ok` (or `state.success`) runs `formRef.current?.reset()`, then explicit `setState("")` / `setState(null)` for every controlled field, plus a key bump on uncontrolled child editors (e.g. `RichTextEditor`) to remount them.
3. **Then** `window.location.assign(state.value.redirectTo)`.

The **return-redirect** requirement is the load-bearing piece. When a Server Action calls `redirect()` server-side, Next.js throws a redirect error that propagates **before** `useActionState` returns success to the client, so the cleanup `useEffect` never fires. Returning `redirectTo` shifts the redirect to the client and lets cleanup run first.

**Ordering inside the effect matters (PP-1ajq): `formRef.current.reset()` must run _before_ the explicit `setState` clears.** `reset()` synchronously fires the form-`reset` event, and Radix answers it by replaying each Select's mount-time value through `onValueChange`. Everything in the effect is one React batch, so whichever update is queued last wins — reset first and the stale replay is superseded by your clears; clear first and the replay overwrites them. See the commented `resetSingleForm` in `src/app/(app)/report/unified-report-form.tsx` (~line 205) for the worked case.

**Why both passes are needed:**

| Field type                                                | Cleared by `formRef.reset()`?                              |
| :-------------------------------------------------------- | :--------------------------------------------------------- |
| Native `<input>`, `<textarea>`, `<select>` (uncontrolled) | ✅                                                         |
| Native fields rendered with `value={...}` (controlled)    | ❌ — React re-renders the value back                       |
| shadcn/ui `Select`                                        | ❌ — internal state is React, hidden input is React-driven |
| `RichTextEditor` (TipTap) `content` prop                  | ❌ — internal editor state must be remounted via `key`     |
| Image-upload arrays (`useState<ImageMetadata[]>`)         | ❌ — pure React state                                      |

Native reset clears the form's DOM state; explicit `setState` clears React's view of every controlled field.

**Three valid reset strategies**, pick per form:

- **Dual-pass in an effect** — the default above. `src/components/issues/AddCommentForm.tsx` is the cleanest example: Result type, stays mounted on success, `formRef.reset()` + clears controlled state.
- **Remount on reopen** — for dialogs, put the form (and its `useActionState`) in a child that mounts with the dialog content, so every open starts clean. `src/components/users/InviteUserDialog.tsx` does exactly this; its comment says so.
- **Navigate away** — the redirect unmounts the form, so nothing needs clearing.

**Optional Clear button**: for long CREATE forms (≥3 fields), add one next to Submit, always gated behind an `<AlertDialog>` — the user just typed several fields. Reuse the same reset helper the success effect uses. Skip it for single-field forms and for dialogs that reset on close.

**Edge cases**: preserve URL-derived defaults across reset (`?machine=MM` → reset to `defaultMachineId ?? ""`, not `""`); clear localStorage drafts in the same effect and make the save-draft effect short-circuit on success so it doesn't race the reset; for a child that owns its own selection state (like `OwnerSelect`), bump a `key` to remount it.

**E2E coverage**: every CREATE form needs at least one assertion that, after a successful submit, every field reads back empty/placeholder. For forms that navigate away, submit → wait for redirect → navigate back → assert empty. See `e2e/full/form-resets.spec.ts`.

## Server & Data Conventions

### Server Actions

- Exported server actions are **suffixed `Action`** — `createMachineAction`, `markAsReadAction`. 135/135 exports across `src/app/**/actions.ts` follow this; match it.
- Every action checks authorization through `checkPermission()` from `~/lib/permissions/helpers` (CORE-ARCH-008). Never hand-roll a role comparison. `pinpoint-security` has the full auth/permission gate walkthrough.
- Actions return `Result<T, C>` from `~/lib/result.ts` (`ok(...)` / `err(...)`), not thrown exceptions, so `useActionState` can render the failure.
- Report failures through `serverActionError()` from `~/lib/observability/report-error` (27 call sites) rather than a bare `console.error` — that's what routes the error to Sentry with action context.
- Zod schemas live in a separate `schemas.ts` next to the action (a Next.js requirement — `"use server"` files may only export async functions).

### Data access

Data access lives in **colocated** `_data.ts` / `queries.ts` files next to the route that uses it, wrapped in `cache()` from React so a layout and its page don't double-hit the DB in one render pass. There is **no** `src/server/data-access/` directory — don't create one.

Revalidate with `revalidatePath` (50 files use it). `revalidateTag` has **zero** usages in `src/`; if you think you need it, you're introducing a second caching convention.

### Machine status is derived, never stored

There is no `status` column on the `machines` table — a machine's operational status is computed at read time from its open issues. `src/lib/machines/status.ts` is the source of truth for the algorithm and the label/style helpers. Read it rather than reimplementing or restating the rules; an earlier prose copy of this algorithm drifted until it was behaviorally wrong. Query only the columns the derivation needs (`status`, `severity`) when loading issues for it.

### Logging

`docs/LOGGING.md` is canonical — read it for the structured-logging conventions (`log.info` / `log.warn` / `log.error` from `~/lib/logger`, context fields, never log PII).

One UI-specific fact that lives here: **`~/lib/logger` imports `mkdirSync` from `"fs"`, so it cannot be imported into a Client Component.** `console.*` is therefore correct and expected inside `"use client"` files — six of them do it today. Don't "fix" a console call in a client component by swapping in `~/lib/logger`; that breaks the build.

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

Per the **Two-Layer Responsive Framework** (CORE-RESP-001..004): viewport breakpoints (`md:`, `lg:`, `xl:`) for page-level grid columns; container queries for component internals. **`sm:` is padding/spacing only — never `sm:grid-cols-*`.**

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

**`type="text"` for an email field** (CORE-FORM-001):

```tsx
// BAD
<Input id="email" name="email" type="text" autoComplete="username" />

// GOOD
<Input id="email" name="email" type="email" autoComplete="username" />
```

**Shared `autocomplete="new-password"` on new + confirm fields** (CORE-FORM-002):

```tsx
// BAD — password manager autofills the confirm field too
<Input id="new-password"     type="password" autoComplete="new-password" />
<Input id="confirm-password" type="password" autoComplete="new-password" />

// GOOD
<Input id="new-password"     type="password" autoComplete="new-password" />
<Input id="confirm-password" type="password" autoComplete="off" />
```

**Bare animations without `motion-reduce:`** (CORE-A11Y-002):

```tsx
// BAD
<Loader2 className="animate-spin" />

// GOOD
<Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
```

**`<div role="button">`** (CORE-A11Y-004):

```tsx
// BAD
<div role="button" tabIndex={0} onClick={…} onKeyDown={…}>Edit</div>

// GOOD
<button type="button" onClick={…}>Edit</button>
```

**`title` as a tooltip** (CORE-A11Y-005):

```tsx
// BAD — invisible on touch, unreliable in AT
<span title="3 open issues, status needs_service">Service [3]</span>

// GOOD — visible badge + Tooltip for hover/focus enrichment
<Tooltip>
  <TooltipTrigger asChild>
    <span aria-label="Service tab, 3 open issues">Service [3]</span>
  </TooltipTrigger>
  <TooltipContent>3 open issues, status: needs service</TooltipContent>
</Tooltip>
```

**`priority` on non-LCP images** (CORE-PERF-003):

```tsx
// BAD — 32px header logo, never the LCP candidate
<Image src="/logo.png" priority width={32} height={32} />

// GOOD
<Image src="/logo.png" width={32} height={32} />
```

**`<Label htmlFor>` targeting the Radix wrapper instead of the trigger**:

```tsx
// BAD — htmlFor points at the Select wrapper, not the underlying <button>
<Label htmlFor="severity">Severity</Label>
<Select name="severity">
  <SelectTrigger>…</SelectTrigger>
</Select>

// GOOD
<Label htmlFor="severity">Severity</Label>
<Select name="severity">
  <SelectTrigger id="severity">…</SelectTrigger>
</Select>
```

**`window.innerWidth` / `useMediaQuery`** (CORE-RESP-002): use container queries or viewport-breakpoint Tailwind utilities. JS viewport detection causes hydration mismatches.

**`sm:` for structural layout** (CORE-RESP-003): `sm:` is padding/spacing only. `sm:flex-row`, `sm:grid-cols-*`, `sm:hidden`, `sm:block` are forbidden.

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
- [ ] No control reports success for an action it could not perform (CORE-ARCH-012)
- [ ] Direct Server Action references (no inline wrappers)
- [ ] Dropdowns use `onSelect` for Server Actions
- [ ] CSS variables, no hardcoded colors
- [ ] `cn()` used for className merging
- [ ] Semantic HTML (nav, main, article, etc.)
- [ ] ARIA labels for icon-only buttons
- [ ] Responsive design (mobile-first)
- [ ] shadcn/ui components only (no MUI)
- [ ] Input fields carry the correct `type` and `autocomplete` token (CORE-FORM-001, 002)
- [ ] Multi-field forms set `enterkeyhint` per field (CORE-FORM-006)
- [ ] Required fields have a visible `*` indicator (CORE-FORM-005)
- [ ] Every `animate-*` or non-essential `transition-*` pairs with `motion-reduce:` (CORE-A11Y-002)
- [ ] No `<div role="button">` introduced (CORE-A11Y-004)
- [ ] No `title="..."` as a tooltip (CORE-A11Y-005)
- [ ] If you added a sortable table: `<th scope="col">`, `aria-sort`, accessible name (CORE-A11Y-003)
- [ ] If you added an image with `priority`: it is the LCP candidate for the page's dominant viewport, and `sizes` is set (CORE-PERF-003)
- [ ] If you added an animation, dialog, or layout pattern: searched `modern-web-guidance` for the Widely-available primitive first (CORE-UI-006)

## External References

- **modern-web-guidance** (Google Chrome): `npx -y modern-web-guidance@latest search "<query>"`. The canonical lookup for Widely-available web platform patterns. Each guide tags its Baseline status. CORE-UI-005/006.
- **shadcn/ui docs**: Context7 MCP for the latest component APIs (`mcp__plugin_context7_context7__resolve-library-id` → `query-docs`).
- **Tailwind CSS v4 docs**: Context7 MCP for the latest utilities.
- **MDN**: authoritative reference for any HTML/CSS/JS feature. Cross-check Baseline status.
