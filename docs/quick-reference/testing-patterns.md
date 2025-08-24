# Testing Patterns Quick Reference

_Minimal testing patterns for current simplified test system_

## Current Test System (Post-Archive)

**Status**: Simplified baseline system with single test file and essential validation

### Available Commands

```bash
npm test                    # Run unit tests (1 file, 205 tests, ~214ms)
npm run test:watch         # Watch mode for unit tests
npm run test:rls           # pgTAP RLS policy tests
npm run smoke              # Essential Playwright smoke tests
```

### Active Test Infrastructure

**Core Test File**: `src/lib/common/__tests__/inputValidation.test.ts`

- **Pattern**: Pure function unit tests
- **Dependencies**: Vitest only
- **Coverage**: Input validation functions
- **Speed**: Ultra-fast execution

## Current Testing Patterns

### Pure Function Unit Tests

```typescript
// Pattern: Direct function testing with describe blocks
import { describe, it, expect } from "vitest";
import { validateEmail, validatePhoneNumber } from "../inputValidation";

describe("Input Validation", () => {
  describe("validateEmail", () => {
    it("should accept valid email formats", () => {
      expect(validateEmail("user@domain.com")).toBe(true);
      expect(validateEmail("test+tag@example.org")).toBe(true);
    });

    it("should reject invalid email formats", () => {
      expect(validateEmail("invalid-email")).toBe(false);
      expect(validateEmail("@domain.com")).toBe(false);
    });
  });
});
```

### RLS Policy Testing (pgTAP)

```bash
# Run database policy tests
npm run test:rls

# Individual test files
npm run test:rls -- organizations.test.sql
npm run test:rls -- multi-tenant-isolation.test.sql
```

### Smoke Testing (Playwright)

```bash
# Essential UI validation
npm run smoke

# Tests basic authentication and navigation flows
# Located in: e2e/smoke-test-workflow.spec.ts
```

## Archived Infrastructure (Reference Only)

**Location**: `.archived-tests-2025-08-23/`

- ~130 test files with complex integration patterns
- PGlite worker-scoped testing infrastructure
- Multi-config vitest setup
- Comprehensive E2E test suite

**Why Archived**: Test system was over-engineered for pre-beta phase. Focus shifted to velocity and rapid prototyping.

## Future Test System (Planned)

**Reference**: `docs/testing/TEST_SYSTEM_REBOOT_PLAN.md`

**9 Planned Archetypes**:

1. Unit Tests (✅ **Current baseline**)
2. Component Tests
3. Service Tests
4. Repository Tests
5. Router Tests
6. Auth Tests
7. RLS Policy Tests (✅ **Currently active**)
8. Schema Tests
9. Smoke Tests (✅ **Currently active**)

## Testing Philosophy (Pre-Beta)

**Current Approach**:

- **Minimal viable testing** - Catch obvious regressions
- **Focus on velocity** - Don't over-test rapidly changing features
- **Strategic testing** - RLS policies (security-critical) + input validation (data integrity) + smoke tests (basic functionality)

**When to Expand**:

- Core features stabilize and UI/UX decisions finalize
- User feedback indicates specific reliability requirements
- Performance optimization needs detailed metrics

## Anti-Patterns (Current Context)

```typescript
// ❌ Don't create complex test infrastructure yet
describe("Complex Integration Test", () => {
  // Avoid until core features stabilize
});

// ❌ Don't over-mock rapidly changing components
const mockComplexComponent = vi.mock("./Component");
// UI/UX still in flux - mocking adds maintenance burden

// ❌ Don't create comprehensive E2E suites yet
test("Full user journey with 20 steps", () => {
  // Save for post-beta when workflows are stable
});
```

## Quick Decision Guide

**Add a Test If**:

- Pure function with clear input/output contract
- Security-critical database policy (RLS)
- Core data validation logic
- Critical authentication/authorization flow

**Skip Testing If**:

- UI component that changes frequently
- Feature still being designed/prototyped
- Complex integration during architecture shifts
- Non-critical convenience features

---

**Cross-References:**

- Test system status: `docs/testing/INDEX.md`
- Security patterns: `docs/quick-reference/api-security-patterns.md`
- TypeScript patterns: `docs/quick-reference/typescript-strictest-patterns.md`
