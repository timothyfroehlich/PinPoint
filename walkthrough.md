# Walkthrough: Comprehensive UI Review and Documentation Refactor

## Overview

This task focused on a "second pass" cleanup of the UI codebase and documentation to establish a strict, clear hierarchy and enforce best practices. The goal was to remove "cruft" (ad-hoc styles, hardcoded values) and ensure all UI code aligns with the "Modern Dark SaaS" aesthetic and "Server-First" architecture.

## Changes

### 1. Documentation Refactor

- **`docs/UI_GUIDE.md`**: Rewritten as the single source of truth for UI development. Covers tech stack, styling philosophy, component architecture, and troubleshooting.
- **`AGENTS.md`**: Added a "UI Development & Progressive Enhancement" section to guide AI agents.
- **`docs/NON_NEGOTIABLES.md`**: Added strict UI rules (no global resets, no hardcoded spacing, mandatory `cn()` usage).
- **Copilot Instructions**: Updated `.github/COPILOT_INSTRUCTIONS.md` and `.github/copilot-instructions.md` to reference the new documentation structure.
- **`docs/ui-patterns/`**: Created/updated pattern files for Typography, Components, and Styling Principles.

### 2. UI Code Cleanup

- **Fixed `cn()` Usage**: Replaced template literals with `cn()` utility in multiple files:
  - `src/components/password-strength.tsx`
  - Auth pages (`login`, `signup`, `reset-password`, `forgot-password`)
  - `src/app/(app)/machines/page.tsx` & subpages
  - `src/app/(app)/issues/page.tsx` & subpages
  - `src/app/(app)/dashboard/page.tsx`
- **Fixed Missing Imports**: Added missing imports for `cn`, `getIssueStatusStyles`, `getIssueSeverityStyles`, and Lucide icons.
- **Logic Fixes**: Corrected invalid status comparison in `machines/page.tsx`.
- **Created Issue Status Utility**: Created `src/lib/issues/status.ts` to centralize issue status/severity logic and styles.

### 3. Process Improvements

- **GitHub Issue #529**: Created an issue to review Flash Message usage for consistency and security.

## Verification

- **Build**: `npm run build` passed successfully.
- **Preflight**: `npm run preflight` passed successfully.
- **Manual Review**: Verified documentation links and flow.
