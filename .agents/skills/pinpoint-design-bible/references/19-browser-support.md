# Browser Support Policy (§19)

The Baseline Widely available floor, what is in scope, what is deferred, and how to opt in.

## 19. Browser Support Policy

PinPoint's UI is built on **Baseline Widely available** (CORE-UI-005) — features that have been cross-browser stable for ~2.5 years. This is the support floor for every new component, layout, animation, and form pattern.

**shadcn/ui and Radix remain the design system.** The Baseline floor is the _platform layer underneath_ — what we trust to "just work" in our users' browsers. We don't migrate components off Radix to chase native primitives; we layer Widely-available web platform features (`:user-invalid`, `inert`, container queries, `:has()`, `motion-reduce:`, `aspect-ratio`, `enterkeyhint`, autocomplete tokens, semantic `<table>` markup, native `required`/`pattern` validation, etc.) onto our shadcn-based components so they get the full benefit of the platform.

### What is in-scope today — and why there is no table of it

**PinPoint does not maintain a local Baseline table.** A feature's tier and date must be derived **live**, from `modern-web-guidance`, at the moment you need it (CORE-UI-006, and the commands are below).

This section used to hold a sixteen-row table of features and Baseline dates. It was deleted deliberately. It was a hand-copied cache of data with an authoritative live source, it had silently rotted — several rows had drifted tier or date — and correcting them would only have restarted the clock on the rest. A wrong Baseline date is worse than no date, because it reads as authoritative and nobody re-checks it.

The practical rule is unchanged and doesn't need the table: **if the guide says Widely available, use it directly** — no polyfill, no feature detection, no `@supports` gate. That covers the platform layer this project leans on (container queries, `:has()`, `:user-invalid`, `inert`, `aspect-ratio`, `focus-visible`, `motion-reduce:`, `enterkeyhint`, logical properties, native `<dialog>` and `<details>`, native form validation).

The deleted table also carried a "where it shows up in PinPoint" column. **To find a live example of a feature, grep its name in `src/`** — that answer is always current, which a list of filenames here would not be.

The two lists below are the ones that _are_ decisions — what we've chosen to defer, and what we've chosen to adopt below the floor — and those stay.

### What is deferred (Baseline Newly available)

These are not in PinPoint today. They require a per-feature opt-in here in §19 before adoption.

- **Popover API** (`popover="auto"` / `popover="hint"`) — Radix Popover/DropdownMenu/Tooltip already cover the use cases.
- **View Transitions** (same-document and cross-document) — interesting for navigation polish; defer.
- **CSS anchor positioning** — would simplify some popover/tooltip placement; Radix's JS-driven positioning already works.
- **Scroll-driven animations** — `animation-timeline: scroll()` and friends. Defer.
- **`interestfor` attribute** for tooltips — Chrome-only as of late 2025; defer.
- **`closedby` attribute** on `<dialog>` — Limited availability (no Safari).

### Adopted below the Baseline floor (safe-no-op progressive enhancements)

A feature below the Widely-available floor may still be used **when the browsers
that lack it degrade to a harmless no-op** (never a broken experience) and a
Widely-available primitive already covers the same need as the floor. Each such
feature is listed here with its status, why it degrades safely, and the
cross-browser floor that carries the non-supporting browsers.

| Feature                                         | Status                       | Degrades to                                 | Cross-browser floor                                                 |
| :---------------------------------------------- | :--------------------------- | :------------------------------------------ | :------------------------------------------------------------------ |
| `interactive-widget=resizes-content` (viewport) | Limited (Chromium-only)      | The browser default (`resizes-visual`)      | `scrollIntoView`-on-focus + `scroll-margin` in the settings editors |
| `fetchpriority` (via `next/image` `priority`)   | Newly available (2024-10-29) | The browser's own image-priority heuristics | Next.js `<Image>` srcset/lazy-loading, which is unaffected          |
| `text-wrap: balance` / `text-pretty`            | Newly available              | Normal line breaking                        | The `text-balance` utility is cosmetic-only (§9)                    |

- **`fetchpriority`** — we never write the attribute by hand; it is emitted by Next.js `<Image priority>`, in use on the marketing hero (`src/app/(site)/page.tsx`). A browser that doesn't understand `fetchpriority` ignores the attribute and falls back to its own loading heuristics — exactly the behavior we'd get if we omitted it. So the downside of a non-supporting browser is "the LCP image loads at default priority", never a broken render. Firefox was the last engine to ship it (132, Oct 2024), which is what puts the Baseline date at 2024-10-29 and keeps it out of Widely available until ~Apr 2027. **This entry is the CORE-UI-005 opt-in**; removing `priority` instead would be a real LCP regression for no correctness gain. Usage discipline (one prioritized image per page, LCP candidate only) is §21 / CORE-PERF-003, and is the constraint that actually matters here.
- **`text-wrap: balance` / `text-pretty`** — used selectively per §9. Non-supporting browsers get ordinary line breaking; nothing shifts or clips.
- **`interactive-widget=resizes-content`** — exported once from the root layout (`src/app/layout.tsx`, PP-a0pl). On Chromium (Chrome/Edge/Android) the on-screen keyboard shrinks the **layout** viewport so content reflows above it; **iOS Safari and Firefox ignore it** and keep their own native focus-scroll. That's a strict improvement where honored and a no-op elsewhere — never a regression. The cross-browser floor that actually reaches a focused field on iOS is the `scrollIntoView({ block: "nearest" })` + `scroll-margin` on focus in `RowEditSheet`, `EditableCell`, and `InlineEditableField`. **Verification limit:** no headless tool has a real virtual keyboard, so the Playwright guard (`e2e/full/soft-keyboard-reflow.spec.ts`) proves reachability/reflow under a keyboard-open-height viewport, not pixel-exact keyboard geometry — the latter needs a real device (deferred; PP-a0pl Part 3).

### How to verify a feature's Baseline status

The Google Chrome `modern-web-guidance` catalog tags each guide with its Baseline status. Search it before adopting any pattern:

```bash
npx -y modern-web-guidance@latest search "<query>"
npx -y modern-web-guidance@latest retrieve "<id>"
```

If the guide says "Baseline Widely available" — use directly. If "Baseline Newly available" — follow the guide's documented fallback, or skip the recommendation and add it to the deferred list above.

### Opting in to a Newly-available feature

If a Newly-available feature becomes load-bearing for a planned design:

1. Open a PR that moves it out of the "deferred" list above — into the adopted-below-the-floor table if it degrades to a harmless no-op, otherwise into prose here — with the reasoning.
2. Document the fallback strategy (e.g., "Use `@supports` to feature-detect; fall back to existing pattern X").
3. Link the spec/explainer + the MWG guide id.

Don't sneak a Newly-available feature in without updating this section — it's the single source of truth for what the project considers safe.
