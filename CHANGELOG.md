# Changelog

All notable changes to this project will be documented in this file.

**Format**

- `## YYYY-MM-DD (#PR_NUMBER)`
- List of changes...

> **Note**: Entries should be added _after_ creating the PR so you have the PR number. See [AGENTS.md](AGENTS.md) for the workflow.

## 2025-12-06 (#586)

### Added

- Sentry error tracking and performance monitoring integration
- Feedback widget for user bug reports
- Sentry tunnel route (`/api/sentry-tunnel`) to bypass ad blockers
- Content Security Policy (CSP) updated to allow Sentry domains
- Centralized Sentry configuration for client, server, and edge runtimes
- Reduced Sentry `tracesSampleRate` to 0.1 in production for cost optimization
- Refactored feedback button to a dedicated client component (`FeedbackButton.tsx`)

## 2025-12-05 (#581)

### Added

- Initial setup of CHANGELOG.md
- Mandatory release notes process
