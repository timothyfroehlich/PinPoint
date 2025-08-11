---
allowed-tools:
  - Bash(npm run status:overview:*)
  - Bash(npm run status:pr:*)
  - Bash(npm run status:ci:*)
  - Bash(npm run format:write:*)
  - Bash(npm run lint:fix:*)
  - TodoWrite
description: Comprehensive project validation with structured status analysis and summary
---

# Comprehensive Project Status Validation

Perform thorough project health assessment and provide Claude with structured data for analysis and summary.

Arguments: $ARGUMENTS (optional: "fix" for auto-fixing issues)

## Phase 1: Core System Health

### Git & Remote Sync Status

Check repository synchronization and branch status:

**Fetch latest from remote:**
!`git fetch --all`

**Check current branch and remote tracking:**
!`git branch -vv`

**Check if current branch is up to date with remote:**
!`git status -uno`

**Check relationship to main branch:**
!`git log --oneline main..HEAD`
!`git log --oneline HEAD..main`

**Uncommitted changes check:**
!`git status --porcelain`

### Project Overview

Get comprehensive status across all major systems:
!`npm run status:overview`

### Auto-Fix Available Issues

Apply automatic fixes for simple problems:

**Code Formatting:**
If $ARGUMENTS contains "fix" or there are formatting issues detected:
!`npm run format:write`

**Basic Linting Issues:**
Auto-fix simple ESLint violations:
!`npm run lint:fix`

## Phase 2: Remote Integration Status

**Note**: Checking external integrations for complete project context.

### Pull Request Status

Check current PR landscape:
!`npm run status:pr`

### CI/CD Pipeline Status

Check GitHub Actions health:
!`npm run status:ci`

## Analysis & Summary

Based on all the structured status data above, analyze and provide:

### 📊 Executive Summary

**Overall Health Status:** [Analyze all SYSTEM entries and determine: ✅ Healthy / ⚠️ Needs Attention / ❌ Critical Issues]

**System Status Breakdown:**

- **Git Sync:** [Remote sync status, branch relationship to main, uncommitted changes]
- **Dependencies:** [Status from overview + context]
- **Build/TypeScript:** [Status from overview + context]
- **Tests:** [Status from overview + context]
- **Code Quality:** [Status from overview + context]
- **PRs:** [Status from PR check + context]
- **CI/CD:** [Status from CI check + context]

**Priority Actions:** [List most important next steps based on any ❌ or ⚠️ statuses found]

**Development Readiness:** [Yes/No with brief reasoning based on critical systems status]

### 🚀 Quick Status

**Ready for:** [Development/Testing/Deployment based on system health]
**Blockers:** [Any critical issues that must be resolved]
**Maintenance:** [Any non-blocking items that should be addressed soon]

## Usage Examples

- `/z-validate` - Full status validation with summary
- `/z-validate fix` - Include auto-fixing of formatting and linting issues
