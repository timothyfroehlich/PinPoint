---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx"
---

# Components Instructions (Server-First, Single-Tenant)

## Core Principles

- Default: Server Components (no `"use client"` unless interactivity truly needed).
- Keep components thin: fetch directly with Drizzle in Server Components.
- Client islands only for: event handlers, browser APIs, stateful UI patterns.
- Use shadcn/ui primitives + Tailwind CSS v4 utilities, Material Design 3 tokens.

## DO / AVOID

| ✅ Do                                                                 | ❌ Avoid                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| Server Component page shells                                          | Whole pages marked `"use client"` unnecessarily          |
| Minimal client wrappers for buttons/forms                             | Importing MUI or adding new design systems               |
| Direct Drizzle queries in Server Components                           | Creating artificial DAL/service layers prematurely       |
| Zod validation in Server Actions (not inside pure display components) | Mixing form parsing logic into presentational components |

## Server vs Client Examples

```tsx
// ✅ Server Component (no client directive)
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

export default async function MachinesPage() {
  const list = await db.select().from(machines).orderBy(machines.name);
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Machines</h1>
      <ul className="divide-y">
        {list.map((m) => (
          <li key={m.id} className="py-2">
            {m.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```tsx
// ✅ Focused client island for a toggle
"use client";
import { useState } from "react";
export function SeverityFilter({
  onChange,
}: {
  onChange: (v: string) => void;
}) {
  const [value, setValue] = useState("all");
  return (
    <div className="flex gap-2">
      {["all", "minor", "playable", "unplayable"].map((s) => (
        <button
          key={s}
          className={
            "px-2 py-1 border rounded " +
            (value === s ? "bg-primary text-on-primary" : "bg-surface")
          }
          onClick={() => {
            setValue(s);
            onChange(s);
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
```

## Styling Guidance

- Colors: Use semantic CSS variables defined in `globals.css` (Material Design 3 palette).
- Avoid ad-hoc hex colors; prefer tokens.
- Compose utility classes; limit custom CSS unless necessary.
- **Class merging (CORE-UI-003)**: always `className={cn("default-classes", className)}` using `~/lib/utils`. Never ``className={`default-classes ${className}`}`` — template literals don't resolve Tailwind conflicts and break parent overrides.
- **No inline styles** unless coordinates are truly dynamic (CORE-UI-004). Use Tailwind utilities or CSS variables.
- **No hardcoded spacing on reusable primitives** (CORE-UI-002). A `Button` or `Input` must not own outer margins — let callers pass `className`.

## Two-Layer Responsive Framework (CORE-RESP-001..004 / AGENTS.md §2.1 #13)

PinPoint uses two distinct responsive layers — **never mix them for the same layout decision**:

- **Viewport breakpoints** (`md:`, `lg:`, `xl:`) for **page structure** — show/hide sections, top-level grid columns, sidebar visibility.
- **Container queries** (`@lg:`, `@xl:`, `@container`) for **component internals** — flex direction inside a card, padding inside a panel, column count of an embedded list. Components placed in variable-width containers (sidebars, dialogs) MUST use container queries.
- `sm:` (640px) is **padding/spacing only** — never `sm:flex-row`, `sm:grid-cols-2`, `hidden sm:block`. The primary layout pivot is `md:` (768px).
- **No JavaScript viewport detection** — no `window.innerWidth`, `useMediaQuery`, `matchMedia` hooks. Pure CSS. Sole documented exception: `use-table-responsive-columns` for IssueList (PP-rs9).
- **New pages require overflow coverage** — add the route to `e2e/smoke/responsive-overflow.spec.ts`. Horizontal overflow is invisible to Playwright visibility assertions but breaks the user experience.

## Import Patterns

- Use path alias: `~/` for source root. Example:

```ts
import { deriveMachineStatus } from "~/lib/machines/status"; // ✅
```

No deep relative imports (`../../../`).

## Domain Constraints in UI

- Severity labels: always `minor`, `playable`, `unplayable` (never alternate synonyms).
- Each issue must clearly reference a single machine in UI (no multi-select creation flow in MVP).

## Server→Client Boundary (CORE-SEC-006 / CORE-SEC-007)

- **Minimal RSC payload**: don't pass full ORM/domain objects (`UnifiedUser`, full profile records, full issue rows) as props to `"use client"` components. The RSC payload is visible in page source — leaking emails, roles, internal IDs even on authenticated pages. Map data to the minimal shape the component actually uses before crossing the boundary.
- **Email privacy (CORE-SEC-007)**: never display `reporterEmail` (or any email) outside `/admin/*` views and the user's own settings page. Use the name hierarchy: `reportedByUser.name` → `invitedReporter.name` → `reporterName` → `"Anonymous"`. Applies to UI, timeline events, seed data, and any client-serialized response.

## Error & Loading Boundaries (Deferred)

- Dedicated `error.tsx` & `loading.tsx` screens are deferred to MVP+ per tasks; Copilot should not auto-generate them now.

## Progressive Enhancement Reminder

- Forms: Use `<form action={serverAction}>` pattern. Avoid JS-only submission flows.

## Common Mistakes Copilot Should NOT Suggest

- Adding tRPC routers or multi-tenant org context.
- Converting every component to client for trivial interactions.
- Introducing global state libraries (Redux, Zustand) prematurely.

## Accessibility Baseline

- Semantic elements (`<button>`, `<nav>`, `<section>`); shadcn/ui already includes a11y primitives.
- Formal a11y audit deferred to MVP+; keep code clean for future enhancement.

---

Last Updated: 2026-05-17 (added Two-Layer Responsive Framework CORE-RESP-001..004, cn() rule CORE-UI-003, CORE-SEC-006 minimal RSC payload, CORE-SEC-007 email privacy)
