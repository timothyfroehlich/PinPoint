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

| ✅ Do                                                                 | ❌ Avoid                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Server Component page shells                                          | Whole pages marked `"use client"` unnecessarily                        |
| Minimal client wrappers for buttons/forms                             | Importing MUI or adding new design systems                             |
| Direct Drizzle queries in Server Components                           | Creating artificial DAL/service layers prematurely                     |
| Zod validation in Server Actions (not inside pure display components) | Mixing form parsing logic into presentational components               |
| shadcn/ui `<Button>` variants for all interactive elements            | Raw `<button>` with custom Tailwind backgrounds                        |
| shadcn/ui `<Card>/<CardHeader>/<CardContent>` for card layouts        | Raw `<div className="border rounded-lg bg-card">` as cards             |
| `cn()` from `~/lib/utils` for className merging                       | Template literal concatenation: `` `class ${dynamic}` ``               |
| Semantic CSS tokens: `text-warning`, `text-primary`, `bg-card`        | Raw palette colors: `text-amber-500`, `bg-purple-900`, `text-cyan-600` |
| `<IssueBadge type="status" value={...}>` for domain fields            | Inline color logic for status/severity/priority/frequency values       |
| `<Skeleton>` from `~/components/ui/skeleton` for loading states       | `animate-spin` spinners or text-only "Loading..." indicators           |
| Lucide icons at standard sizes (`size-4`, `size-5`, `size-12`)        | Icons from heroicons, react-icons, or arbitrary pixel sizes            |
| `<AlertDialog>` confirmation before destructive Server Actions        | Single-click destructive buttons without confirmation                  |
| Mobile-first grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`       | Desktop-first grids: `grid-cols-3` without mobile base                 |

## Server vs Client Examples

```tsx
// ✅ Server Component (no client directive)
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

export default async function MachinesPage() {
  const list = await db.select().from(machines).orderBy(machines.name);
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Machines</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((m) => (
          <Card key={m.id} className="border-border bg-card">
            <CardContent className="py-4">
              <p className="text-foreground">{m.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// ✅ Focused client island for a toggle — use shadcn Button + cn() for class merging
"use client";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const SEVERITIES = ["all", "minor", "playable", "unplayable"] as const;
type Severity = (typeof SEVERITIES)[number];

export function SeverityFilter({
  onChange,
}: {
  onChange: (v: Severity) => void;
}) {
  const [value, setValue] = useState<Severity>("all");
  return (
    <div className="flex gap-2">
      {SEVERITIES.map((s) => (
        <Button
          key={s}
          variant={value === s ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setValue(s);
            onChange(s);
          }}
        >
          {s}
        </Button>
      ))}
    </div>
  );
}
```

## Styling Guidance (CORE-UI-005..017)

Full rules in `docs/UI_NON_NEGOTIABLES.md`. Live style guide at `/debug/`. Key rules:

- **Semantic tokens only**: Use CSS variable tokens (`text-warning`, `text-primary`, `text-muted-foreground`, `bg-card`, `bg-success-container`, etc.). Never raw Tailwind palette colors (`text-amber-500`, `bg-purple-900`).
- **Card variants**: 5 canonical styles — neutral (`border-border bg-card`), primary interactive (`border-primary/20 glow-primary hover:border-primary transition-all cursor-pointer`), success (`border-success/30 bg-success/10 glow-success`), warning (`border-warning/30 bg-warning/10 glow-warning`), destructive (`border-destructive/30 bg-destructive/10 glow-destructive`).
- **Section headings**: In app pages, always override the base `h2` style: `<h2 className="text-xl font-semibold text-foreground mb-4">`. Bare `<h2>` renders at `text-3xl` (MDX scale).
- **Empty states**: Required for every list/grid — `<CardContent className="py-12 text-center">` with `size-12` muted icon + `text-lg text-muted-foreground` message.
- **Page container**: `<div className="max-w-6xl mx-auto py-10 space-y-6">` — no custom padding.
- **className merging**: Always `cn("base-classes", className)` — never template literals.
- **Icon sizes**: `size-4` (inline with text), `size-5` (standalone), `size-12` (empty states).

## Import Patterns

- Use path alias: `~/` for source root. Example:

```ts
import { deriveMachineStatus } from "~/lib/machines/status"; // ✅
import { cn } from "~/lib/utils"; // ✅
import { Button } from "~/components/ui/button"; // ✅
import { Card, CardContent } from "~/components/ui/card"; // ✅
import { IssueBadge } from "~/components/issues/IssueBadge"; // ✅
```

No deep relative imports (`../../../`).

## Domain Constraints in UI

- Status/severity/priority/frequency: always use `<IssueBadge type="..." value={...}>` — never inline color logic.
- Each issue must clearly reference a single machine in UI (no multi-select creation flow in MVP).

## Error & Loading Boundaries

- Loading: Use `<Skeleton>` shaped to match content — not spinners or "Loading..." text.
- Dedicated `error.tsx` & `loading.tsx` screens are deferred to MVP+; Copilot should not auto-generate them now.

## Progressive Enhancement Reminder

- Forms: Use `<form action={serverAction}>` pattern. Avoid JS-only submission flows.

## Common Mistakes Copilot Should NOT Suggest

- Raw `<button>` elements with custom Tailwind backgrounds — use `<Button variant="...">`.
- Raw bordered divs as cards — use `<Card>` component.
- Raw Tailwind palette colors (`text-amber-500`, `text-red-500`, `bg-green-700`) — use semantic tokens.
- Template literal className concatenation — use `cn()`.
- Ad-hoc colored spans for issue status/severity/priority/frequency — use `<IssueBadge>`.
- `animate-spin` spinner divs for loading — use `<Skeleton>`.
- Icons from heroicons, react-icons, @phosphor-icons — use `lucide-react` only.
- Desktop-first grids (`grid-cols-3`) without a mobile base — start `grid-cols-1`.
- Adding tRPC routers or multi-tenant org context.
- Converting every component to client for trivial interactions.
- Introducing global state libraries (Redux, Zustand) prematurely.

## Accessibility Baseline

- Shadcn/ui includes a11y primitives. Icon-only `<Button>` elements need `aria-label`.
- Semantic elements (`<nav>`, `<section>`, `<main>`) — shadcn/ui components handle this internally.
- Formal a11y audit deferred to MVP+; keep code clean for future enhancement.

---

Last Updated: 2026-03-08 (Added CORE-UI-005..017 rules, fixed SeverityFilter example to use Button + cn())
