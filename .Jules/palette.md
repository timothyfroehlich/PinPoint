## 2025-05-18 - CopyButton Accessibility
**Learning:** Icon-only buttons with `sr-only` text often forget to update that text when state changes (e.g., "Copy" -> "Copied"). Static accessible names on dynamic buttons confuse screen reader users.
**Action:** Always verify that `sr-only` text or `aria-label` updates to reflect the current state (success, loading, etc.).
