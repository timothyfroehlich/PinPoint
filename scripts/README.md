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
5. `pnpm install` runs if `node_modules/` doesn't exist

## Port Scheme

```
slot N → Next.js 3000+(N*10), Supabase API 54321+(N*100), DB 54322+(N*100)
```

Main worktree uses default ports (slot 0). All others get dynamically allocated slots.

## Scripts

- **`worktree_setup.py`** — Called by post-checkout hook. Allocates ports, generates configs.
- **`worktree_cleanup.py`** — Called by Claude Code's WorktreeRemove hook. Stops Supabase, removes Docker volumes, deallocates slot. Exit 0 means cleanup actually completed; `1` failed, `2` refused (main worktree), `3` the target path is gone but residue remains (PP-omz3), `4` Supabase volume state was unknown so volumes may have leaked (PP-3w4g). Don't read a non-zero exit as noise — it's the only signal a worktree leaked.

## Testing

```bash
python3 -m pytest scripts/tests/test_worktree_setup.py -v
```
