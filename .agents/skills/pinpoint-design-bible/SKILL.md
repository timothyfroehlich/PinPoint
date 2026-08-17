---
name: pinpoint-design-bible
description: Design system rules, page archetypes, spacing rhythm, surface hierarchy, responsive strategy, and the player-centric issue severity vocabulary (cosmetic / minor / major / unplayable — never low/medium/high or critical). Sole owner of the browser-support policy (§19 — the Baseline Widely available floor and the per-feature opt-in for Newly available ones), the form-correctness conventions (§20), the picker pattern and component inventory (§12), and the modern-web-guidance lookup (§22). Also the shell contract (§3 — fixed header and tab-bar dimensions, and the z-index hierarchy every overlay sits inside) and the canonical token forms (§18), including the two reds: `bg-destructive` is the fill and is correct behind white, but that red as text on our dark background measures 3.96:1 and fails AA, so destructive text takes `text-destructive-text`. Also the telegraphic status/error copy register (§25 — a bold 2–4 word label plus at most one supporting line, no prose sentences). Use when building any new UI, page, or component; when naming or writing copy for issue severity, a status line, an error reason, or a disabled-control explanation; when positioning against the app shell or picking a z-index; when deciding whether a web platform feature is safe to use; or when writing a form or a single-select picker.
---

# PinPoint Design Bible

## When to Use This Skill

Use this skill when:

- Building a new page or view
- Creating or modifying a component
- Making layout or spacing decisions
- Choosing colors, surfaces, or border treatments
- Working on responsive behavior
- Someone asks about the design system, visual style, or UI patterns

## Section Index

Sections keep their numbers wherever they live — `design-bible §17` resolves through this table.

| §   | Section                       | Where                                                |
| :-- | :---------------------------- | :--------------------------------------------------- |
| 1   | Visual Identity               | this file                                            |
| 2   | Surface Hierarchy             | this file                                            |
| 3   | Shell Contract                | this file                                            |
| 4   | Responsive Strategy           | this file                                            |
| 5   | Page Archetypes               | `references/05-page-archetypes.md`                   |
| 6   | Spacing Rhythm                | this file                                            |
| 7   | Card & List Patterns          | `references/07-08-cards-and-navigation.md`           |
| 8   | Navigation Patterns           | `references/07-08-cards-and-navigation.md`           |
| 9   | Typography Scale              | `references/09-11-typography-borders-transitions.md` |
| 10  | Border & Divider Rules        | `references/09-11-typography-borders-transitions.md` |
| 11  | Transition Durations          | `references/09-11-typography-borders-transitions.md` |
| 12  | Component Inventory           | `references/12-component-inventory.md`               |
| 13  | Cross-Cutting UI States       | `references/13-14-states-and-feedback.md`            |
| 14  | Feedback Decision Tree        | `references/13-14-states-and-feedback.md`            |
| 15  | Date Formatting Vocabulary    | `references/15-16-dates-and-icons.md`                |
| 16  | Icon Library                  | `references/15-16-dates-and-icons.md`                |
| 17  | Modal Archetypes              | `references/17-modal-archetypes.md`                  |
| 18  | Token Canonical Form          | this file                                            |
| 19  | Browser Support Policy        | `references/19-browser-support.md`                   |
| 20  | Form Correctness Conventions  | `references/20-form-correctness.md`                  |
| 21  | Image Loading Discipline      | `references/21-22-images-and-guidance.md`            |
| 22  | Modern Web Guidance Reference | `references/21-22-images-and-guidance.md`            |
| 23  | Presenting Mockups for Review | `references/23-24-mockups-and-severity.md`           |
| 24  | Severity Vocabulary           | `references/23-24-mockups-and-severity.md`           |
| 25  | Status & Error Copy Register  | `references/25-copy-register.md`                     |

## 1. Visual Identity

PinPoint uses a **dark neon aesthetic** -- deep charcoal backgrounds with neon green and teal accents.

| Token              | Value     | Usage                               |
| :----------------- | :-------- | :---------------------------------- |
| Primary            | `#4ade80` | Actions, active states, CTAs, links |
| Secondary          | `#2dd4bf` | Accents, decorative highlights      |
| Background         | `#0f0f11` | Page background                     |
| Surface            | `#0f0f11` | Content areas, full-width sections  |
| Card               | `#18151b` | Elevated containers                 |
| Surface-variant/30 | --        | Dimmed/closed items                 |

**Purple is not in the palette.** It was removed in favor of teal so the
primary and secondary read as one green-family pairing rather than two
competing brands. Do not reintroduce a purple/magenta/fuchsia secondary, or
raw `purple-*` / `fuchsia-*` / `magenta-*` classes, in new code. The one
exception is the legacy raw-Tailwind purple used for a handful of entries in
`STATUS_CONFIG` and `PRIORITY_CONFIG` (both in
[`src/lib/issues/status.ts`](../../../src/lib/issues/status.ts)) -- those are
tracked for conversion to semantic tokens and should be migrated
opportunistically, not extended.

**Rules:**

- **All color references in component code must use semantic tokens.** Never write raw Tailwind palette classes (`text-purple-400`, `bg-amber-500/20`, `border-fuchsia-500`) or hardcoded hex (`#d946ef`, `bg-[#abcdef]`) anywhere under `src/app/**`, `src/components/**`, or any `.tsx` / `.ts` file that renders or styles UI. Use `text-primary`, `bg-destructive`, `text-muted-foreground`, `border-success/40`, etc.
- **`dark:` utility classes are forbidden.** PinPoint is dark-only; `dark:` classes are dead code. Remove them when you touch a file that still contains them.
- **Design-layer config is the only exception, and the ESLint config is its registry.** A small number of `src/lib/**` modules may write raw Tailwind palette classes, because in those files the raw palette _is_ the design decision being expressed rather than a shortcut around the token system. The authoritative list is the `ignores` array on the `better-tailwindcss` block in `eslint.config.mjs` — read it there; a copy here would be one more thing to drift. Read it with care: that array mixes two unrelated things. Its `src/**` entries are the design-layer exemptions this rule is about; the test, spec, `e2e/**` and fixture globs alongside them are just files the rule doesn't run on, and are not licence to write raw palette classes anywhere. **Adding a file to that list is a design decision, not a lint fix.** If a component is tripping the rule, the answer is almost always a token, not an exemption. Component code consumes the resulting class strings via the config (`STATUS_CONFIG[status].styles`); never replicate those class strings at call sites.
- Status colors come from `STATUS_CONFIG` / `SEVERITY_CONFIG` / `PRIORITY_CONFIG` / `FREQUENCY_CONFIG` -- never freestyle status colors in components.
- Glow effects (`glow-primary`, `glow-secondary`) are for interactive hover states only, never static decoration. Apply `hover:glow-primary` to navigable card surfaces: machine cards (list and dashboard panels), issue cards, and interactive stat cards. Apply `hover:glow-success` to "recently fixed" machine cards where the success color already conveys status semantically. Do not apply any glow to form controls, buttons, modals, destructive actions, nav links, input fields, or dropdown triggers. Glow is permitted **as an interactivity affordance on editable fields** — a text-glow that fades in on hover marks "you can edit this" (`glow-editable-text`, PP-43q3). This is distinct from decorative glow on arbitrary form controls, which remains banned. Editable Machine Settings fields use it via `~/components/machines/settings/affordance`.
- Frosted glass (bg-card with opacity + `backdrop-blur-sm`) is reserved for navigation chrome.
- **Never rely on color alone to convey semantics.** Destructive, warning, success, and status cues must ship with an accessible text label — either visible, or via `aria-label` / `sr-only`. Decorative icons that accompany the color cue should be marked `aria-hidden="true"` so screen readers receive the label, not the icon. Under deuteranopia / protanopia (combined ~8% of men), destructive-red and warning-amber collapse to similar mustard shades and are not distinguishable by hue. Concretely: `<Alert variant="destructive">` and `<Alert variant="warning">` include a leading `AlertOctagon` / `AlertTriangle` (or equivalent) as `aria-hidden` decoration plus body text that names the condition; destructive buttons carry a verb label like "Delete" (with any icon `aria-hidden`); status / severity / priority badges expose `.label` alongside their icon.

## 2. Surface Hierarchy

Pick the surface level based on the element's role:

| When building...                         | Use                               |
| :--------------------------------------- | :-------------------------------- |
| Page background                          | `bg-background` (#0f0f11)         |
| Full-width content section               | `bg-surface` (#0f0f11)            |
| Card, popover, elevated container        | `bg-card` (#18151b, fully opaque) |
| Header, app header, tab bar (nav chrome) | `bg-card/85 backdrop-blur-sm`     |
| Header band inside a card/section        | `bg-muted` (#27272a, opaque)      |
| Closed/archived/dimmed item              | `bg-surface-variant/30`           |

**Key distinction:** Navigation chrome gets the frosted glass treatment (opacity + blur). Content cards are always fully opaque `bg-card`.

**Header band:** when a card or full-bleed section gives its header zone (title + meta) its own surface distinct from the body, use opaque `bg-muted` — the same token table `<thead>`s use. Don't brighten past ~16% white-equivalent: `text-muted-foreground` on the band drops below the 4.5:1 AA floor. Reference implementation: `SettingsSetCard`.

## 3. Shell Contract

These values are fixed. Do not deviate.

| Element        | Value                                                         |
| :------------- | :------------------------------------------------------------ |
| App header     | 56px (`h-14`), `sticky`, `z-20`, frosted glass                |
| Bottom tab bar | 56px min-height, `fixed`, `z-50`, `md:hidden`                 |
| Tab bar safe   | `env(safe-area-inset-bottom)` padding                         |
| Content bottom | `pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0`         |
| Scroll padding | `scroll-pt-14 md:scroll-pt-14`                                |
| Mobile/desktop | `md:` (768px) is THE breakpoint (standard viewport, no hacks) |

**If you add a new page:** it MUST include the content bottom padding or content will be hidden behind the tab bar on mobile.

## 4. Responsive Strategy

PinPoint uses a **two-layer responsive framework**. Each layer has a distinct job. Never use both layers to solve the same layout problem.

### Layer 1 — Viewport Breakpoints (page structure)

Use viewport breakpoints when the decision depends on the browser window size — showing or hiding entire sections, switching page-level grid columns, top-level padding.

| Breakpoint    | Viewport        | Role                 | Example                                       |
| :------------ | :-------------- | :------------------- | :-------------------------------------------- |
| `md:`         | 768px           | Primary layout pivot | Single column → multi-column, show nav icons  |
| `lg:` / `xl:` | 1024px / 1280px | Element enrichment   | Icon-only → icon+text, secondary chrome       |
| `sm:`         | 640px           | Padding/spacing only | `sm:px-8`, `sm:gap-4` — no structural changes |

**Which of `lg:` and `xl:` a given piece of chrome enriches at is a per-component fitting decision, not a rule** — it depends on how much is competing for the same row. Read the component; don't assume from this table.

**`sm:` is padding only.** Never use `sm:grid-cols-2`, `sm:flex-row`, or `hidden sm:block`.

### Layer 2 — Container Queries (component internals)

Use container queries when the decision depends on the component's available width — not the viewport. A component inside the issue detail content column has less space than the same component full-width, regardless of screen size.

**These are NOT viewport sizes.** They are the width of the nearest `@container` ancestor.

| Query   | Container width | Typical use                                     |
| :------ | :-------------- | :---------------------------------------------- |
| `@lg:`  | 512px           | First internal layout shift (e.g., stack → row) |
| `@xl:`  | 576px           | Expanded row layout, additional columns         |
| `@2xl:` | 672px           | Further enrichment, multi-column grids          |
| `@3xl:` | 768px           | Full-featured component layout                  |

### Decision Tree

```
"Show/hide entire section?" → Viewport (md: / lg:)
"Component internal layout?" → Container query (@lg: / @xl:) if variable-width parent, else viewport
```

### z-index Hierarchy

| Element        | Value |
| :------------- | :---- |
| App header     | z-20  |
| Bottom tab bar | z-50  |
| Modals (Radix) | z-50+ |

### Rules

- Mobile-first: write the mobile layout, then add `md:` / `@lg:` overrides.
- `md:` shows/hides sections and sets page structure. `lg:` and `xl:` enrich elements (icon → icon+text).
- **Don't move an existing breakpoint to match this document.** AppHeader in particular carries an inline comment recording the overflow constraint that put its nav labels where they are — that comment exists because the obvious-looking breakpoint was tried and broke the header. Read the component's own comments before "correcting" a tier; a spec is not evidence about a layout that has already been fitted.
- **No JavaScript viewport detection.** No `window.innerWidth`, `useMediaQuery`, or `matchMedia` — use CSS. These cause hydration mismatches and duplicate CSS's job.
- **`@container` propagation:** Adding `@container` to a parent changes how all descendant container queries resolve. Audit children before adding it to an existing element.
- **Overflow testing:** Every page must pass `assertNoHorizontalOverflow()` in its smoke test, at both mobile (375px) and desktop (1024px) viewports. Add new pages to `e2e/smoke/responsive-overflow.spec.ts`. It makes **two** assertions, and the second is the one that catches real bugs. `scrollWidth <= clientWidth` is kept as a cheap backstop, but under the app shell it can never fail — `overflow-x: hidden` on `<html>`/`<body>` means an overrun is clipped rather than widening the document — so it only bites on surfaces rendered outside the shell. The assertion that finds the mobile-overflow class is an element walk for visible content that a **non-scrollable** ancestor has clipped off-screen; real scroll containers (carousels, tab strips) are treated as fine, and there's a small tolerance for deliberate graceful clipping. Read `e2e/support/actions.ts` before changing what a page does about overflow — a page tuned to satisfy only the `scrollWidth` half is tuned to satisfy a check that cannot fail.
- **Two hooks are sanctioned exceptions**, not one: `use-table-responsive-columns` (PP-rs9) and `use-is-mobile` (PP-43q3). Both are named as exceptions in CORE-RESP-001..004 (`docs/NON_NEGOTIABLES.md`), and each carries its own justification in its docstring.

  The **test** for a third — which is the part that lives nowhere but here: the hook must swap _behavior_, never layout. Two different component trees with different event wiring is a legitimate exception, because CSS genuinely cannot express it. Two stylings of one tree is not, no matter how awkward the CSS. If CSS _can_ express it, CSS wins, and "it was easier in JS" has already been rejected twice.

## 6. Spacing Rhythm

### Page-Level Vertical Padding

| Context                   | Value           |
| :------------------------ | :-------------- |
| Standard pages            | `py-10`         |
| Settings / forms          | `py-6`          |
| Detail pages (mobile-adj) | `py-4 sm:py-10` |

### Horizontal Padding

MainLayout provides `px-4 sm:px-8 lg:px-10`. Pages use `max-w-* mx-auto` only -- do NOT add their own `px-*`.

### Section & Content Gaps

| Context                | Value       |
| :--------------------- | :---------- |
| Standard section gaps  | `space-y-6` |
| Major detail sections  | `space-y-8` |
| Card grids             | `gap-6`     |
| Main + sidebar layouts | `gap-8`     |

### Card Padding

Use shadcn defaults: `CardHeader` (px-6 pt-6 pb-3), `CardContent` (px-6 pb-6). Override only with a documented reason. Compact cards use `p-3`.

## 18. Token Canonical Form

`globals.css` defines two parallel token vocabularies. The MD-era tokens predate Tailwind v4's semantic token naming and are kept in CSS for backward compatibility, but new code must use the canonical Tailwind semantic tokens.

| MD-era (deprecated in code) | Canonical Tailwind semantic |
| :-------------------------- | :-------------------------- |
| `text-on-surface`           | `text-foreground`           |
| `text-on-surface-variant`   | `text-muted-foreground`     |
| `bg-error-container`        | `bg-destructive/10`         |
| `text-on-error-container`   | `text-destructive-text`     |

**Rules:**

- **New code uses the canonical tokens.** No exceptions.
- **When editing a file that uses deprecated tokens, migrate them as part of the change.** Opportunistic cleanup — don't go out of your way, but don't leave deprecated tokens next to your edits.
- **CSS variable definitions stay.** The deprecated tokens are still defined in `globals.css`; existing code keeps working during migration. Eventually the MD-era tokens will be removed, but not in a single sweep.
- **Exception: `bg-surface-variant/30`.** The dimmed/closed item surface (Section 2) has no Tailwind-semantic equivalent and is intentional design. Keep it.

### Quick cheatsheet

| Need                        | Use                     |
| :-------------------------- | :---------------------- |
| Body text                   | `text-foreground`       |
| Secondary / helper text     | `text-muted-foreground` |
| Primary accent (links/CTAs) | `text-primary`          |
| Error text                  | `text-destructive-text` |
| Primary CTA background      | `bg-primary`            |
| Subtle background           | `bg-muted`              |
| Destructive CTA background  | `bg-destructive`        |
| Destructive container bg    | `bg-destructive/10`     |
| Card background             | `bg-card`               |
| Dimmed/closed item          | `bg-surface-variant/30` |

**Two reds, and they are not interchangeable.** `bg-destructive` (#dc2626,
red-600) is the FILL — white on it is 5.3:1, which is correct. But that same
red used as TEXT on our dark background is only **3.96:1**, under AA's 4.5:1
for normal text. So destructive _text_ uses `text-destructive-text` (#ef4444,
red-500 — 5.09:1): outline buttons, error copy, required-field markers, form
validation messages. Reach for `text-destructive` and you will ship an AA
failure.

The original token comment ("red-600 passes ~5.3:1") described only the
white-on-red case and made the untested inverse look checked — which is how
79 usages accumulated before anyone measured.

**This rule is ahead of the codebase.** Only the machine Manage tab has been
converted; `src/components/ui/form.tsx` (`FormMessage`), `ui/alert.tsx`'s
destructive variant, and the auth screens still carry the failing token.
**PP-mjms** sweeps them. Write new code to the rule above — don't take a
neighbouring file as the example.
