# Browser Support Policy (§19)

The Baseline Widely available floor, what is in scope, what is deferred, and how to opt in.

## 19. Browser Support Policy

PinPoint's UI is built on **Baseline Widely available** (CORE-UI-005) — features that have been cross-browser stable for ~2.5 years. This is the support floor for every new component, layout, animation, and form pattern.

**shadcn/ui and Radix remain the design system.** The Baseline floor is the _platform layer underneath_ — what we trust to "just work" in our users' browsers. We don't migrate components off Radix to chase native primitives; we layer Widely-available web platform features (`:user-invalid`, `inert`, container queries, `:has()`, `fetchpriority`, `motion-reduce:`, `aspect-ratio`, `enterkeyhint`, autocomplete tokens, semantic `<table>` markup, native `required`/`pattern` validation, etc.) onto our shadcn-based components so they get the full benefit of the platform.

### What is in-scope today

| Capability                                  | Where it shows up in PinPoint                              | Baseline since |
| :------------------------------------------ | :--------------------------------------------------------- | :------------- |
| Container queries (`@container`)            | IssueMetadata, IssueTimeline, AddCommentForm, ImageGallery | Feb 2023       |
| `:has()`                                    | DOM-state-driven styling, removes JS mirroring             | Dec 2023       |
| `:user-valid` / `:user-invalid`             | Shared Input/Textarea primitives (CORE-FORM-003)           | Nov 2023       |
| `inert` attribute                           | Background regions when modals open (CORE-A11Y-006)        | Mar 2022       |
| `aspect-ratio`                              | ImageGallery, calendar day cells                           | Mar 2021       |
| `accent-color`                              | Checkbox/radio/range accent matching                       | May 2022       |
| `fetchpriority` (img/script/link)           | LCP candidate images (Next/Image `priority`)               | Sep 2023       |
| CSS subgrid                                 | Multi-column form alignment                                | Sep 2023       |
| `gap` on flexbox                            | Standard spacing everywhere                                | Apr 2021       |
| `prefers-reduced-motion` (`motion-reduce:`) | Every animation utility (CORE-A11Y-002)                    | Jul 2020       |
| `focus-visible`                             | All interactive primitives in `src/components/ui/`         | Mar 2022       |
| Native form validation (`required` …)       | Every form                                                 | (pre-Baseline) |
| `enterkeyhint`                              | Multi-field forms (CORE-FORM-006)                          | Dec 2021       |
| Logical properties (`inline-start`)         | RTL-ready text alignment                                   | Mar 2023       |
| Native `<dialog>`                           | Narrow one-off cases — see §17                             | Mar 2023       |
| Native `<details>` / `<summary>`            | Trivial disclosure where Accordion would be overkill       | (pre-Baseline) |

### What is deferred (Baseline Newly available)

These are not in PinPoint today. They require a per-feature opt-in here in §19 before adoption.

- **Popover API** (`popover="auto"` / `popover="hint"`) — Radix Popover/DropdownMenu/Tooltip already cover the use cases.
- **View Transitions** (same-document and cross-document) — interesting for navigation polish; defer.
- **CSS anchor positioning** — would simplify some popover/tooltip placement; Radix's JS-driven positioning already works.
- **Scroll-driven animations** — `animation-timeline: scroll()` and friends. Defer.
- **`text-wrap: balance`** — partially adopted (we use `text-balance` selectively per §9), but treat as Newly available and check support per use.
- **`interestfor` attribute** for tooltips — Chrome-only as of late 2025; defer.
- **`closedby` attribute** on `<dialog>` — Limited availability (no Safari).

### Adopted below the Baseline floor (safe-no-op progressive enhancements)

A feature below the Widely-available floor may still be used **when the browsers
that lack it degrade to a harmless no-op** (never a broken experience) and a
Widely-available primitive already covers the same need as the floor. Each such
feature is listed here with its status, why it degrades safely, and the
cross-browser floor that carries the non-supporting browsers.

| Feature                                         | Status                  | Degrades to                            | Cross-browser floor                                                 |
| :---------------------------------------------- | :---------------------- | :------------------------------------- | :------------------------------------------------------------------ |
| `interactive-widget=resizes-content` (viewport) | Limited (Chromium-only) | The browser default (`resizes-visual`) | `scrollIntoView`-on-focus + `scroll-margin` in the settings editors |

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

1. Open a PR that adds a row to the "in-scope" table above (or moves one from "deferred").
2. Document the fallback strategy in the row (e.g., "Use `@supports` to feature-detect; fall back to existing pattern X").
3. Link the spec/explainer + the MWG guide id.
4. Add the feature to `pinpoint-ui` skill's relevant section.

Don't sneak a Newly-available feature in without updating this section — it's the single source of truth for what the project considers safe.
