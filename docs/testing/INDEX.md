# Index of docs/testing

## 🚀 Agent Quick Start (First 30 Lines)

### Essential Commands

```bash
npm run test           # Run all tests
npm run test:coverage  # Coverage report
npm run test:watch     # Watch mode
npm run check:brief # Fast validation
```

### Core Vitest Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
beforeEach(() => vi.clearAllMocks());
```

### Performance: 7-65x faster than Jest

- Components: 8-10x faster
- Services: 12-19x faster
- API Security: 7-38x faster

### Critical Files for Agents

1. **[vitest-guide.md](./vitest-guide.md)** - **NEW CONSOLIDATED GUIDE** - Complete Vitest patterns, performance data, and all mocking strategies
2. **[architecture-patterns.md](./architecture-patterns.md)** - Multi-tenant, permission testing
3. **[troubleshooting.md](./troubleshooting.md)** - Common issues & solutions

---

## Core Testing Documentation

- **[vitest-guide.md](./vitest-guide.md)**: **✅ CONSOLIDATED GUIDE** - Complete reference for all Vitest testing patterns, mocking strategies, and performance insights. Combines former vitest-best-practices.md and mocking-patterns.md into single authoritative source.
- **[architecture-patterns.md](./architecture-patterns.md)**: Multi-tenant testing patterns, permission-based testing architecture, service layer patterns, and database testing patterns. Based on real migration experience and proven results.
- **[prisma-patterns.md](./prisma-patterns.md)**: Specific testing patterns for Prisma client mocking, database interactions in tests, and data integrity across test runs.
- **[codecov-setup.md](./codecov-setup.md)**: Codecov integration guide with coverage thresholds (50% global, 60% server, 70% lib) and CI/CD pipeline integration.
- **[configuration.md](./configuration.md)**: Testing environment configuration details and framework integration.

## Current Testing Standards

PinPoint uses **Vitest exclusively** for all testing. Migration from Jest is complete with 7-65x performance improvements.

## Performance & Troubleshooting

- **[performance.md](./performance.md)**: This document addresses the performance aspects of testing in PinPoint. It provides insights into optimizing test execution times, identifying performance bottlenecks in the test suite, and strategies for improving the overall efficiency of the testing process. This helps in maintaining a fast feedback loop during development.
- **[troubleshooting.md](./troubleshooting.md)**: This guide provides solutions for common issues and challenges encountered during testing in PinPoint. Enhanced with systematic debugging approaches, error pattern analysis, database query method mismatches, permission system evolution tracking, and progressive validation techniques. Real-world results from achieving 93.9% test pass rate from 87.2% failure rate.

## Quick Reference for Agents

1. **Start with**: `@docs/testing/vitest-guide.md` for all essential patterns and mocking strategies
2. **Reference**: `@docs/testing/architecture-patterns.md` for multi-tenant patterns
3. **Troubleshoot**: `@docs/testing/troubleshooting.md` for systematic debugging

## Current State & Achievements

- **Framework**: Vitest exclusively (Jest migration complete)
- **Performance**: 7-65x execution speed improvements achieved
- **Architecture**: Security-first patterns with comprehensive permission testing
- **Infrastructure**: MSW-tRPC v2.0.1 integration with type-safe API mocking
- **Quality**: Multi-tenant safety through organization scoping enforcement
- **Success Rate**: 87-93% test migration success across all categories
- **Migration Reports**: Historical migration documentation moved to `@docs/lessons-learned/migration-reports/`
