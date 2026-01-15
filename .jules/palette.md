## 2026-01-04 - Accessibility on `asChild` Buttons

**Learning:** Icon-only buttons that use `asChild` to wrap an anchor tag (e.g., for external links) often miss accessible names because the inner content is just an icon.
**Action:** Always add `aria-label` to the `Button` component when using `size="icon"` and `asChild`.

## 2025-10-26 - [Delightful Empty States]

**Learning:** Empty states are often overlooked ("No issues reported"). Replacing plain text with a positive icon (like `CheckCircle2`) and reassuring copy ("This machine is running smoothly") turns a "missing data" state into a "success" state, improving user satisfaction.
**Action:** When designing empty states, consider if the "empty" state is actually a "good" state (e.g., inbox zero, no bugs) and style it accordingly.

## 2025-10-26 - [Sidebar Collapsed State Accessibility]

**Learning:** Collapsed sidebars that hide text must apply `aria-label` to the navigation links, otherwise screen readers perceive them as empty links or just announce the href. Tooltips are often insufficient for accessible naming.
**Action:** Always verify collapsed states of navigation components with a screen reader or by checking accessible names in tests.

## 2025-12-18 - [Accessible Interactive Table Cells]

**Learning:** When placing interactive elements (like `Select` or `Button`) inside data tables, relying solely on column headers is insufficient for screen reader users navigating by control. A simple "Edit" or "Select" announcement lacks context.
**Action:** Pass the row entity's name (e.g., user name) to the interactive component and use it in a dynamic `aria-label` (e.g., "Change role for John Doe").

## 2025-05-21 - [Dynamic Accessible Names for Select Triggers]
**Learning:** Shadcn UI `SelectTrigger` with a static `aria-label` overrides the screen reader announcement of the selected value. This leaves users knowing "Select Status" but not the *current* status.
**Action:** Use a dynamic `aria-label` that includes the current value (e.g., `aria-label={`Status: ${valueLabel}`}`) to provide full context.
