# Test Utilities Refactoring - Phase 1: Test Helper Creation

**Agent**: `test-architect`  
**Priority**: High  
**Estimated Effort**: 4-6 hours  
**Dependencies**: None - standalone helper creation

## 🎯 Objective

Create comprehensive test helper utilities to eliminate massive code duplication in infrastructure tests, focusing on database testing, mock configuration, and environment management patterns.

## 📋 Phase 1 Deliverables

### 1. Database Test Helpers (`src/test/database-test-helpers.ts`)

**Purpose**: Centralized utilities for database integration testing

**Required Functions**:

```typescript
// Cleanup utilities
export async function cleanupTestData(
  db: DrizzleClient, 
  testIds: TestDataIds
): Promise<void>

// Test data factories
export async function createTestOrganization(
  db: DrizzleClient, 
  overrides?: Partial<Organization>
): Promise<Organization>

export async function createTestUser(
  db: DrizzleClient, 
  overrides?: Partial<User>
): Promise<User>

export async function createTestUserWithMembership(
  db: DrizzleClient,
  organizationId: string,
  roleType?: 'admin' | 'manager' | 'member',
  overrides?: Partial<User>
): Promise<{ user: User; membership: Membership; role: Role }>

export async function createTestMachine(
  db: DrizzleClient,
  organizationId: string,
  overrides?: Partial<Machine>
): Promise<{ machine: Machine; location: Location; model: Model }>

export async function createTestIssue(
  db: DrizzleClient,
  machineId: string,
  organizationId: string,
  overrides?: Partial<Issue>
): Promise<{ issue: Issue; priority: Priority; status: IssueStatus }>

// Helper types
export interface TestDataIds {
  orgIds?: string[];
  userIds?: string[];
  issueId?: string;
  machineId?: string;
  locationId?: string;
  modelId?: string;
  roleIds?: string[];
  membershipIds?: string[];
}
```

**Key Features**:
- **Dependency-order cleanup** (prevents foreign key violations)
- **Realistic test data** with proper relationships
- **Timestamp-unique IDs** to prevent test conflicts
- **Flexible overrides** for specific test scenarios
- **Comprehensive type safety**

### 2. Drizzle Mock Helpers (`src/server/db/__tests__/drizzle-test-helpers.ts`)

**Purpose**: Standardized mock configuration for Drizzle singleton testing

**Required Functions**:

```typescript
// Environment configuration
export function configureDevelopmentMocks(): void
export function configureProductionMocks(): void  
export function configureCIMocks(): void
export function configureCustomEnvironment(config: EnvironmentConfig): void

// Connection string helpers
export function createLocalhost5432URL(database?: string): string
export function createRemoteURL(host: string, database?: string): string
export function create127001URL(database?: string): string

// Mock validation helpers
export function expectSSLConfiguration(sslSetting: boolean | string): void
export function expectPoolConfiguration(maxConnections: number): void
export function expectTimeoutConfiguration(
  idle: number, 
  connect: number
): void
export function expectLoggingConfiguration(enabled: boolean): void

// Module import helper
export async function importDrizzleModule(): Promise<{
  createDrizzleClient: () => DrizzleClient;
  closeDrizzleConnection: () => Promise<void>;
}>
```

**Key Features**:
- **Environment preset functions** for common test scenarios
- **Connection string builders** for different URL patterns
- **Assertion helpers** to validate mock calls
- **Centralized module importing** with proper typing

### 3. Environment Test Helpers (`src/lib/env-loaders/__tests__/env-test-helpers.ts`)

**Purpose**: Environment variable management for loader testing

**Required Functions**:

```typescript
// Environment management
export function createCleanEnvironment(
  additionalVarsToDelete?: string[]
): () => void // Returns restore function

export function setTestEnvironmentVars(vars: Record<string, string>): void

export function simulateEnvFileContents(files: {
  '.env'?: Record<string, string>;
  '.env.development'?: Record<string, string>;
  '.env.production'?: Record<string, string>;
  '.env.test'?: Record<string, string>;
  '.env.local'?: Record<string, string>;
}): void

// Mock configuration
export function configureDotenvMocks(): {
  mockDotenvConfig: MockedFunction<any>;
  mockExistsSync: MockedFunction<any>;
}

export function expectFileLoadOrder(
  expectedFiles: string[],
  mockDotenvConfig: MockedFunction<any>
): void

// Common test scenarios
export function setupDevelopmentScenario(): void
export function setupProductionScenario(): void
export function setupTestScenario(): void
export function setupCIScenario(): void
```

**Key Features**:
- **Automatic env cleanup/restore** pattern
- **File content simulation** for testing precedence
- **Load order validation** helpers
- **Scenario presets** for common environments

## 🔧 Implementation Requirements

### Code Quality Standards
- **100% TypeScript strict mode** compliance
- **Comprehensive JSDoc** documentation for all public functions
- **Error handling** for all database operations
- **Consistent naming** following project conventions
- **Reusable patterns** that reduce boilerplate by 60%+

### Testing Requirements
- **Self-testing utilities** - each helper file should have its own test
- **Documentation examples** showing proper usage
- **Performance considerations** - cleanup should be efficient
- **Isolation guarantees** - helpers must not leak state between tests

### Integration Points
- Must work with **existing Drizzle schema**
- Compatible with **current Vitest setup**
- Follows **existing mock patterns** in codebase
- Integrates with **project's TypeScript configuration**

## 📁 File Structure

```
src/
├── test/
│   └── database-test-helpers.ts          # NEW - Database utilities
├── server/db/__tests__/
│   └── drizzle-test-helpers.ts           # NEW - Drizzle mock utilities
└── lib/env-loaders/__tests__/
    └── env-test-helpers.ts                # NEW - Environment utilities
```

## 🎯 Success Criteria

### Phase 1 Complete When:
1. **All three helper files created** with full functionality
2. **TypeScript compilation** passes with no errors
3. **Basic validation tests** pass for each helper
4. **Documentation** includes usage examples
5. **No breaking changes** to existing tests

### Quality Gates:
- **Lint/format checks** pass
- **Type safety** maintained throughout
- **Error handling** implemented for all database operations
- **Performance** - helpers should be efficient for test usage

## 🔄 Phase 2 Preparation

This phase sets up the foundation for Phase 2 refactoring by providing:
- **Standardized cleanup patterns**
- **Reusable test data factories**
- **Mock configuration utilities**
- **Environment management helpers**

After Phase 1 completion, existing tests can be systematically refactored to use these utilities, achieving the target 60% code reduction in test boilerplate.

## 📋 Agent Instructions

1. **Start with database-test-helpers.ts** (highest impact)
2. **Focus on the cleanup utility first** (addresses biggest duplication)
3. **Create factory functions second** (addresses data creation patterns)
4. **Build drizzle-test-helpers.ts** for mock standardization
5. **Complete env-test-helpers.ts** for environment patterns
6. **Add basic tests** for each utility to validate functionality

**Note**: These are foundational utilities - they should be comprehensive and well-tested since they'll be used extensively across the test suite.