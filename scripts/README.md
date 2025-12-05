# Worktree Sync Scripts

## Overview

This directory contains scripts for managing PinPoint's multi-worktree development workflow.

## Python Script (Recommended)

**`sync_worktrees.py`** - Modern Python rewrite with better maintainability

### Features

- Object-oriented design for worktree state management
- Comprehensive error handling with Python exceptions
- Unit tested with pytest
- Rich CLI with argparse
- Type hints for safety
- Better code organization and readability

### Usage

```bash
# Sync current worktree only
python3 scripts/sync_worktrees.py

# Sync specific worktree
python3 scripts/sync_worktrees.py --path /path/to/worktree

# Sync all worktrees
python3 scripts/sync_worktrees.py --all

# Dry-run mode (preview changes)
python3 scripts/sync_worktrees.py --dry-run

# Non-interactive mode
python3 scripts/sync_worktrees.py -y

# Combination
python3 scripts/sync_worktrees.py --all --dry-run -y
```

### Testing

```bash
# Run unit tests
python3 -m pytest scripts/tests/test_sync_worktrees.py -v

# Run with coverage (if pytest-cov installed)
python3 -m pytest scripts/tests/ --cov=scripts --cov-report=term-missing
```

### Requirements

- Python 3.10 or higher
- pytest (for testing only)

## Bash Script (Legacy)

**`sync-worktrees.sh`** - Original 1000+ line Bash implementation

This script is maintained for backward compatibility but the Python version is recommended for new use.

### Usage

```bash
# Same interface as Python version
./scripts/sync-worktrees.sh [options] [worktree path]
```

## What the Scripts Do

Both scripts perform comprehensive worktree management:

### Phase 1: Configuration Validation & Fixing

- Validates and fixes `supabase/config.toml` (ports, project_id)
- Creates/fixes `.env.local` with correct ports and URLs
- Manages `skip-worktree` flags (main worktree vs. others)

### Phase 2: Git State Management

- Stashes uncommitted changes if present
- Tracks pre-merge state for recovery

### Phase 3: Branch Operations

- Handles detached HEAD, main branch, and feature branches
- Merges main into feature branches
- Detects merged PRs using GitHub CLI
- Provides recovery commands on conflicts

### Phase 4: Stash Reapplication

- Pops stashed changes after successful merge
- Handles stash conflicts with recovery guidance

### Phase 5: Dependency & Database Sync

- Runs `npm ci` to sync dependencies
- Restarts Supabase with fresh database
- Regenerates test schema

### Pre-flight Checks

- Ensures no Supabase instances are running
- Warns about legacy Docker volumes
- Verifies main worktree is up-to-date

### Reporting

- Comprehensive status summary
- Recovery commands for conflicts
- Next steps guidance

## Port Allocation

Scripts manage ports according to AGENTS.md:

| Worktree             | Next.js | Supabase API | Database | Project ID           |
| -------------------- | ------- | ------------ | -------- | -------------------- |
| PinPoint             | 3000    | 54321        | 54322    | pinpoint             |
| PinPoint-Secondary   | 3100    | 55321        | 55322    | pinpoint-secondary   |
| PinPoint-review      | 3200    | 56321        | 56322    | pinpoint-review      |
| PinPoint-AntiGravity | 3300    | 57321        | 57322    | pinpoint-antigravity |

## Transition Plan

1. ✅ Python script created with full feature parity
2. ✅ Unit tests implemented
3. ⏳ Validation period: Run both scripts in parallel
4. ⏳ After validation: Deprecate Bash script
5. ⏳ Update documentation to recommend Python version only

## Development

### Adding New Features

1. Implement in Python script first
2. Add unit tests in `scripts/tests/`
3. Test with `--dry-run` mode
4. Validate on all 4 worktrees
5. Update this README

### Testing Best Practices

- Unit tests for pure logic (port calculations, state updates)
- Mock external commands (git, docker, npm) in tests
- Integration tests only when necessary
- Always test dry-run mode

## Troubleshooting

### "Unknown worktree" error

The script only recognizes the 4 standard worktrees. Ensure your worktree is named exactly:

- `PinPoint`
- `PinPoint-Secondary`
- `PinPoint-review`
- `PinPoint-AntiGravity`

### Merge conflicts

Both scripts generate recovery commands. Follow the printed guidance:

1. Option 1: Resolve manually (`git status`, edit, `git add`, `git commit`)
2. Option 2: Abort merge (`git merge --abort`, `git reset --hard <sha>`)
3. Option 3: Accept main's changes (`git checkout --theirs .`)

### Port conflicts

If you see Supabase startup failures:

1. Run `supabase stop --all`
2. Re-run the sync script
3. Check for zombie processes: `docker ps`

## Related Documentation

- `AGENTS.md` - Port allocation table
- `scripts/SYNC_WORKTREES_LESSONS.md` - Lessons learned (if exists)
- `docs/NON_NEGOTIABLES.md` - Skip-worktree patterns
