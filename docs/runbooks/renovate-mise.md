# Hosted Renovate for mise

PinPoint uses the Mend-hosted Renovate GitHub App only for the exact tool versions
declared in the root `mise.toml`. Dependabot remains the sole owner of npm and
GitHub Actions updates. Docker declarations and every other Renovate manager are
also out of scope.

The repository contract is `.github/renovate.json`:

- `enabledManagers` contains only `mise`, and `includePaths` limits extraction to
  the root `mise.toml`.
- Renovate may prepare pull requests, but `automerge` is explicitly disabled.
- Minor and patch updates of every tool except the Supabase CLI go in one weekly
  `toolchain` PR, with the generated `mise.lock` entries for each. Tim reversed
  the earlier one-PR-per-tool policy on 2026-11-15 to cut merge-line load: armed
  PRs land one at a time, and one PR per tool made each merge force the others to
  rebase. Major updates and the Supabase CLI keep their own PRs. Cooldowns apply
  per tool, not per group: a tool still inside its cooldown is left out of that
  week's group PR and joins a later one.
- Branch creation is limited to Saturday mornings in `America/Chicago`. Ordinary
  releases must be at least 14 days old, Supabase CLI releases at least 7 days old,
  and major releases at least 30 days old. Missing release timestamps fail closed.
- Scheduled lock-file maintenance is disabled. `mise.lock` changes belong only to
  a specific `mise.toml` update proposal.
- Pull requests are created immediately once an eligible version passes the
  cooldown. Targeting `main` triggers the ordinary PR workflow, including the
  required mise canary and the rest of `CI Gate`.

## Human compatibility review

A Renovate proposal is a version-discovery artifact, not compatibility approval.
Review release and migration notes, the `mise.toml` change, and all regenerated
`mise.lock` platform entries before merging.

Supabase CLI proposals additionally require the existing Bazzite
rootless-Podman/SELinux compatibility check and a successful local-stack start on
an SELinux host. Major Node, Python, Ruff, or Supabase releases require the same
explicit migration assessment as a manual proposal. The Supabase CLI stays out of
the `toolchain` group because that compatibility check is its own gate: in a shared
PR a failing Supabase bump would hold back every other tool. Review the `toolchain`
PR as one diff, checking each tool's release notes.

The `packageManager` pnpm pin in `package.json` remains outside Renovate because
enabling the npm manager would overlap Dependabot. The weekly chores procedure
continues to own that 30-day-cooldown check.

## Enable the hosted app

This step requires Tim's GitHub repository-administrator access:

1. Open the [Mend Renovate App](https://github.com/apps/renovate) installation.
2. Choose **Only select repositories** and select only `PinPoint`; do not grant
   organization-wide repository access.
3. Install the app after this configuration and the mise canary are on `main`.

Because a valid configuration is already on the default branch, this is manual
onboarding: Renovate can use it directly instead of merging a bot-generated
`Configure Renovate` configuration. On the first hosted run, inspect the Dependency
Dashboard or hosted job log and confirm that the extracted dependencies come only
from `mise.toml`. The first real proposal must change no npm, GitHub Actions, Docker,
or unrelated dependency files, must update `mise.lock` with `mise.toml`, and must
receive the mise-canary and ordinary `CI Gate` checks.

## Trust boundary and rollback

The hosted service temporarily clones the repository. Its GitHub App has read/write
access to code, checks, commit statuses, issues, pull requests, and workflows, plus
read access to administration metadata and Dependabot alerts. The repository config
narrows Renovate's behavior to one manager and one package file, but it cannot narrow
the permissions granted to the hosted GitHub App.

Refreshing `mise.lock` runs repository-controlled mise input in Renovate's hosted
environment. Renovate invokes modern mise in safe mode for this operation; PinPoint's
minimum mise version retains that safety floor. Even so, review every generated diff:
the app still holds repository write credentials while it prepares branches.

To stop processing immediately, remove `PinPoint` from the GitHub App installation.
As a repository-side reversible stop, set `"enabled": false` in
`.github/renovate.json` and merge that change. After disabling access, close any open
Renovate pull requests. Removing the config is unnecessary unless a future manual
re-onboarding is desired.
