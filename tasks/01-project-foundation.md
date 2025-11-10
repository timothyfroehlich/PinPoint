# Task 01: Project Foundation

**Status**: ✅ COMPLETED
**Branch**: `claude/first-task-start-011CUyZWAxEoRWPJr2WGGvA3`
**Completed**: November 10, 2025

## Objective

Initialize npm project, TypeScript, linting, formatting, git hooks, and GitHub Actions. Establish the foundation for all future development with quality gates and tooling.

## Acceptance Criteria

- [x] Can run `npm run dev`
- [x] Can run `npm run typecheck` (passes)
- [x] Can run `npm run lint` (passes)
- [x] Can run `npm run format` (passes)
- [x] Can run `npm run build` (passes)
- [x] GitHub Actions CI workflow created (requires manual GitHub UI addition)
- [x] Pre-commit hooks working (Husky + lint-staged)
- [x] All quality gates passing

## Deliverables Completed

### Core Setup

- ✅ npm project initialized with Next.js 16, React 19, TypeScript 5.9
- ✅ @tsconfig/strictest configuration
- ✅ ESLint 9 with flat config (eslint.config.mjs)
- ✅ Prettier formatting
- ✅ Husky + lint-staged pre-commit hooks
- ✅ Next.js app structure (src/app/, src/components/ui/, src/lib/types/)
- ✅ Tailwind CSS v4 with @tailwindcss/postcss
- ✅ PostCSS configuration
- ✅ Environment file templates (.env.example, .env.local)

### Enhanced Linting (Added based on user request)

- ✅ eslint-plugin-unused-imports - Auto-removes dead imports
- ✅ eslint-plugin-promise - Async/await best practices
- ✅ 20+ high-value rules catching real bugs
- ✅ Comprehensive docs/ESLINT_RULES.md

### Documentation

- ✅ docs/ESLINT_RULES.md - Complete ESLint guide
- ✅ docs/CI_WORKFLOW_SETUP.md - Instructions for manual CI workflow addition

### Package Scripts

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"typecheck": "tsc --noEmit -p tsconfig.json",
"lint": "eslint src/",
"lint:fix": "eslint src/ --fix",
"format": "prettier --check \"**/*.{js,jsx,ts,tsx,json,css,md}\"",
"format:fix": "prettier --write \"**/*.{js,jsx,ts,tsx,json,css,md}\"",
"test": "echo \"Tests will be configured in PR 5\" && exit 0",
"test:watch": "echo \"Tests will be configured in PR 5\" && exit 0",
"test:coverage": "echo \"Tests will be configured in PR 5\" && exit 0",
"smoke": "echo \"E2E tests will be configured in PR 5\" && exit 0",
"preflight": "npm run typecheck && npm test && npm run smoke && npm run lint && npm run format",
"prepare": "husky"
```

## Key Decisions Made

### Decision 1: ESLint 9 Flat Config Instead of Legacy Format

**Why**: ESLint 9 uses flat config by default. Legacy .eslintrc.json is deprecated.

**What**: Created eslint.config.mjs with modern flat config format

**Impact**: Simpler configuration, better performance, future-proof

### Decision 2: Simplified ESLint Rules vs. Archived v1 Complexity

**Why**: Archived v1 has 617 lines of ESLint config with 5 custom rules, multiple security plugins. We're greenfield with zero users.

**What**: Started with ~20 high-value rules that catch real bugs:

- Unused imports (auto-fixable)
- Promise handling (prevents fire-and-forget bugs)
- Type safety (no any, explicit return types)
- Import organization (type imports, path aliases)

**Deferred**:

- Custom rules (need patterns first)
- Security plugins (add when handling untrusted data)
- Next.js plugin (add when we use Next.js-specific components)
- Architectural boundary rules (add when architecture exists)

**Impact**: Clean, maintainable config that grows with actual needs

### Decision 3: Enhanced Linting After User Feedback

**Why**: User wanted "clean from the start" while keeping simplicity

**What**: Added eslint-plugin-unused-imports and eslint-plugin-promise with 20+ rules

**Impact**: Catches 80% of bugs with 20% of complexity. Still far simpler than v1.

### Decision 4: Tailwind CSS v4 with @tailwindcss/postcss

**Why**: Tailwind v4 moved the PostCSS plugin to a separate package

**What**: Installed @tailwindcss/postcss, configured postcss.config.mjs

**Impact**: CSS-based configuration (no tailwind.config.js), simpler setup

### Decision 5: Typecheck Script Only Checks Main App (Not Tests)

**Why**: tsconfig.tests.json has no files yet (tests come in PR 5)

**What**: `"typecheck": "tsc --noEmit -p tsconfig.json"` (removed && for tests config)

**Impact**: Typecheck passes now, will update in PR 5

### Decision 6: CI Workflow via Documentation (Not Pushed)

**Why**: GitHub App lacks workflow permissions, push rejected with 403

**What**: Created docs/CI_WORKFLOW_SETUP.md with instructions for manual GitHub UI addition

**Impact**: CI workflow ready but requires manual step by Tim

## Problems Encountered & Solutions

### Problem 1: ESLint 9 Requires Flat Config

**Issue**: Started with .eslintrc.json, ESLint 9 rejected it

**Solution**: Converted to eslint.config.mjs flat config format

**Lesson**: Check ESLint version requirements before choosing config format

### Problem 2: TypeScript Compiling Archived Directory

**Issue**: tsconfig.json included archived/ causing 1000+ errors

**Solution**: Added `"archived"` to exclude array in tsconfig.json and .eslintrc ignorePatterns

**Lesson**: Always exclude archived/legacy code from compilation

### Problem 3: Tailwind CSS PostCSS Plugin Moved

**Issue**: Build failed with "tailwindcss directly as PostCSS plugin" error

**Solution**: Installed @tailwindcss/postcss, updated postcss.config.mjs to use "@tailwindcss/postcss"

**Lesson**: Tailwind v4 architecture change requires separate postcss package

### Problem 4: Next.js `next lint` Command Didn't Work

**Issue**: `next lint` failed with "Invalid project directory" error

**Solution**: Switched to direct ESLint: `eslint src/` instead of `next lint`

**Lesson**: next lint has specific requirements; direct eslint is more reliable

### Problem 5: React Type Errors in JSX

**Issue**: ESLint error "React is not defined" in layout.tsx and page.tsx

**Solution**: Added `import type React from "react"` to files with React.JSX.Element

**Lesson**: With type-aware linting, need explicit React import for type annotations

### Problem 6: GitHub App Workflow Permission Denied

**Issue**: Push rejected with "refusing to allow a GitHub App to create or update workflow" (403)

**Solution**:

- Removed .github/workflows/ from commit
- Created docs/CI_WORKFLOW_SETUP.md with manual addition instructions
- Left .github/workflows/ untracked locally for Tim to add via GitHub UI

**Lesson**: Workflow files have strict permissions by design, document manual steps

## Lessons Learned for Future Tasks

### Lesson 1: Start Simple, Add Complexity Based on Real Needs

Archived v1's complexity evolved from real pain points. Don't copy it blindly - add rules/plugins when you actually encounter the problems they solve.

### Lesson 2: ESLint Rules Should Catch Bugs, Not Enforce Style

The rules we added prevent production issues:

- Floating promises → silent database failures
- Unused imports → code bloat
- Explicit return types → type inference errors

Style preferences belong in Prettier, not ESLint.

### Lesson 3: Documentation > Comments for Complex Decisions

Created docs/ESLINT_RULES.md explaining the "why" behind each rule with examples. Future agents can reference this instead of reverse-engineering the config.

### Lesson 4: Test Your Quality Gates Early

Ran typecheck/lint/format/build multiple times during setup to catch issues early. Each failure taught us something about the configuration.

### Lesson 5: Archived v1 is a Reference, Not a Template

Use archived v1 to understand what problems we'll eventually face, but don't prematurely add solutions. Let the greenfield v2 evolve naturally.

## What's Ready for Next Task (PR 2: Database Schema)

### Dependencies Installed

- Core: next@16.0.1, react@19.2.0, react-dom@19.2.0
- TypeScript: typescript@5.9.3, @tsconfig/strictest@2.0.7
- Linting: eslint@9.39.1, prettier@3.6.2, eslint-plugin-unused-imports, eslint-plugin-promise
- Build: postcss@8.5.6, @tailwindcss/postcss@4.1.17, tailwindcss@4.1.17

### Configuration Files

- tsconfig.base.json, tsconfig.json, tsconfig.tests.json
- eslint.config.mjs (flat config with 20+ rules)
- .prettierrc, .prettierignore
- postcss.config.mjs (Tailwind v4)
- next.config.ts
- .husky/pre-commit (lint-staged)

### Project Structure

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/           # For shadcn components (PR 4)
└── lib/
    └── types/
        └── index.ts  # Shared TypeScript types
```

### Quality Gates

All passing: ✓ typecheck ✓ lint ✓ format ✓ build

### Package Scripts

Ready for: dev, build, typecheck, lint, format, preflight

### Next Steps for PR 2

1. Install Drizzle ORM and Drizzle Kit
2. Install PostgreSQL driver (postgres package)
3. Create src/server/db/schema.ts
4. Define database tables (user_profiles, machines, issues, issue_comments)
5. Add Drizzle relations
6. Create database trigger for auto-profile creation
7. Update package.json with db:\* scripts

## Manual Steps Required by Tim

### CI Workflow Addition

The GitHub Actions CI workflow is ready at `.github/workflows/ci.yml` but cannot be pushed via git due to workflow permissions.

**Instructions**: See docs/CI_WORKFLOW_SETUP.md

**Options**:

1. Add via GitHub UI (recommended)
2. Grant workflow permissions to Claude Code app

## Dependencies Added

### Production (3)

- next@^16.0.1
- react@^19.2.0
- react-dom@^19.2.0

### Development (14)

- @eslint/eslintrc@^3.3.1
- @eslint/js@^9.39.1
- @tailwindcss/postcss@^4.1.17
- @tsconfig/strictest@^2.0.7
- @types/node@^24.10.0
- @types/react@^19.2.2
- @typescript-eslint/eslint-plugin@^8.46.3
- @typescript-eslint/parser@^8.46.3
- eslint@^9.39.1
- eslint-config-next@^16.0.1
- eslint-config-prettier@^10.1.8
- eslint-plugin-promise@^7.2.1
- eslint-plugin-unused-imports@^4.3.0
- husky@^9.1.7
- lint-staged@^16.2.6
- postcss@^8.5.6
- prettier@^3.6.2
- tailwindcss@^4.1.17
- typescript@^5.9.3

## Updates Needed to CLAUDE.md

Added to tasks/CLAUDE.md:

- ESLint philosophy: Start with 20 high-value rules, add complexity based on real needs
- CI workflow requires manual GitHub UI addition (documented in docs/CI_WORKFLOW_SETUP.md)
- Tailwind CSS v4 requires @tailwindcss/postcss package (not direct tailwindcss in postcss config)
- Always exclude archived/ directory from TypeScript and ESLint
