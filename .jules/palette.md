## 2025-10-26 - [Sidebar Collapsed State Accessibility]
**Learning:** Collapsed sidebars that hide text must apply `aria-label` to the navigation links, otherwise screen readers perceive them as empty links or just announce the href. Tooltips are often insufficient for accessible naming.
**Action:** Always verify collapsed states of navigation components with a screen reader or by checking accessible names in tests.
