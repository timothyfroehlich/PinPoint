# What's New Page — Design

**Date**: 2026-02-16
**Status**: Draft

## Summary

A "What's New" page in the sidebar that surfaces weekly release notes to users. An automated `gh aw` workflow scans merged PRs each Monday, generates user-facing changelog entries, and opens a PR for review. A badge in the sidebar shows the count of unread entries.

## Content Structure

Single rolling MDX file: `content/changelog.mdx`

- Newest week prepended to the top
- Each week has a date heading (`# February 16, 2026`)
- Entries grouped under `## New Features` and `## Bug Fixes`
- Horizontal rules (`---`) separate weeks
- No frontmatter in the MDX itself

Companion metadata file: `content/changelog-meta.json`

```json
{ "totalEntries": 42, "lastUpdated": "2026-02-16" }
```

Updated by the gh aw agent alongside the MDX. Read by `MainLayout` on every page load to compute the badge count (reading a small JSON file is essentially free in a server component).

### Why a single file

The gh aw agent sees previous entries as context, which helps it maintain consistent tone and formatting across weeks. Merge conflicts are unlikely given the weekly cadence and PR-based flow.

## Page Route & UI

- **Route**: `src/app/(app)/whats-new/page.tsx`
- **Shell**: `PageShell` with `size="narrow"` (max-w-3xl) — reading experience
- **Title**: "What's New"
- **Content**: Rendered MDX below the title
- **No pagination**: Growth is slow (~10-15 entries/week). Single scrollable page.
- **On visit**: Client effect calls `storeChangelogSeen(totalEntries)` to clear the badge

## Sidebar Integration

- **Position**: Bottom section, first item (above Help)
- **Icon**: `Sparkles` from lucide-react
- **Label**: "What's New"
- **href**: `/whats-new`
- **Styling**: Matches existing sidebar items exactly
- **Badge**: Numeric count pill next to the label, hidden when 0, capped at `20+`

## Badge / Cookie Tracking

Follows the existing cookie pattern in `lib/cookies/`.

### New additions

- `constants.ts`: `CHANGELOG_SEEN_KEY = "changelogSeen"`
- `preferences.ts`: `getChangelogSeen(): number` — server-side reader (defaults to 0)
- `client.ts`: `storeChangelogSeen(count: number): void` — client-side writer

### Badge calculation

In `MainLayout.tsx` (server component):

```
totalEntries (from changelog-meta.json) - changelogSeen (from cookie) = newCount
```

- `newCount` passed as prop to `Sidebar`
- Capped at `20+` in the UI for new users with large history
- Same cookie config as existing preferences: 1-year max-age, SameSite=Lax, non-httpOnly

### Clearing the badge

The `/whats-new` page includes a small client component that calls `storeChangelogSeen(totalEntries)` on mount.

## gh aw Workflow

**File**: `.github/workflows/weekly-changelog.md`
**Schedule**: Every Monday at 8 AM CST (`cron: '0 14 * * 1'` — UTC)
**Engine**: `copilot` (uses Copilot subscription, ~1-2 premium requests per run)
**Output**: Opens a PR for human review

### Agent instructions

1. List PRs merged to `main` in the past 7 days
2. Filter out operational/internal PRs (CI, deps, refactors, docs-only)
3. Skip anything rolled back in the same period (merged then reverted)
4. Categorize remaining into **New Features** and **Bug Fixes**
5. Write user-facing bullet points matching the style of existing entries
6. Prepend new week section to `content/changelog.mdx`
7. Update `content/changelog-meta.json` with new `totalEntries`
8. Open PR titled `docs: changelog week of <date>`

If no user-facing changes that week, the agent skips (no PR created).

## Historical Backfill

Rebuild weekly notes from the PR history going back to November 2025 (pinpoint-v2 start). This is a separate content task from the feature implementation.

**Approach**: Use git/PR history to reconstruct weekly entries. The feature can land first with a small seed of content, then backfill fills in history.

## Dependencies

- **MDX setup**: Depends on `feat/help-docs-expansion` branch landing first (provides MDX configuration in next.config, packages, etc.)
- **gh aw CLI**: `gh extension install github/gh-aw`

## Scope Exclusions

- No database storage — cookies only
- No per-user server-side tracking
- No email/push notifications for new updates
- No admin UI for managing entries (git + PRs is the workflow)
