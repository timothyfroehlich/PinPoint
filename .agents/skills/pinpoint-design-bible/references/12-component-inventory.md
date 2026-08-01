# Component Inventory (§12)

Check before building something new.

## 12. Component Inventory

**There is no list here on purpose.** `src/components/ui/` (shadcn primitives) and `src/components/{issues,machines,layout,collections}/` (PinPoint components) are the inventory — a hand-maintained duplicate of them went stale, and a stale inventory is worse than none, because it makes you build a second copy of something that already exists.

Search the tree before you build. What this section records is the conventions that searching won't tell you.

### The Picker Pattern (single-select from a list)

**Every single-select picker in PinPoint is Popover + cmdk `Command`.** Not a native `<select>`, not a bare `DropdownMenu` — `MachineCombobox`, `OwnerSelect`, `AssigneePicker`, `BaselineCombobox`, `PinballMapLinkField` and `CollectionCollaborators` all follow it. Copy from one of them; don't reimplement.

The reason it's a rule rather than a preference: PinPoint is built for collections of 100+ machines, and a flat native `<select>` at that length is unusable on mobile — you scroll forever, with no way to narrow. The Popover + `Command` pairing gives type-to-filter, and Radix Popover auto-focuses the search input on open, which is what surfaces the on-screen keyboard. A picker that "works fine" against your ten seeded rows will not work against a real collection.

Two conventions that come with it:

- **Export the filterable list separately from the popover wrapper.** Contexts that already own their own chrome (a dialog, a sheet) should render the list without a redundant nested popover. `MachineCombobox` splits exactly this way.
- **Support native form submission** via an optional hidden input, so a picker can sit in a Server Action form without a bespoke bridge.

### Other standing rules

- **`Sheet` and `Drawer` are different components.** `sheet.tsx` is Radix Dialog; `drawer.tsx` wraps vaul (swipe-to-close, momentum) and is what the mobile "More" menu uses. Pick deliberately.
- **`TooltipProvider` is hoisted once** in `ClientProviders`. Never add a nested provider — the delay config is a single app-wide decision.
- **Never hand-roll `<div role="alert">`** — use shadcn `<Alert>`, which carries the role and the variants.
- **Shape a `Skeleton` like the content that will replace it.** A generic grey box is a worse loading state than none, because the layout jumps when the real content lands.
- **`EmptyState` is the empty-list answer**, not an ad-hoc centred paragraph — it standardises icon, title, body and the optional recovery action.
