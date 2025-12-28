## 2025-10-26 - [Dynamic Accessible Names for State Toggles]
**Learning:** Icon-only buttons that toggle state (like Copy/Copied) must update their accessible name (e.g., via `sr-only` text) to reflect the new state immediately. Static labels like "Copy" leave screen reader users unaware of the successful action.
**Action:** When implementing toggle buttons, ensure the `sr-only` text or `aria-label` is dynamic (e.g., `{isCopied ? "Copied" : "Copy"}`).
