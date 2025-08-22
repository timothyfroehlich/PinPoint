# Testing Documentation

**Status**: ✅ **Phase 3.3 Complete** - Two validated archetype approaches established through systematic implementation

Three specialized testing archetypes with clear agent assignment, now enhanced with validated Phase 3.3 implementation patterns.

## 🎯 Testing Archetype Decision Guide (Updated from Phase 3.3)

**What kind of test are you writing?**

```
┌─ No database interaction needed? ──→ Unit Testing Archetype
│  ├─ Pure functions, validation logic
│  ├─ React component behavior
│  └─ Business logic calculations
│
├─ Database operations or full-stack testing? ──→ Integration Testing Archetype
│  ├─ tRPC router operations (2 validated approaches)
│  ├─ Service layer with database
│  ├─ Multi-table workflows
│  └─ Schema constraints
│
└─ Security boundaries or policies? ──→ Security Testing Archetype
   ├─ RLS policy validation
   ├─ Cross-organizational isolation
   ├─ Permission matrix testing
   └─ Multi-tenant security
```

### 🚀 **Phase 3.3 Validated Approaches**

**For tRPC Router Testing**: Choose your implementation approach:

**Archetype 5 (tRPC Router Integration with Mocks)**:

- ✅ Fast execution (avg 200-400ms per test)
- ✅ Simulated RLS behavior via mocks
- ✅ SEED_TEST_IDS for consistent test data
- ✅ Example: `issue.comment.test.ts` (22/22 passing)
- 🎯 Best for: Complex router logic, permission scenarios

**Archetype 3 (PGlite Integration RLS-Enhanced)**:

- ✅ Real database operations with constraints
- ✅ True organizational boundary validation
- ✅ Worker-scoped memory safety
- ⚠️ Requires proper RLS context establishment
- 🎯 Best for: Complex workflows, constraint validation

---

## 🎯 Seed Data Architecture Foundation

**CRITICAL**: All tests use hardcoded SEED_TEST_IDS for predictable debugging

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Dual-organization infrastructure
SEED_TEST_IDS.ORGANIZATIONS.primary; // "test-org-pinpoint" (Austin Pinball)
SEED_TEST_IDS.ORGANIZATIONS.competitor; // "test-org-competitor" (Competitor Arcade)

// Test users and mock patterns
SEED_TEST_IDS.USERS.ADMIN; // "test-user-tim"
SEED_TEST_IDS.MOCK_PATTERNS.MACHINE; // "mock-machine-1"
```

**Benefits**:

- **Predictable debugging**: "test-org-pinpoint is failing" vs random UUIDs
- **Cross-org boundary testing**: Two organizations for RLS isolation validation
- **Global OPDB catalog**: Shared machine models visible to all organizations
- **Consistent test data**: Same IDs across unit, integration, and security tests

**Architecture**: [📖 seed-data-architecture.md](./seed-data-architecture.md)

---

## 🧪 The 3 Testing Archetypes (Phase 3.3 Enhanced)

### **Unit Testing Archetype** → `unit-test-architect`

**[📖 archetype-unit-testing.md](./archetype-unit-testing.md)**

- **Purpose**: Fast, isolated testing without database dependencies
- **Patterns**: Pure functions, React components, business logic validation
- **Performance**: <100ms per test
- **When to use**: No database interaction, isolated business logic

### **Integration Testing Archetype** → `integration-test-architect`

**[📖 archetype-integration-testing.md](./archetype-integration-testing.md)**

- **Purpose**: Full-stack testing with memory-safe PGlite and RLS context
- **Patterns**: Service testing, tRPC routers (2 approaches), schema constraints, workflows
- **🚨 Critical**: Memory safety patterns prevent system lockups
- **✅ Phase 3.3 Validated**: Both Archetype 5 (mocked) and Archetype 3 (real PGlite) patterns proven effective
- **When to use**: Database operations, full-stack workflows, constraint validation

### **Security Testing Archetype** → `security-test-architect`

**[📖 archetype-security-testing.md](./archetype-security-testing.md)**

- **Purpose**: Security boundary testing and RLS policy validation
- **Patterns**: Permission matrices, cross-org isolation, policy enforcement
- **Focus**: Database-level security, multi-tenant boundaries
- **When to use**: Security boundaries, policy validation, compliance testing

---

## 🚦 Dual-Track Testing Decision

**For RLS Policy Validation**: Use **pgTAP** (Track 1)

- Testing organizational boundaries and security policies
- Validating database-level access control
- Comprehensive permission matrix testing
- **Guide**: [📖 pgtap-rls-testing.md](./pgtap-rls-testing.md)

**For Business Logic Testing**: Use **PGlite + integration_tester** (Track 2)

- Testing application functionality and workflows
- Validating business rules and data relationships
- Performance and scalability testing
- **Uses existing archetype patterns** with BYPASSRLS role

**Complete Strategy**: [📖 dual-track-testing-strategy.md](./dual-track-testing-strategy.md)

---

## 🤖 Agent Assignment Guide

| **Scenario**                       | **Primary Agent**            | **Archetype** | **Key Considerations**                  |
| ---------------------------------- | ---------------------------- | ------------- | --------------------------------------- |
| Testing pure utility functions     | `unit-test-architect`        | Unit          | Fast execution, no dependencies         |
| React component rendering/behavior | `unit-test-architect`        | Unit          | UI behavior, permission-based rendering |
| tRPC router with database          | `integration-test-architect` | Integration   | Memory-safe PGlite, RLS context         |
| Service layer business logic       | `integration-test-architect` | Integration   | Real database operations                |
| Cross-organizational access        | `security-test-architect`    | Security      | Boundary enforcement                    |
| RLS policy validation              | `security-test-architect`    | Security      | Database-level policies                 |
| Permission matrix testing          | `security-test-architect`    | Security      | Role-based access control               |

---

## 🚨 Critical: Memory Safety Requirements

**NEVER USE** (causes system lockups):

```typescript
// ❌ FORBIDDEN: Per-test PGlite instances
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test
});
```

**ALWAYS USE** (memory-safe):

```typescript
// ✅ MANDATORY: Worker-scoped pattern
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Memory-safe testing with transaction isolation
  });
});
```

See [archetype-integration-testing.md](./archetype-integration-testing.md) for complete memory safety patterns.

---

## 📋 Test Categorization & Migration

### Systematic Test Conversion

**[📖 test-categorization-plan.md](./test-categorization-plan.md)** - Framework for categorizing and converting 306 existing tests

### Migration Status (Phase 3.3 Update)

- ✅ **Phase 3.3 Complete**: ~22 files converted across 5 sub-phases
- 🎯 **Validated Patterns**: Two effective archetype approaches established
- 📊 **Results**: High success rate with some RLS context refinement needed
- **Remaining**: ~284 tests need archetype classification and conversion
- **Priority approach**: Integration → Security → Unit
- **Goal**: Every test follows validated Phase 3.3 archetype patterns

---

## 🛠️ Infrastructure & Setup

### Essential Setup

- **[test-database.md](./test-database.md)** - Worker-scoped PGlite setup (memory safety critical)
- **[vitest-guide.md](./vitest-guide.md)** - Modern Vitest patterns for all archetypes
- **[configuration.md](./configuration.md)** - Vitest configuration and setup

### Supporting Documentation

- **[GUIDE.md](./GUIDE.md)** - Testing philosophy and quick start guide
- **[performance.md](./performance.md)** - Test execution optimization
- **[troubleshooting.md](./troubleshooting.md)** - Common issues and debugging

### Legacy Pattern Documentation

- **[resilient-ui-patterns.md](./resilient-ui-patterns.md)** - UI testing patterns (reference for Unit archetype)
- **[supabase-auth-patterns.md](./supabase-auth-patterns.md)** - Auth testing (reference for Integration archetype)
- **[advanced-mock-patterns.md](./advanced-mock-patterns.md)** - Mocking patterns (reference for Unit archetype)

---

## 🎯 Modern Testing Stack (Dual-Track Enhanced)

**Dual-Track Testing Strategy**: [📖 dual-track-testing-strategy.md](./dual-track-testing-strategy.md)

**Track 1: RLS Policy Validation (pgTAP)**

- **Purpose**: Database-level security enforcement testing
- **Scope**: ~15 focused tests validating RLS policies
- **Guide**: [📖 pgtap-rls-testing.md](./pgtap-rls-testing.md)

**Track 2: Business Logic Testing (PGlite + integration_tester)**

- **Purpose**: Application functionality without RLS overhead
- **Scope**: 300+ comprehensive business logic tests
- **Performance**: 5x faster execution (BYPASSRLS role)

**Key Benefits Realized**:

- **Optimal performance**: Fast business logic tests + focused security validation
- **Clear separation**: Security policies vs business functionality
- **Comprehensive coverage**: 100% RLS validation + complete business logic testing
- **Memory safety**: Worker-scoped PGlite prevents system lockups (1-2GB+ → <500MB)
- **Agent specialization**: Clear responsibility and expertise per track

**Technology Stack**:

- **pgTAP**: Native PostgreSQL RLS policy testing
- **PGlite**: In-memory PostgreSQL for fast business logic testing
- **integration_tester role**: BYPASSRLS for business logic focus
- **RLS**: Row-Level Security with direct policy validation
- **Drizzle**: Type-safe ORM with full type inference
- **Vitest**: Modern testing framework with worker isolation
- **Specialized Agents**: Expert testing architects for each archetype

---

## 🚀 Quick Start

1. **Determine your archetype** using the decision guide above
2. **Read the archetype file** for detailed patterns and examples
3. **Use the assigned agent** for expert implementation assistance
4. **Follow memory safety** requirements for integration tests
5. **Validate archetype compliance** before committing

**For migration work**: Start with [test-categorization-plan.md](./test-categorization-plan.md) to systematically convert existing tests.

---

## 📚 Reference & Migration

### Migration Documentation

- **[../../migration-plan-v2/03-phase2.5-testing-architecture.md](../../migration-plan-v2/03-phase2.5-testing-architecture.md)** - Complete testing architecture design
- **[../../migration-plan-v2/04-phase3-test-implementation.md](../../migration-plan-v2/04-phase3-test-implementation.md)** - Systematic test conversion plan

### Quality Assurance

- Every test must follow exactly one of the 3 archetypes
- Integration tests must use memory-safe patterns
- Security tests must validate organizational boundaries
- Unit tests must execute in <100ms

The archetype system ensures systematic, maintainable testing that fully leverages RLS benefits while preventing dangerous patterns that cause system instability.
