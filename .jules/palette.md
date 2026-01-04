## 2025-05-18 - Accessibility on `asChild` Buttons
**Learning:** Icon-only buttons that use `asChild` to wrap an anchor tag (e.g., for external links) often miss accessible names because the inner content is just an icon.
**Action:** Always add `aria-label` to the `Button` component when using `size="icon"` and `asChild`.
