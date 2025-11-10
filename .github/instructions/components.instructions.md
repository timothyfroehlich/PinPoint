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
| ✅ Do | ❌ Avoid |
|------|---------|
| Server Component page shells | Whole pages marked `"use client"` unnecessarily |
| Minimal client wrappers for buttons/forms | Importing MUI or adding new design systems |
| Direct Drizzle queries in Server Components | Creating artificial DAL/service layers prematurely |
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
        {list.map(m => (
          <li key={m.id} className="py-2">{m.name}</li>
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
export function SeverityFilter({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState("all");
  return (
    <div className="flex gap-2">
      {['all','minor','playable','unplayable'].map(s => (
        <button
          key={s}
          className={"px-2 py-1 border rounded " + (value === s ? "bg-primary text-on-primary" : "bg-surface")}
          onClick={() => { setValue(s); onChange(s); }}
        >{s}</button>
      ))}
    </div>
  );
}
```

## Styling Guidance
- Colors: Use semantic CSS variables defined in `globals.css` (Material Design 3 palette).
- Avoid ad-hoc hex colors; prefer tokens.
- Compose utility classes; limit custom CSS unless necessary.

## Import Patterns
- Use path alias: `~/` for source root. Example:
```ts
import { deriveMachineStatus } from "~/lib/machines/status"; // ✅
```
No deep relative imports (`../../../`).

## Domain Constraints in UI
- Severity labels: always `minor`, `playable`, `unplayable` (never alternate synonyms).
- Each issue must clearly reference a single machine in UI (no multi-select creation flow in MVP).

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
Last Updated: 2025-11-09