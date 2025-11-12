# PinPoint Development Instructions (Claude Code)

@AGENTS.md

## Claude Code Specific Features

### Mandatory Context7 Usage

- **When**: Working with any library/framework (Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest)
- **Why**: Training cutoff January 2025, current date November 2025 - 10+ months behind
- **Process**: `resolve-library-id` → `get-library-docs` → Apply current patterns

### Essential Documentation (Auto-Load)

- **@docs/NON_NEGOTIABLES.md** - Static analysis patterns
- **@docs/TYPESCRIPT_STRICTEST_PATTERNS.md** - Type safety patterns
- **@package.json** - Available scripts, dependencies, and project configuration

### GitHub Workflow Changes (Web Only)

**CRITICAL**: When running in Claude Code web (https://claude.ai/code/), you **CANNOT** push changes to `.github/workflows/` files directly. GitHub Apps are blocked from modifying workflow files without special permissions.

**Detection**: Check `CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE=cloud_default` to determine if you're in web mode.

**Process for Workflow Changes:**

1. Make changes to `.github-staging/workflows/*.yml` instead
2. Commit and push `.github-staging/` changes (allowed by GitHub)
3. Document the changes in commit message
4. User reviews and manually activates: `cp -r .github-staging/workflows .github/`

**Note**: This restriction does NOT apply to:

- Claude Code CLI (local installation)
- Other files in `.github/` like `dependabot.yml` or instruction files
- Regular source code files

See `.github-staging/README.md` for full review process.

## Claude Code Command Guidance

### Safe Command Alternatives

- **Search**: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- **Discovery**: `fd "*.js"`, `fd --type f --changed-within 1day`
- **Repository**: `git ls-files | grep "\.js$"`

### Tool Usage Patterns

- **Task Management**: Use TodoWrite tool for complex multi-step tasks
- **Investigation**: Use investigator agent for comprehensive read-only analysis
- **Enforcement**: Use enforcer agent for systematic code review validation

## Specialized Agents

### Available Subagents

- **enforcer** - Comprehensive code review analysis with XML-guided workflows
- **investigator** - Deep systematic analysis and issue identification (read-only)
- **Explore** - Fast agent for codebase exploration and search

### Available Commands

- **check-non-negotiables** - Automated pattern violation detection

## Documentation Philosophy

- Actionable information only, no justifications or selling points
- Focus on "what" and "how", not "why" something is beneficial
- Designed for efficient LLM consumption, context reminders without persuasion
- Don't commit with --no-verify unless explicitly instructed

**Usage**: This serves as the Claude Code specific context. The @AGENTS.md file provides general project context for any AI agent.
