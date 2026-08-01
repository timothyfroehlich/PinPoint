# Accessibility Patterns & Motion

What PinPoint adds on top of Radix's built-in a11y, plus the `motion-reduce:` rule.

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
