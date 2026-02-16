# Help Docs Expansion Design

**Date:** 2026-02-15
**Issue:** PinPoint-d5l (Expand help section)
**Status:** Approved

## Overview

Convert the single-page `/help` into a grouped hub-and-spoke documentation section. The hub page
uses audience-based card groups linking to dedicated subpages. Serves both casual players (quick
on-ramp) and regular APC members (reference material).

## Current State

| Route               | Content                                                    | Audience |
| ------------------- | ---------------------------------------------------------- | -------- |
| `/help`             | Long single page: reporting, severity, frequency, statuses | Everyone |
| `/help/permissions` | RBAC permissions matrix                                    | Everyone |
| `/help/admin`       | Username-only account management (admin-gated)             | Admins   |

## Proposed Structure

### Approach: Grouped Hub + Flat Subpages

The `/help` index becomes a hub with cards organized into 3 audience-based groups. Each card links
to a flat subpage under `/help/*`. Existing pages (`/help/permissions`, `/help/admin`) remain
unchanged.

### Routes

| Route                   | Status       | Content                                     |
| ----------------------- | ------------ | ------------------------------------------- |
| `/help`                 | **Redesign** | Hub page with grouped card links            |
| `/help/getting-started` | **New**      | Quick tour, first report, accounts overview |
| `/help/reporting`       | **New**      | Moved from current `/help` + tips section   |
| `/help/issues`          | **New**      | Statuses, severity, lifecycle, watching     |
| `/help/permissions`     | No change    | RBAC matrix (already exists)                |
| `/help/faq`             | **New**      | Common questions with expand/collapse       |
| `/help/support`         | **New**      | Contact APC, feedback, "something wrong"    |
| `/help/admin`           | No change    | Username accounts (already exists)          |

## Hub Page Design (`/help`)

The hub page organizes cards into 3 groups (+ conditional admin group):

### Card Definitions

| Group            | Card                | Route                   | Icon                    | Description                                        |
| ---------------- | ------------------- | ----------------------- | ----------------------- | -------------------------------------------------- |
| Getting Started  | Getting Started     | `/help/getting-started` | `Compass`               | New to PinPoint? Start here for a quick tour       |
| Getting Started  | Reporting Issues    | `/help/reporting`       | `AlertCircle`           | How to file a clear, useful issue report           |
| Reference        | Issue Lifecycle     | `/help/issues`          | `ArrowRightLeft`        | Statuses, severity levels, and how issues progress |
| Reference        | Roles & Permissions | `/help/permissions`     | `Shield`                | What each access level can do                      |
| Support          | FAQ                 | `/help/faq`             | `MessageCircleQuestion` | Answers to common questions                        |
| Support          | Contact & Support   | `/help/support`         | `LifeBuoy`              | Get help from Austin Pinball Collective            |
| Admin (if admin) | Admin Help          | `/help/admin`           | `Lock`                  | Username accounts and admin procedures             |

### Layout

- `PageShell size="narrow"`
- Responsive 2-column card grid per group (`grid sm:grid-cols-2 gap-4`)
- Cards use shadcn `Card` with `CardHeader` (icon + title) and `CardDescription`
- Each card wrapped in `Link` to its subpage
- Admin group only visible to authenticated admin users

## Subpage Designs

### `/help/getting-started`

Target audience: New APC members or visitors encountering PinPoint for the first time.

Content:

1. **What is PinPoint?** -- 2-3 sentences explaining the app's purpose
2. **Quick Tour** -- Brief walkthrough: Dashboard, Machines, Issues, Report
3. **Your First Report** -- Teaser linking to `/help/reporting`
4. **Accounts & Roles** -- Guest vs member, why to sign up, link to `/help/permissions`

### `/help/reporting`

Content moved from current `/help` page, with minor additions:

1. **How to Report an Issue** -- Existing 7-step guide (moved as-is)
2. **Severity Levels** -- Existing descriptions: cosmetic, minor, major, unplayable (moved)
3. **Frequency** -- Existing descriptions: intermittent, frequent, constant (moved)
4. **Tips for a Good Report** -- New section:
   - Use a specific title ("Left flipper dead on Medieval Madness" not "broken")
   - Say which shot or feature is affected
   - Note if the problem just started or has been ongoing
5. **What Happens After You Report** -- Existing content (moved)

### `/help/issues`

Content moved from current `/help` page, with expansion:

1. **Issue Lifecycle** -- Narrative overview + simple visual flow:
   `new -> confirmed -> in_progress -> fixed`
2. **Status Definitions** -- Existing Open/Closed status grid (moved)
3. **How Assignment Works** -- Techs self-assign or get assigned by admins
4. **Watching Issues & Machines** -- How to opt into notifications

### `/help/faq`

Question-and-answer format with expand/collapse:

| Question                                 | Answer                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| I reported an issue but nothing happened | Triage process explanation, severity-based prioritization |
| How do I change my password?             | Forgot-password flow; username accounts contact admin     |
| Who can see my email?                    | Only admins and yourself; others see display name         |
| I can't edit an issue I reported         | Guest vs member permissions, link to permissions page     |
| How do I become a member?                | Invitation process explanation                            |
| What does "unplayable" mean?             | Link to severity definitions in `/help/reporting`         |
| How do I get notifications?              | Link to settings, watch functionality explanation         |

Implementation note: Use shadcn Accordion for expand/collapse. This is the one page where "use
client" is justified since interactive expand adds real value for scanning.

### `/help/support`

1. **Austin Pinball Collective** -- Link to APC website/social if available
2. **PinPoint Feedback** -- How to report software bugs or suggest features
3. **Something Looks Wrong?** -- Move "If Something Looks Wrong" from current help page

### `/help/permissions` (No change)

Existing RBAC permissions matrix page stays as-is.

### `/help/admin` (No change)

Existing admin-gated username account management page stays as-is.

## Consistent Patterns

All help subpages follow these patterns:

- **Breadcrumb:** `Help / Page Name` (matches existing `/help/permissions` and `/help/admin`)
- **Layout:** `PageShell size="narrow"` with `<header>` block
- **Styling:** `text-sm text-muted-foreground` for body, `font-semibold text-foreground` for terms
- **Component type:** Server Components (except FAQ which uses client Accordion)
- **Navigation:** Breadcrumb back to `/help`. No prev/next between subpages.
- **Auth:** Only `/help/admin` is auth-gated. All other pages are public.

## Files to Create

- `src/app/(app)/help/page.tsx` -- Redesign as hub (modify existing)
- `src/app/(app)/help/getting-started/page.tsx` -- New
- `src/app/(app)/help/reporting/page.tsx` -- New (content moved from current help)
- `src/app/(app)/help/issues/page.tsx` -- New (content moved + expanded)
- `src/app/(app)/help/faq/page.tsx` -- New
- `src/app/(app)/help/support/page.tsx` -- New

## Files Unchanged

- `src/app/(app)/help/permissions/page.tsx` -- No changes
- `src/app/(app)/help/admin/page.tsx` -- No changes

## Testing

- Smoke: All help pages render without errors
- E2E: Navigate help section hub, verify all card links work
- E2E: Verify admin help card only visible to admin users
- Accessibility: Heading hierarchy, link text, keyboard navigation
