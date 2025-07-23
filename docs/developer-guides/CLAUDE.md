# Developer Guides

---

status: current
last-updated: 2025-01-20

---

This directory contains comprehensive guides for PinPoint development beyond the essentials in `CLAUDE.md`.

## Available Guides

### 📝 Core Development

- **[TypeScript Strictest Mode](./typescript-strictest.md)** - Comprehensive guide to resolving TypeScript errors and ESLint violations in strictest mode
- **[Testing Guide](../testing/index.md)** - Vitest testing patterns, mocking strategies, and migration guidance
- **[Common Errors](./common-errors.md)** - ESLint rule violations and their fixes with real examples

### 🔧 Tools & Workflow

- **[Betterer Workflow](./betterer-workflow.md)** - Using Betterer for incremental TypeScript migration and regression prevention
- **[Troubleshooting](./troubleshooting.md)** - Common development environment issues and solutions

## Quick Reference

For immediate help, check `CLAUDE.md` first - it contains the essential patterns for 80% of common issues.

### When to Use Each Guide

**Start Here**: `CLAUDE.md` - Essential patterns and quick fixes

**TypeScript Issues**:

- Simple errors → Use patterns in `CLAUDE.md`
- Complex/recurring errors → See `typescript-strictest.md`
- Migration workflow → See `betterer-workflow.md`

**Testing Issues**:

- Basic mocking → Use patterns in `CLAUDE.md`
- Complex test scenarios → See `testing-patterns.md`

**Build/Environment Issues**:

- Check `troubleshooting.md`

## Related Documentation

- **Migration Status**: See `/TYPESCRIPT_MIGRATION.md` for progress tracking
- **Script Usage**: See `/scripts/README.md` for TypeScript analysis tools
- **Architecture**: See `/docs/architecture/` for system design
- **Troubleshooting**: See `/docs/troubleshooting.md` for environment setup

## Contributing to Guides

When adding new patterns or fixes:

1. Add essential patterns to `CLAUDE.md` for immediate access
2. Add detailed explanations to the appropriate guide in this directory
3. Update this README with any new guides
4. Cross-reference between guides where helpful
