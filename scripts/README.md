# Worktree Port Management

## Overview

Worktree port allocation is handled automatically by the `post-checkout` hook.
When you run `git worktree add`, the hook detects the fresh worktree and configures it
with unique Supabase ports — no manual setup needed.

## How It Works

1. `git worktree add /path branch` creates the worktree
2. Husky's `post-checkout` hook fires → calls `scripts/worktree_setup.py`
3. A slot (1-96) is allocated from `~/.config/pinpoint/worktree-slots.json`
4. `supabase/config.toml`, `.env.local`, and `.claude/launch.json` are generated with unique ports
5. If pnpm's `node_modules/.modules.yaml` completion marker is absent, setup reads the exact Node pin from `mise.toml` and the integrity-qualified pnpm pin from `package.json`, requires the complete tuple to match the trusted main worktree, verifies both versions are already installed under mise without loading the linked-worktree config, and runs that exact pnpm with auto-install and system fallback disabled

## Port Scheme

```
slot N → Next.js 3000+(N*10), Supabase API 54321+(N*100), DB 54322+(N*100)
```

Main worktree uses default ports (slot 0). All others get dynamically allocated slots.

## Scripts

- **`worktree_setup.py`** — Called by post-checkout hook. Allocates ports, generates configs.
- **`worktree_cleanup.py`** — The complete teardown entry point for Claude, Codex, reap, and manual callers: `python3 scripts/worktree_cleanup.py <worktree-path>`. Claude uses `--claude-hook`; configure Codex cleanup as `python3 scripts/worktree_cleanup.py .`. It stops Supabase, removes volumes, removes/prunes the Git worktree, then releases the slot. Exit `0` means complete; `1` failed, `2` refused the main worktree, `3` found a missing target with residue, and `4` removed the worktree while Docker state was unknown. Preserve non-zero codes as the leak diagnostic.

## Python Toolchain & Testing

- **Runtime:** Python and Ruff use the exact pins in `mise.toml`, with artifacts locked in `mise.lock`.
- **Scripts:** All scripts use `#!/usr/bin/env python3` and rely strictly on the Python standard library.
- **Dependencies:** `scripts/requirements.txt` explicitly documents `pytest==9.0.3` for the test suite. Install it into the selected runtime with `mise exec -- python3 -m pip install -r scripts/requirements.txt`.
- **Checks:** `pnpm run check:python` runs `ruff check`, `ruff format --check`, and fast unit tests (`pytest scripts/tests/ -m "not integration"`).
- **Full suite:** `pnpm run test:python:all` runs the complete unit and integration test suite (`pytest scripts/tests/`).

```bash
# Run fast script and hook unit tests (~14s)
pnpm run check:python

# Run the full test suite (unit + integration)
pnpm run test:python:all

# Or run pytest directly with the repository's compact defaults
python3 -m pytest scripts/tests/
```

The default traceback policy does not serialize local variables because tests may
retain environment credentials. For deep local debugging only, first sanitize the
environment, then explicitly opt in with
`python3 -m pytest -vv --showlocals -s <test>`. Never use that override in CI or
agent-visible logs.
