# Layout Patterns, Anti-Patterns & References

Page composition, the anti-pattern catalog, troubleshooting, and external references.

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
<div className="mt-2.5 text-destructive-text">
```

## External References

- **modern-web-guidance** (Google Chrome): `npx -y modern-web-guidance@latest search "<query>"`. The canonical lookup for Widely-available web platform patterns. Each guide tags its Baseline status. CORE-UI-005/006.
- **shadcn/ui docs**: Context7 MCP for the latest component APIs (`mcp__plugin_context7_context7__resolve-library-id` → `query-docs`).
- **Tailwind CSS v4 docs**: Context7 MCP for the latest utilities.
- **MDN**: authoritative reference for any HTML/CSS/JS feature. Cross-check Baseline status.
