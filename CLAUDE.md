# PinPoint Development Instructions (Claude Code)

## Essential Context

**Primary**: @AGENTS.md - Universal baseline for all agents
**Gemini**: @GEMINI.md - Gemini-specific context
**Skills**: Use Agent Skills in `.claude/skills/` for on-demand detailed guidance

## Claude Code-Specific Features

### Context7 MCP Integration

- **When**: Working with libraries (Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest)
- **Why**: Training cutoff January 2025, current December 2025 - need latest docs
- **Process**: `resolve-library-id` → `get-library-docs` → Apply current patterns

### Agent Skills (On-Demand Loading)

Claude Code automatically loads skills when relevant. Available skills:

- **pinpoint-security** - CSP, auth, input validation, Supabase SSR
- **pinpoint-testing** - Test pyramid, PGlite, Playwright, E2E
- **pinpoint-typescript** - Strictest patterns, type guards, optional properties
- **pinpoint-ui** - shadcn/ui, progressive enhancement, Server Components
- **pinpoint-patterns** - Server Actions, data fetching, file organization

Skills load ~100 tokens of metadata always, full content only when needed.

### Specialized Subagents

- **enforcer** - Code review with XML-guided workflows
- **investigator** - Deep read-only analysis and diagnostics
- **Explore** - Fast codebase exploration and search

Use Task tool to launch these agents when appropriate.

### Safe Command Patterns

- **Search**: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- **Discovery**: `fd "*.js"`, `fd --type f --changed-within 1day`
- **Repository**: `git ls-files | grep "\.js$"`

### Tool Usage Best Practices

- **TodoWrite**: Use for complex multi-step tasks to track progress
- **Task**: Launch specialized agents for deep analysis or systematic work
- **Skills**: Loaded automatically when context matches (security, testing, UI, etc.)

## Documentation Structure

**Auto-loaded by Claude Code**:

- This file (CLAUDE.md)
- AGENTS.md (via @AGENTS.md reference)
- package.json
- Skills metadata (~500 tokens for 5 skills)

**On-demand via Skills**:

- docs/SECURITY.md (via `pinpoint-security` skill)
- docs/TESTING_PLAN.md (via `pinpoint-testing` skill)
- docs/TYPESCRIPT_STRICTEST_PATTERNS.md (via `pinpoint-typescript` skill)
- docs/UI_GUIDE.md (via `pinpoint-ui` skill)
- docs/PATTERNS.md (via `pinpoint-patterns` skill)

**Explicit @-mentions**:

- @docs/NON_NEGOTIABLES.md
- @docs/PRODUCT_SPEC.md
- @docs/TECH_SPEC.md
- etc.

## Commit Best Practices

- **Always run**: `pnpm run preflight` before committing
- **Never skip**: Pre-commit hooks (unless explicitly instructed)
- **Verify**: All tests pass, type check passes, lint clean

## Working with Multiple Worktrees

Each worktree has its own ports and Supabase instance. See AGENTS.md for port allocation table.

**Sync script**: `python3 scripts/sync_worktrees.py`
**Config**: `supabase/config.toml` is marked `skip-worktree` in non-main worktrees

## Philosophy

- Actionable information only
- Focus on "what" and "how", not "why"
- Designed for efficient LLM consumption
- Let skills provide deep dives on-demand
