# Palette's Journal

## 2025-11-20 - [Init]

**Learning:** Initialized journal.
**Action:** Will record critical UX/a11y learnings here.

## 2025-11-20 - [Async Feedback Pattern]

**Learning:** `useActionState` (React 19) provides `isPending` out of the box, making it trivial to add loading states to forms without extra state management.
**Action:** Always destructure `isPending` from `useActionState` and use it to disable inputs and show loading feedback.
