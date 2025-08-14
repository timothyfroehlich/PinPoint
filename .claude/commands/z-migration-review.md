---
description: "Code review tool for drizzle-migration and test-architect agent work"
argument-hint: "[impl|tests|full|pr-number|file-path]"
allowed-tools: "Bash(gh pr view:*), Bash(gh pr diff:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(npm run typecheck:brief), Bash(npm run lint:brief), Bash(npm run test:brief), Bash(rg:*), Bash(wc:*), Bash(cat:*), Bash(echo:*), Bash(head:*), Bash(grep:*)"
---

# Migration Code Review

**Purpose:** Review work from drizzle-migration and test-architect agents using August 2025 best practices.

**Context:** Solo development, direct conversion approach, velocity-focused.

## Usage Modes

- `impl` → Review implementation work (routers, components, schema)
- `tests` → Review testing work (test files, mocks, PGlite)
- `full` → Comprehensive review (default)
- `123` → Review PR #123
- `path/file.ts` → Review specific file

!.claude/scripts/migration-review/migration-review.sh "$ARGUMENTS"
