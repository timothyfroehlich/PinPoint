# Palette's Journal

## 2025-11-20 - [Init]

**Learning:** Initialized journal.
**Action:** Will record critical UX/a11y learnings here.

## 2025-11-20 - [Async Feedback Pattern]

**Learning:** `useActionState` (React 19) provides `isPending` out of the box, making it trivial to add loading states to forms without extra state management.
**Action:** Always destructure `isPending` from `useActionState` and use it to disable inputs and show loading feedback.

## 2025-05-18 - CopyButton Accessibility

**Learning:** Icon-only buttons with `sr-only` text often forget to update that text when state changes (e.g., "Copy" -> "Copied"). Static accessible names on dynamic buttons confuse screen reader users.
**Action:** Always verify that `sr-only` text or `aria-label` updates to reflect the current state (success, loading, etc.).
