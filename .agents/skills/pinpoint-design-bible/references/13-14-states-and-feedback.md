# Cross-Cutting UI States & Feedback (§13–§14)

Empty / loading / error state patterns, and where user-action feedback belongs.

## 13. Cross-Cutting UI States

Every page will eventually need one of these three states: empty, loading, error. Each has a canonical pattern. Reach for the pattern first; don't invent a variant.

### Empty State

> **Canonical component.** Use `<EmptyState>` from `~/components/ui/empty-state` whenever a list, collection, or section has zero items to display. Prefer the shared component over hand-rolled inline empty-state layouts so copy, spacing, and visual hierarchy stay consistent across the app.

Use `<EmptyState>` whenever a list, collection, or section has zero items to display.

| Prop          | Purpose                                                              |
| :------------ | :------------------------------------------------------------------- |
| `icon`        | A `lucide-react` icon. Rendered at `size-12` in a muted circle.      |
| `title`       | Short heading (e.g., "No machines yet", "No issues found").          |
| `description` | Optional body text. Explain what would populate this section.        |
| `action`      | Optional CTA — typically a `<Button>` or `<Link>` styled as such.    |
| `variant`     | `"card"` (default, wraps in `<Card>`) or `"bare"` (plain container). |

**When to use each variant:**

- `variant="card"` — the empty state IS the content of the section. Dashboard widgets, standalone "no results" pages.
- `variant="bare"` — the empty state is rendered inside a list that's already wrapped in a `Card` or container. No double-border effect.

**Rules:**

- Never hand-roll an empty state with a raw `<div>` + icon + heading. Always use `<EmptyState>`.
- Icon should be a single lucide icon — not a composition or custom SVG.
- Keep the title under 40 characters. If you need more, use `description`.
- Provide an `action` only if the user can do something productive from here (e.g., "Report the first issue"). Don't provide dead-end CTAs.
- For filtered-result empty states ("no matches for your filter"), the action should be "Clear filters" or similar.

### Loading State

Prefer `<Skeleton>` rectangles shaped like the content that will appear. Skeletons reduce layout shift and communicate progress better than spinners.

| Situation                                    | Use                                                         |
| :------------------------------------------- | :---------------------------------------------------------- |
| Async data not yet available (lists, tables) | `<Skeleton>` rectangles matching the shape of incoming rows |
| In-flight form submission                    | `<Button loading>` — handles spinner + disabled state       |
| Long-running background work                 | Toast with an inline spinner / progress indicator           |
| Optimistic UI (actions with predictable end) | Update immediately, revert on error                         |

**Rules:**

- **No custom spinners outside Button.** Don't import `<Loader2>` or similar directly into components. If you need one, use Button's `loading` prop.
- **Skeletons match shape, not count.** Render 3-5 skeleton rows at most; real data decides the true count.
- **No `loading.tsx` files unless a route takes >500ms to stream initial HTML.** Most pages render fast enough that a skeleton-shaped flicker is worse than the brief "empty for a moment" state.
- **In-place updates stay silent.** A button that toggles a flag doesn't need a skeleton — just update the UI.

### Error State

Three tiers based on scope. Pick the narrowest one that fits.

| Scope                           | Pattern                                                                |
| :------------------------------ | :--------------------------------------------------------------------- |
| Form-level (submission failed)  | `<Alert variant="destructive"><AlertDescription>` at top of form       |
| Field-level (one field invalid) | `<FormMessage>` (react-hook-form) or inline `text-sm text-destructive` |
| Inline list edit (cell update)  | `toast.error("Failed to update X")`                                    |
| Entire route crashed            | `error.tsx` boundary (already implemented)                             |
| Route not found                 | `not-found.tsx` boundary (already implemented)                         |

**Rules:**

- **Never hand-roll `<div role="alert" className="rounded-md border border-red-900/50...">`.** Use `<Alert variant="destructive">` — it already exists in `~/components/ui/alert`.
- **Form-level errors should be announced at the top of the form**, not buried near the submit button. Screen reader users need the error to appear above the inputs.
- **Provide a recovery path.** "Try again" button, a link to contact support, or instructions on what to fix.
- **Don't use toast for form-level errors.** Toasts dismiss themselves and are easy to miss. Use them only for transient async events.

## 14. Feedback Decision Tree

When something happens in response to user action, where should they see feedback?

| What happened                                     | Where to show feedback                                                                              |
| :------------------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| Form submit success → redirect                    | Server Action does the write, then `redirect(...)`; if needed, show success on the destination page |
| Form submit success → stay on page (settings)     | Return success state from the Server Action; `<SaveCancelButtons>` green flash (3s "Saved!")        |
| Form submit error                                 | `<Alert variant="destructive">` at top + `<FormMessage>` under fields                               |
| Field validation error (Zod)                      | Inline `<FormMessage>`                                                                              |
| Inline list edit (status change, priority change) | `toast` for both success and error                                                                  |
| optimistic action (toggle, bookmark)              | Immediate UI update; `toast.error()` on failure                                                     |
| Long-running background work (uploads)            | Toast with progress indicator                                                                       |
| Short in-place work (counter increment)           | Immediate UI update, no notification                                                                |

**Why server-side redirect instead of `toast.success() + router.push()`?** The redirect is part of the action's own result, so the confirmation and the navigation cannot disagree. `toast.success()` + `router.push()` is two independent client steps: the toast can fire while the push fails, leaving the user told the thing succeeded on a page that never moved — the false confirmation CORE-ARCH-012 forbids. Redirecting also unmounts the form as part of the transition, sidestepping React 19's post-action form reset entirely (see `pinpoint-ui` → **Server Action Forms** for the Radix Select carve-out and the CREATE-form reset rules). If a success toast is genuinely needed on the destination page, persist a one-time success state (e.g., via a search param or short-lived cookie read in the destination route) and render it there.

**Rule of thumb:** If the user initiated it and waited → feedback. If it was instant or invisible → no feedback.

**Why not toast for everything?** Toasts are ephemeral and noisy. Use them for transient events (row updated, file uploaded). Use inline alerts for persistent state (form has errors, save failed, retry needed).

**Why `<SaveCancelButtons>` has its own success flash instead of a toast?** Settings pages don't redirect, so a toast would disappear while the user is still looking at the form. A button that briefly turns green keeps the feedback anchored to the action.
