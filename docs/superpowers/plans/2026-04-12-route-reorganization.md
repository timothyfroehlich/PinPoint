# Route Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize route structure into four purpose-driven route groups, eliminating manual `MainLayout` imports and giving every page appropriate layout chrome.

**Architecture:** File moves + minimal code edits. No new components. Two new one-liner layout files. Two URL renames with internal reference updates.

**Tech Stack:** Next.js App Router route groups, existing `MainLayout` component.

**Spec:** `docs/superpowers/specs/2026-04-12-route-reorganization-design.md`

---

## Summary of all references that change

| Reference    | File                                     | Line | Old             | New                      |
| ------------ | ---------------------------------------- | ---- | --------------- | ------------------------ |
| Redirect     | `src/app/auth/callback/route.ts`         | 71   | `/auth/loading` | `/auth/callback-loading` |
| Redirect     | `src/app/(auth)/reset-password/page.tsx` | 42   | `/auth/loading` | `/auth/callback-loading` |
| Test fixture | `src/lib/supabase/middleware.test.ts`    | 231  | `/debug/badges` | `/dev/badges`            |

---

### Task 1: Create `(site)` route group with layout

**Files:**

- Create: `src/app/(site)/layout.tsx`

- [ ] **Step 1: Create the layout file**

```tsx
import type React from "react";
import { MainLayout } from "~/components/layout/MainLayout";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <MainLayout>{children}</MainLayout>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: No errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(site\)/layout.tsx
git commit -m "feat(routes): create (site) route group with MainLayout"
```

---

### Task 2: Move static content pages to `(site)`

**Files:**

- Move: `src/app/(app)/about/page.tsx` → `src/app/(site)/about/page.tsx`
- Move: `src/app/(app)/help/page.tsx` → `src/app/(site)/help/page.tsx`
- Move: `src/app/(app)/help/admin/page.tsx` → `src/app/(site)/help/admin/page.tsx`
- Move: `src/app/(app)/privacy/page.tsx` → `src/app/(site)/privacy/page.tsx`
- Move: `src/app/(app)/terms/page.tsx` → `src/app/(site)/terms/page.tsx`
- Move: `src/app/(app)/whats-new/page.tsx` → `src/app/(site)/whats-new/page.tsx`

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/app/\(site\)/about src/app/\(site\)/help/admin src/app/\(site\)/privacy src/app/\(site\)/terms src/app/\(site\)/whats-new

git mv src/app/\(app\)/about/page.tsx src/app/\(site\)/about/page.tsx
git mv src/app/\(app\)/help/page.tsx src/app/\(site\)/help/page.tsx
git mv src/app/\(app\)/help/admin/page.tsx src/app/\(site\)/help/admin/page.tsx
git mv src/app/\(app\)/privacy/page.tsx src/app/\(site\)/privacy/page.tsx
git mv src/app/\(app\)/terms/page.tsx src/app/\(site\)/terms/page.tsx
git mv src/app/\(app\)/whats-new/page.tsx src/app/\(site\)/whats-new/page.tsx
```

- [ ] **Step 2: Verify no import path breakage**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: No errors. All imports use `~/` aliases which are path-independent.

- [ ] **Step 3: Run unit tests**

Run: `pnpm run check`
Expected: All checks pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(routes): move static content pages to (site) route group"
```

---

### Task 3: Move landing page to `(site)` and remove manual MainLayout

**Files:**

- Move: `src/app/page.tsx` → `src/app/(site)/page.tsx`
- Modify: `src/app/(site)/page.tsx` (remove MainLayout import and wrapper)

- [ ] **Step 1: Move the file**

```bash
git mv src/app/page.tsx src/app/\(site\)/page.tsx
```

- [ ] **Step 2: Remove the manual MainLayout wrapper**

In `src/app/(site)/page.tsx`:

Remove the import:

```tsx
import { MainLayout } from "~/components/layout/MainLayout";
```

Remove the TODO comment and replace the `<MainLayout>` wrapper. Change:

```tsx
    <MainLayout>
      <div className="space-y-12">
```

to:

```tsx
      <div className="space-y-12">
```

And change the closing:

```tsx
      </div>
    </MainLayout>
```

to:

```tsx
      </div>
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(routes): move landing page to (site), remove manual MainLayout"
```

---

### Task 4: Move report pages to `(app)` and remove manual MainLayout

**Files:**

- Move: `src/app/report/` → `src/app/(app)/report/` (entire directory)
- Modify: `src/app/(app)/report/page.tsx` (remove MainLayout import and wrapper)
- Modify: `src/app/(app)/report/success/page.tsx` (replace custom `<main>` with PageContainer)

- [ ] **Step 1: Move the entire report directory**

```bash
git mv src/app/report src/app/\(app\)/report
```

- [ ] **Step 2: Remove MainLayout wrapper from report page**

In `src/app/(app)/report/page.tsx`:

Remove the import:

```tsx
import { MainLayout } from "~/components/layout/MainLayout";
```

Change the return from:

```tsx
return (
  <MainLayout>
    <PageContainer size="standard">
      <PageHeader title="Report an Issue" />
      ...
    </PageContainer>
  </MainLayout>
);
```

to:

```tsx
return (
  <PageContainer size="standard">
    <PageHeader title="Report an Issue" />
    ...
  </PageContainer>
);
```

- [ ] **Step 3: Update report success page to use PageContainer**

In `src/app/(app)/report/success/page.tsx`:

Add import:

```tsx
import { PageContainer } from "~/components/layout/PageContainer";
```

Replace the outer wrapper. Change:

```tsx
<main className="min-h-screen bg-surface py-12">
  <ClearReportDraft />
  <div className="container mx-auto max-w-xl px-4">...</div>
</main>
```

to:

```tsx
<PageContainer size="narrow">
  <ClearReportDraft />
  ...
</PageContainer>
```

Remove the `<div className="container mx-auto max-w-xl px-4">` wrapper — `PageContainer size="narrow"` handles the max-width (`max-w-3xl`) and centering.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(routes): move report pages to (app), remove manual MainLayout"
```

---

### Task 5: Move auth callback pages into `(auth)/auth/` and rename loading

**Files:**

- Move: `src/app/auth/callback/` → `src/app/(auth)/auth/callback/`
- Move: `src/app/auth/auth-code-error/` → `src/app/(auth)/auth/auth-code-error/`
- Move: `src/app/auth/loading/` → `src/app/(auth)/auth/callback-loading/`
- Rename: `LoadingClient.tsx` → `CallbackLoadingClient.tsx`
- Modify: `src/app/(auth)/auth/callback-loading/page.tsx` (update import)
- Modify: `src/app/(auth)/auth/callback-loading/CallbackLoadingClient.tsx` (rename component)
- Modify: `src/app/(auth)/auth/auth-code-error/page.tsx` (remove own `<main>` wrapper — card layout handles centering)
- Modify: `src/app/(auth)/auth/callback/route.ts` (update redirect path)
- Modify: `src/app/(auth)/reset-password/page.tsx` (update redirect path)

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/app/\(auth\)/auth/callback src/app/\(auth\)/auth/auth-code-error src/app/\(auth\)/auth/callback-loading

git mv src/app/auth/callback/route.ts src/app/\(auth\)/auth/callback/route.ts
git mv src/app/auth/callback/route.test.ts src/app/\(auth\)/auth/callback/route.test.ts
git mv src/app/auth/auth-code-error/page.tsx src/app/\(auth\)/auth/auth-code-error/page.tsx
git mv src/app/auth/loading/page.tsx src/app/\(auth\)/auth/callback-loading/page.tsx
git mv src/app/auth/loading/LoadingClient.tsx src/app/\(auth\)/auth/callback-loading/CallbackLoadingClient.tsx
```

- [ ] **Step 2: Update the callback-loading page to use renamed component**

In `src/app/(auth)/auth/callback-loading/page.tsx`, change:

```tsx
import { LoadingClient } from "./LoadingClient";
```

to:

```tsx
import { CallbackLoadingClient } from "./CallbackLoadingClient";
```

And change:

```tsx
return <LoadingClient nextPath={nextPath} />;
```

to:

```tsx
return <CallbackLoadingClient nextPath={nextPath} />;
```

- [ ] **Step 3: Rename the exported component in CallbackLoadingClient.tsx**

In `src/app/(auth)/auth/callback-loading/CallbackLoadingClient.tsx`, change:

```tsx
export function LoadingClient({
```

to:

```tsx
export function CallbackLoadingClient({
```

- [ ] **Step 4: Adapt auth-code-error page for card layout**

The `(auth)` layout provides centering and a `max-w-md` wrapper. The current page has its own `<main className="mx-auto max-w-lg p-6">` which would conflict.

In `src/app/(auth)/auth/auth-code-error/page.tsx`, change:

```tsx
export default function AuthCodeErrorPage(): ReactElement {
  return (
    <main className="mx-auto max-w-lg p-6">
      <section className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Sign-in Error</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t complete your sign-in. The authorization code was
          missing or invalid.
        </p>
        <div className="pt-2">
          <a href="/" className="underline">
            Return to home
          </a>
        </div>
      </section>
    </main>
  );
}
```

to:

```tsx
export default function AuthCodeErrorPage(): ReactElement {
  return (
    <section className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Sign-in Error</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t complete your sign-in. The authorization code was
        missing or invalid.
      </p>
      <div className="pt-2">
        <a href="/" className="underline">
          Return to home
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Update redirect path in callback route handler**

In `src/app/(auth)/auth/callback/route.ts`, line 71, change:

```tsx
    ? `/auth/loading?next=${encodeURIComponent(next)}`
```

to:

```tsx
    ? `/auth/callback-loading?next=${encodeURIComponent(next)}`
```

- [ ] **Step 6: Update redirect path in reset-password page**

In `src/app/(auth)/reset-password/page.tsx`, line 42, change:

```tsx
redirect("/auth/loading?next=/reset-password?retry=1");
```

to:

```tsx
redirect("/auth/callback-loading?next=/reset-password?retry=1");
```

- [ ] **Step 7: Clean up empty auth/ directory**

```bash
# Verify auth/ is now empty
ls src/app/auth/ 2>/dev/null && echo "NOT EMPTY — check before deleting" || echo "Already gone"
# git mv should have cleaned it up, but verify
```

- [ ] **Step 8: Verify it compiles**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(routes): move auth callback pages into (auth)/auth/, rename loading to callback-loading"
```

---

### Task 6: Create `(dev)` route group and move dev pages

**Files:**

- Create: `src/app/(dev)/layout.tsx`
- Move: `src/app/(app)/dev/design-system/page.tsx` → `src/app/(dev)/dev/design-system/page.tsx`
- Move: `src/app/(app)/dev/preview/page.tsx` → `src/app/(dev)/dev/preview/page.tsx`
- Move: `src/app/(app)/dev/preview/preview-client.tsx` → `src/app/(dev)/dev/preview/preview-client.tsx`
- Move: `src/app/(app)/debug/badges/page.tsx` → `src/app/(dev)/dev/badges/page.tsx`

- [ ] **Step 1: Create the layout file**

```tsx
import type React from "react";
import { MainLayout } from "~/components/layout/MainLayout";

export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <MainLayout>{children}</MainLayout>;
}
```

- [ ] **Step 2: Create directories and move files**

```bash
mkdir -p src/app/\(dev\)/dev/design-system src/app/\(dev\)/dev/preview src/app/\(dev\)/dev/badges

git mv src/app/\(app\)/dev/design-system/page.tsx src/app/\(dev\)/dev/design-system/page.tsx
git mv src/app/\(app\)/dev/preview/page.tsx src/app/\(dev\)/dev/preview/page.tsx
git mv src/app/\(app\)/dev/preview/preview-client.tsx src/app/\(dev\)/dev/preview/preview-client.tsx
git mv src/app/\(app\)/debug/badges/page.tsx src/app/\(dev\)/dev/badges/page.tsx
```

- [ ] **Step 3: Update middleware test fixture**

In `src/lib/supabase/middleware.test.ts`, line 231, change:

```tsx
    "/debug/badges",
```

to:

```tsx
    "/dev/badges",
```

- [ ] **Step 4: Update middleware itself if it references /debug/**

Check: The actual middleware (`src/lib/supabase/middleware.ts`) does NOT reference `/debug/` — confirmed by grep. No change needed.

- [ ] **Step 5: Verify it compiles and tests pass**

Run: `pnpm run check`
Expected: All checks pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(routes): create (dev) route group, consolidate dev pages under /dev/"
```

---

### Task 7: Clean up empty directories and verify

**Files:**

- Remove: any empty directories left behind by `git mv`
- Verify: all URLs work, all tests pass

- [ ] **Step 1: Clean up empty directories**

```bash
# git mv should clean up, but verify no empty dirs remain
find src/app/auth -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
find src/app/\(app\)/dev -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
find src/app/\(app\)/debug -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
find src/app/\(app\)/about -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
find src/app/\(app\)/help -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
find src/app/\(app\)/privacy -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
find src/app/\(app\)/terms -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
find src/app/\(app\)/whats-new -type d -empty 2>/dev/null | xargs rmdir 2>/dev/null
```

- [ ] **Step 2: Verify final directory structure**

```bash
find src/app -name "page.tsx" -o -name "layout.tsx" -o -name "route.ts" | sort
```

Expected structure should match the spec's "Final structure" tree.

- [ ] **Step 3: Run full check**

Run: `pnpm run check`
Expected: All checks pass (types, lint, format, unit tests).

- [ ] **Step 4: Run smoke tests**

Run: `pnpm run smoke`
Expected: All smoke tests pass — URLs are unchanged (except the two renames which aren't tested in E2E).

- [ ] **Step 5: Visual verification of report success page**

The report success page now gets AppHeader + BottomTabBar. Take a screenshot or manually verify it looks correct with nav chrome.

- [ ] **Step 6: Commit any cleanup**

```bash
git add -A
git commit -m "chore: clean up empty directories after route reorganization"
```

---

### Task 8: Update spec and close out

- [ ] **Step 1: Update spec status**

In `docs/superpowers/specs/2026-04-12-route-reorganization-design.md`, change:

```
**Status**: Approved
```

to:

```
**Status**: Complete
```

- [ ] **Step 2: Commit**

```bash
git add docs/
git commit -m "docs: mark route reorganization spec as complete"
```
