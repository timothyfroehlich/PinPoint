# PinPoint Development Instructions (Claude Code)

@AGENTS.md

## 🤖 CLAUDE CODE SPECIFIC FEATURES

### Mandatory Context7 Usage

- **When**: Working with any library/framework (Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest)
- **Why**: Training cutoff January 2025, current date September 2025 - 8+ months behind
- **Process**: `resolve-library-id` → `get-library-docs` → Apply current patterns

### Essential Documentation (Auto-Load)

- **@docs/CORE/NON_NEGOTIABLES.md** - Static analysis patterns
- **@docs/CORE/TYPESCRIPT_STRICTEST_PATTERNS.md** - Type safety patterns
- **@package.json** - Available scripts, dependencies, and project configuration

### Documentation Review Requirement

**CRITICAL**: Any document in `docs/CORE/` that hasn't been reviewed within 5 days must be verified for consistency with the current codebase state before use.

### Feature Specs (docs/feature_specs)

- Location: `docs/feature_specs/` contains a living spec for each feature.
- Required sections, in order: Feature overview (~1 page), Last reviewed/updated (ISO dates), Key source files, Detailed feature spec, Security/RLS spec, Test spec (unit/integration/E2E with acceptance criteria), Associated test files.
- Policy: When a PR changes feature behavior, update the corresponding spec and bump the dates. Reviewers should block behavior changes without spec updates.
- Testing: Create new tests via the `/create-test` workflow and list them under "Associated test files". Follow the testing pyramid described in NON_NEGOTIABLES.
- Authoring guide: See `docs/feature_specs/AGENTS.md` for format and expectations.

## 🛠️ CLAUDE CODE COMMAND GUIDANCE

### Safe Command Alternatives for Agents

- **Search**: `rg --files \| rg "pattern"`, `rg -l "content" --type js`
- **Discovery**: `fd "*.js"`, `fd --type f --changed-within 1day`
- **Repository**: `git ls-files \| grep "\.js$"`
- **Database**: Use `./scripts/safe-psql.sh` and `./scripts/safe-curl.sh` for automated safety

### Agent-Specific Patterns

- **Task Management**: Use TodoWrite tool for complex multi-step tasks
- **Pattern Synchronization**: Update `@docs/developer-guides/general-code-review-procedure.md` when discovering new forbidden/enforced patterns
- **Investigation**: Use investigator agent for comprehensive read-only analysis
- **Enforcement**: Use enforcer agent for systematic code review validation

## 🔍 SPECIALIZED AGENTS

### Available Subagents

- **enforcer** - Comprehensive code review analysis with XML-guided workflows
- **investigator** - Deep systematic analysis and issue identification (read-only)

### Available Commands

- **check-non-negotiables** - Automated pattern violation detection
- **z-smart-rebase** - Intelligent git rebase workflows
- **z-ship-it** - Production deployment workflows

## 📚 ESSENTIAL BUT TOO BIG TO AUTO-LOAD

- **docs/CORE/TARGET_ARCHITECTURE.md** - Architectural authority for all decisions

## 🚀 CURRENT PRIORITIES

- **Test System**: Ready for standardized test types rollout
- **Development**: Server-first with shadcn/ui for new features
- **GitHub Copilot**: Replacing Gemini integration with native GitHub review

## 📋 DOCUMENTATION PHILOSOPHY

- Actionable information only, no justifications or selling points
- Focus on "what" and "how", not "why" something is beneficial
- Designed for efficient LLM consumption, context reminders without persuasion
- Don't commit with --no-verify unless explicitly instructed

**USAGE**: This serves as the Claude Code specific context. The @AGENTS.md file provides general project context for any AI agent.