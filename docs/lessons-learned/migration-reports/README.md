# Migration Reports

This directory contains individual migration reports generated when migrating Jest tests to Vitest.

## Purpose

Each report documents:

- The specific test file migrated
- Time taken for migration
- Performance improvements measured
- Challenges encountered and solutions
- Patterns discovered that can help future migrations

## File Naming Convention

Reports should be named: `YYYY-MM-DD-filename.md`

Example: `2025-01-23-userService.test.md`

## How Reports Are Generated

When using the `/test:migrate` slash command, the agent will:

1. Perform the migration
2. Create a report in this directory
3. Document all findings and patterns

## Using These Reports

These reports serve as:

- Historical record of migration progress
- Pattern library for common solutions
- Performance benchmarks
- Training data for future migrations

## Integration

These individual reports will be periodically reviewed and integrated into:

- `docs/testing/migration-examples.md` - For exemplary migrations
- `docs/testing/troubleshooting.md` - For common issues and solutions
- `docs/testing/mocking-patterns.md` - For reusable patterns
