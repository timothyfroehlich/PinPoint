# Changelog

All notable changes to PinPoint will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Issues List**: Pagination support with 25 issues per page. Features include Previous/Next navigation, page number links, URL state persistence (e.g., `/issues?page=2`), and a total issue count display (e.g., "Showing 1-25 of 197 issues"). Filters (status, severity, priority, machine) are preserved when navigating between pages.

### Changed

- **UI/Components**: Redesigned issue status and priority dropdowns with rich shadcn/ui Select components, replacing native HTML elements. Includes grouped status options, tooltips, and improved visual hierarchy with Material Design 3 colors.

### Fixed

- Login process now correctly redirects to the original destination (via `next` parameter) after successful authentication.
- **E2E Tests**: Updated test helpers to work with new shadcn/ui Select components, replacing fragile `.selectOption()` with explicit test ID mapping.

### Deprecated

### Removed

### Security
