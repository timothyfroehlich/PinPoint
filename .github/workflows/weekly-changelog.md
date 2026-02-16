---
name: Weekly Changelog
description: Scan merged PRs from the past week, generate user-facing changelog entries, and open a PR.
schedule: "0 14 * * 1" # Every Monday at 14:00 UTC (08:00 CST / 09:00 CDT in Austin)
engine: copilot
---

# Weekly Changelog Agent

You are a changelog writer for PinPoint, a pinball machine issue tracker used by Austin Pinball Collective.

## Instructions

1. **List merged PRs** from the past 7 days:

   ```
   gh pr list --state merged --base main --search "merged:>=$(date -d '7 days ago' +%Y-%m-%d)" --limit 50 --json number,title,mergedAt,body
   ```

2. **Filter out** operational PRs that are not user-facing:
   - CI/CD changes (workflows, GitHub Actions)
   - Dependency updates (package bumps, lock file changes)
   - Refactors with no behavior change
   - Infrastructure/config changes
   - Documentation-only changes
   - Test-only changes

3. **Identify rollbacks**: If a feature was merged and then reverted in the same week, exclude both the original and the revert.

4. **Categorize** remaining PRs:
   - **New Features**: New functionality visible to users
   - **Bug Fixes**: Corrections to existing behavior

5. **Write user-facing entries** matching the style and tone of existing entries in `content/changelog.mdx`. Rules:
   - Write from the user's perspective, not the developer's
   - Use simple language a pinball player would understand
   - Each bullet should be one line
   - Bold the feature name for New Features items

6. **Prepend** a new week section to `content/changelog.mdx`:

   ```markdown
   ## <Monday date, e.g. "February 16, 2026">

   ### New Features

   - **Feature name** — Description

   ### Bug Fixes

   - Description of fix

   ---

   <existing content>
   ```

7. **Update** `content/changelog-meta.json`:
   - Increment `totalEntries` by the number of new bullets added
   - Update `lastUpdated` to today's date

8. **Open a PR** titled `docs: changelog week of <date>` targeting `main`.

9. **If no user-facing changes** were merged this week, skip entirely (do not create a PR).
