# Route Reorganization Design

**Date**: 2026-04-12
**Status**: Approved
**Epic**: PP-yxw (Design Bible & Consistency)

## Problem

The route structure has accumulated inconsistencies:

- Two pages (`/` landing, `/report`) manually import `MainLayout` instead of inheriting it from a layout file
- `/report/success` has no nav chrome at all (custom `<main>` wrapper)
- Auth callback pages (`/auth/auth-code-error`, `/auth/loading`) get no layout — raw unstyled pages
- Dev-only pages (`/dev/*`, `/debug/*`) are mixed in with user-facing pages under `(app)`
- Static content pages (about, privacy, terms, help) share a route group with interactive app pages despite being fundamentally different in nature

## Goals

1. `MainLayout` imported in layout files only — never in individual pages
2. Every user-facing page gets appropriate layout chrome automatically
3. Route groups organized by page purpose, not just auth status
4. All URLs unchanged (except one intentional rename)
5. No Supabase config changes

## Design

### Route groups

Four route groups, each with a clear purpose:

| Group    | Purpose                                              | Layout                   |
| -------- | ---------------------------------------------------- | ------------------------ |
| `(app)`  | Interactive features — things users _do_             | `MainLayout`             |
| `(site)` | Static content — things users _read_                 | `MainLayout`             |
| `(auth)` | Auth flow — login, signup, password reset, callbacks | Centered card + branding |
| `(dev)`  | Dev tools — design system, preview, badges           | `MainLayout`             |

### Final structure

```
src/app/
├── layout.tsx                          ← Root (html/body, Sentry, Toaster)
│
├── (app)/                              ← Interactive app pages
│   ├── layout.tsx                      ← MainLayout
│   ├── admin/
│   │   ├── layout.tsx                  ← Auth gate (admin role check)
│   │   └── users/page.tsx             ← /admin/users
│   ├── dashboard/page.tsx             ← /dashboard
│   ├── issues/page.tsx                ← /issues
│   ├── m/
│   │   ├── page.tsx                   ← /m
│   │   ├── new/page.tsx               ← /m/new
│   │   └── [initials]/
│   │       ├── page.tsx               ← /m/:initials
│   │       └── i/
│   │           ├── page.tsx           ← /m/:initials/i (redirect)
│   │           └── [issueNumber]/
│   │               └── page.tsx       ← /m/:initials/i/:issueNumber
│   ├── report/
│   │   ├── page.tsx                   ← /report
│   │   └── success/page.tsx           ← /report/success (gains nav chrome)
│   └── settings/page.tsx             ← /settings
│
├── (site)/                             ← Static content pages
│   ├── layout.tsx                      ← MainLayout
│   ├── page.tsx                        ← / (landing page)
│   ├── about/page.tsx                 ← /about
│   ├── help/
│   │   ├── page.tsx                   ← /help
│   │   └── admin/page.tsx             ← /help/admin
│   ├── privacy/page.tsx               ← /privacy
│   ├── terms/page.tsx                 ← /terms
│   └── whats-new/page.tsx             ← /whats-new
│
├── (auth)/                             ← Auth pages
│   ├── layout.tsx                      ← Centered card + PinPoint branding
│   ├── login/page.tsx                 ← /login
│   ├── signup/page.tsx                ← /signup
│   ├── forgot-password/page.tsx       ← /forgot-password
│   ├── reset-password/page.tsx        ← /reset-password
│   └── auth/                          ← Real folder — preserves /auth/* URLs
│       ├── callback/
│       │   ├── route.ts               ← /auth/callback (OAuth handler)
│       │   └── route.test.ts
│       ├── auth-code-error/
│       │   └── page.tsx               ← /auth/auth-code-error (gets card layout)
│       └── callback-loading/
│           ├── page.tsx               ← /auth/callback-loading (renamed)
│           └── CallbackLoadingClient.tsx
│
└── (dev)/                              ← Dev-only pages
    ├── layout.tsx                      ← MainLayout
    └── dev/
        ├── design-system/page.tsx     ← /dev/design-system
        ├── preview/page.tsx           ← /dev/preview
        └── badges/page.tsx            ← /dev/badges (was /debug/badges)
```

### URL changes

Only two URLs change:

| Old             | New                      | Impact                                 |
| --------------- | ------------------------ | -------------------------------------- |
| `/auth/loading` | `/auth/callback-loading` | Internal redirects only (2 references) |
| `/debug/badges` | `/dev/badges`            | Dev-only, no external references       |

All other URLs remain identical.

### Code changes per page

**Pages that lose manual `MainLayout` import** (now inherited from layout):

- `src/app/page.tsx` (landing) — remove `MainLayout` wrapper, keep content
- `src/app/report/page.tsx` — remove `MainLayout` wrapper, keep `PageContainer`

**Pages that gain nav chrome**:

- `report/success/page.tsx` — replace custom `<main>` wrapper with `PageContainer size="narrow"`, remove inline container/padding styles

**Pages that gain card layout** (from `(auth)` layout):

- `auth/auth-code-error/page.tsx` — may need minor styling adjustments to work inside card layout
- `auth/loading/page.tsx` (renamed to `callback-loading`) — same

**Report colocated files** (move together with the page):

- `actions.ts`, `actions.test.ts`, `schemas.ts`, `validation.ts`, `validation.test.ts`
- `default-machine.ts`, `default-machine.test.ts`
- `unified-report-form.tsx`
- `success/clear-draft.tsx`

**Dev pages — minor path adjustments**:

- `debug/badges/page.tsx` → `dev/badges/page.tsx`
- Design system and preview pages just move folders, no code changes

**Layout files created** (one-liner each):

- `(site)/layout.tsx` — imports and renders `MainLayout`
- `(dev)/layout.tsx` — imports and renders `MainLayout`

**Internal redirect updates** (for `/auth/loading` → `/auth/callback-loading`):

- `src/app/auth/callback/route.ts` line 71
- `src/app/(auth)/reset-password/page.tsx` line 42

**Test updates**:

- `src/app/auth/callback/route.test.ts` — update expected redirect path
- `src/test/config-validation.test.ts` — no change (tests `/auth/callback`, unchanged)
- `src/lib/supabase/middleware.test.ts` — references `/auth/callback` and `/auth/confirm`, unchanged
- E2E tests referencing `/debug/badges` if any exist

### What does NOT change

- `MainLayout` component — no modifications
- `PageContainer` / `PageHeader` components — no modifications
- `(app)/admin/layout.tsx` auth gate — stays as-is
- Supabase config (redirect URLs) — unchanged
- Middleware — unchanged
- All `(app)` page URLs — unchanged
- All `(site)` page URLs — unchanged
- All `(auth)` page URLs (except loading rename) — unchanged

### Notes

- **`help/admin` has its own auth gate**: The admin help page does its own `createClient()` → `auth.getUser()` → role check inline. It's safe to move to `(site)` — the auth check is in the page itself, not dependent on the `(app)` layout.
- **Middleware is URL-based**: Middleware matches on URL paths, not file paths. Since URLs don't change (except the two noted above), middleware requires no updates.

### Risks and mitigations

1. **Report success gains nav chrome**: Visible UI change. Verify with screenshot that it looks right with AppHeader + BottomTabBar.
2. **Auth error/loading pages inside card layout**: These pages may have their own centering or sizing that conflicts with the `(auth)` layout's card wrapper. Review and adjust after moving.
3. **E2E test breakage**: Grep for `/debug/badges` and `/auth/loading` in E2E specs and update. Run smoke tests after restructuring.
