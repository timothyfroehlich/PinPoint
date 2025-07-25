# Index of docs/testing

## 🚀 Agent Quick Start (First 30 Lines)

### Essential Commands

```bash
npm run test           # Run all tests
npm run test:coverage  # Coverage report
npm run test:watch     # Watch mode
npm run quick    # Fast validation
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

1. **[vitest-best-practices.md](./vitest-best-practices.md)** - Complete patterns & performance data
2. **[mocking-patterns.md](./mocking-patterns.md)** - MSW-tRPC, service mocking
3. **[architecture-patterns.md](./architecture-patterns.md)** - Multi-tenant, permission testing
4. **[troubleshooting.md](./troubleshooting.md)** - Common issues & solutions

---

## Core Testing Documentation

- **[vitest-best-practices.md](./vitest-best-practices.md)**: **ESSENTIAL FOR AGENTS** - Complete Vitest patterns, performance data, MSW-tRPC integration, and real migration results. Contains all critical info in first 50 lines for quick agent reference.
- **[configuration.md](./configuration.md)**: This document details the configuration of the testing environment for PinPoint. It covers how different testing frameworks and tools are set up and integrated into the development workflow, ensuring consistency and efficiency in test execution.

## Current Testing Standards

PinPoint uses **Vitest exclusively** for all testing. Migration from Jest is complete.

## Testing Patterns & Architecture

- **[mocking-patterns.md](./mocking-patterns.md)**: This document details various mocking patterns and strategies used in PinPoint's testing. Enhanced with MSW-tRPC v2.0.1 integration patterns, VitestTestWrapper usage, and version-specific API troubleshooting. Provides guidance on how to effectively mock dependencies, external services, and complex components to ensure isolated and reliable unit tests.
- **[architecture-patterns.md](./architecture-patterns.md)**: **NEW** - Consolidates proven architecture patterns for testing PinPoint's multi-tenant, permission-based system. Covers multi-tenancy testing patterns, permission-based testing architecture, service layer patterns, database testing patterns, MSW-tRPC integration, and systematic testing approaches. Based on real migration experience and proven results.
- **[prisma-patterns.md](./prisma-patterns.md)**: This document focuses on specific testing patterns and strategies for working with Prisma in the PinPoint application. It covers how to effectively mock Prisma client, handle database interactions in tests, and ensure data integrity and isolation across test runs. This guide is essential for testing database-dependent logic.

## Performance & Troubleshooting

- **[performance.md](./performance.md)**: This document addresses the performance aspects of testing in PinPoint. It provides insights into optimizing test execution times, identifying performance bottlenecks in the test suite, and strategies for improving the overall efficiency of the testing process. This helps in maintaining a fast feedback loop during development.
- **[troubleshooting.md](./troubleshooting.md)**: This guide provides solutions for common issues and challenges encountered during testing in PinPoint. Enhanced with systematic debugging approaches, error pattern analysis, database query method mismatches, permission system evolution tracking, and progressive validation techniques. Real-world results from achieving 93.9% test pass rate from 87.2% failure rate.

## Quick Reference for Agents

1. **Start with**: `@docs/testing/vitest-best-practices.md` for essential patterns
2. **Reference**: `@docs/testing/architecture-patterns.md` for multi-tenant patterns
3. **Troubleshoot**: `@docs/testing/troubleshooting.md` for systematic debugging
4. **Mock Setup**: `@docs/testing/mocking-patterns.md` for MSW-tRPC integration

## Current State & Achievements

- **Framework**: Vitest exclusively (Jest migration complete)
- **Performance**: 7-65x execution speed improvements achieved
- **Architecture**: Security-first patterns with comprehensive permission testing
- **Infrastructure**: MSW-tRPC v2.0.1 integration with type-safe API mocking
- **Quality**: Multi-tenant safety through organization scoping enforcement
- **Success Rate**: 87-93% test migration success across all categories
