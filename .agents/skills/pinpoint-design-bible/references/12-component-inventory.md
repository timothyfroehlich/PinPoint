# Component Inventory (§12)

Check before building something new.

## 12. Component Inventory

**There is no list here on purpose.** `src/components/ui/` (shadcn primitives) and `src/components/{issues,machines,layout,collections}/` (PinPoint components) are the inventory — a hand-maintained duplicate of them went stale, and a stale inventory is worse than none, because it makes you build a second copy of something that already exists.

Search the tree before you build. What this section records is the conventions that searching won't tell you.

### Choosing a single-select control: cardinality decides

There are two single-select patterns here, and picking between them is **not** a style preference. The test — which neither group's source code states, so it lives here:

> **Is the list bounded and short, or does it grow with the collection?**

**Bounded, short, fixed by the domain** → Radix `Select`. Status, severity, priority, frequency, role, presence, timeline tag. These lists change only when we change the enum, and every option fits on screen at once, so a filter input would be pure overhead.

**Large or unbounded — it grows as the org grows** → **Popover + cmdk `Command`** (the picker pattern). Machines, owners, assignees, collaborators, PinballMap search results, baselines. The large-list pickers are `MachineCombobox`, `OwnerSelect`, `AssigneePicker`, `BaselineCombobox`, `PinballMapLinkField` and `CollectionCollaborators` — copy from one of them rather than reimplementing.

The reason the second group is a rule and not a preference: PinPoint is built for collections of 100+ machines, and a flat list at that length is unusable on mobile — you scroll forever with no way to narrow. Popover + `Command` gives type-to-filter, and Radix Popover auto-focuses the search input on open, which is what surfaces the on-screen keyboard. A picker that "works fine" against ten seeded rows will not work against a real collection.

That argument is exactly why it doesn't generalise: a five-option presence enum has no scrolling problem to solve, and wrapping it in a search-first popover makes it _worse_. Don't migrate a bounded enum onto the picker pattern, and don't reach for `Select` on a list whose length tracks the collection.

Two conventions that come with the picker pattern:

- **Export the filterable list separately from the popover wrapper.** Contexts that already own their own chrome (a dialog, a sheet) should render the list without a redundant nested popover. `MachineCombobox` splits exactly this way.
- **Support native form submission** via an optional hidden input, so a picker can sit in a Server Action form without a bespoke bridge.

### Other standing rules

- **`Sheet` and `Drawer` are different components.** `sheet.tsx` is Radix Dialog; `drawer.tsx` wraps vaul (swipe-to-close, momentum) and is what the mobile "More" menu uses. Pick deliberately.
- **`TooltipProvider` is hoisted once** in `ClientProviders`. Never add a nested provider — the delay config is a single app-wide decision.
- **Never hand-roll `<div role="alert">`** — use shadcn `<Alert>`, which carries the role and the variants.
- **Shape a `Skeleton` like the content that will replace it.** A generic grey box is a worse loading state than none, because the layout jumps when the real content lands.
- **`EmptyState` is the empty-list answer**, not an ad-hoc centred paragraph — it standardises icon, title, body and the optional recovery action.
