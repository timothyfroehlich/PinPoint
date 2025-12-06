# Changelog

All notable changes to this project will be documented in this file.

**Format**

- `## #PR_NUMBER - <title>`
- `__YYYY-MM-DD__`
- List of changes...

> **Note**: Entries should be added _after_ creating the PR so you have the PR number. See [AGENTS.md](AGENTS.md) for the workflow.

## #586 - Sentry Integration and Feedback Widget

**2025-12-06**

### Added

- Sentry error tracking and performance monitoring integration for client, server, and edge runtimes
- Sentry feedback widget for user bug reports (integrated with Sentry SDK)
- Sentry tunnel route (`/api/sentry-tunnel`) to bypass ad blockers and improve event delivery
- Feedback button UI component (`FeedbackButton.tsx`) in main layout

### Changed

- Updated Content Security Policy (CSP) to allow Sentry domains (`*.sentry.io`)
- Reduced Sentry `tracesSampleRate` to 0.1 in production for cost optimization
- Added Sentry initialization to application layout and instrumentation

## #581 - Initial Setup of Changelog

**2025-12-05**

### Added

- Initial setup of CHANGELOG.md
- Mandatory release notes process
