## 2025-10-26 - [Sidebar Collapsed State Accessibility]

**Learning:** Collapsed sidebars that hide text must apply `aria-label` to the navigation links, otherwise screen readers perceive them as empty links or just announce the href. Tooltips are often insufficient for accessible naming.
**Action:** Always verify collapsed states of navigation components with a screen reader or by checking accessible names in tests.

## 2025-10-26 - [Delightful Empty States]

**Learning:** Empty states are often overlooked ("No issues reported"). Replacing plain text with a positive icon (like `CheckCircle2`) and reassuring copy ("This machine is running smoothly") turns a "missing data" state into a "success" state, improving user satisfaction.
**Action:** When designing empty states, consider if the "empty" state is actually a "good" state (e.g., inbox zero, no bugs) and style it accordingly.
