# Seed Data Management Scripts

**Purpose**: Practical guide for managing PinPoint's hardcoded seed data system  
**Context**: Scripts for loading, managing, and maintaining predictable test data  
**Architecture**: Minimal → Full progression with SEED_TEST_IDS constants

---

## 🚀 Quick Start

```bash
# Load minimal seed data (foundation for all testing)
npm run seed:minimal

# Load full seed data (minimal + extended demo data)
npm run seed:full

# Reset database and reload minimal seed
npm run seed:reset

# Generate SQL constants from TypeScript
npm run generate:sql-constants
```

---

## 📁 File Structure

```
scripts/seed/
├── README.md                    # This guide
├── index.ts                     # Main seed orchestration
└── shared/
    ├── auth-users.ts            # User accounts and authentication setup
    ├── infrastructure.ts        # Core data (roles, statuses, priorities)  
    ├── sample-data.ts           # Organizations, locations, machines, issues
    └── types.ts                 # Type definitions for seed operations
```

**Generated Files** (DO NOT EDIT):
```
supabase/tests/constants.sql     # SQL constants from SEED_TEST_IDS
```

---

## 🏗️ Seed Data Architecture

### **Two-Tier System**

**Minimal Seed** (Foundation - Always Loaded):
- 2 organizations for security boundary testing
- ~8 users across roles (admin, members, guests)
- ~10 machines (different games, statuses, locations)
- ~20 sample issues (various priorities and statuses)
- Complete infrastructure (roles, statuses, priorities)

**Full Seed** (Additive Enhancement):
- Minimal seed (100% preserved)
- +50 additional machines for variety
- +180 additional issues for rich scenarios
- Extended demo data for development

### **Predictable IDs**

All seed data uses hardcoded, human-readable IDs from [`SEED_TEST_IDS`](../../src/test/constants/seed-test-ids.ts):

```typescript
// Organizations
"test-org-pinpoint"      // Primary organization (Austin Pinball) 
"test-org-competitor"    // Competitor organization

// Users  
"test-user-tim"          // Admin user
"test-user-harry"        // Member user
"test-user-sarah"        // Member user
"test-user-guest"        // Guest user

// Machines
"machine-mm-001"         // Medieval Madness
"machine-af-002"         // Attack from Mars
"machine-cc-003"         // Cactus Canyon
```

**Benefits**:
- 🎯 Easy debugging: "machine-mm-001 failing" vs random UUID
- 🔗 Stable relationships: Foreign keys never break
- ⚡ Fast execution: No runtime ID generation
- 🧪 Reproducible tests: Same data every time

---

## 🛠️ Available Commands

### **Core Seed Operations**

```bash
# Load minimal seed data (recommended for development)
npm run seed:minimal
# Equivalent: tsx scripts/seed/index.ts --minimal

# Load full seed data (for demos, manual testing)
npm run seed:full  
# Equivalent: tsx scripts/seed/index.ts --full

# Reset database and reload minimal
npm run seed:reset
# Equivalent: npm run db:reset:local:sb && npm run seed:minimal
```

### **Advanced Operations**

```bash
# Generate SQL constants from TypeScript SEED_TEST_IDS
npm run generate:sql-constants
# Creates: supabase/tests/constants.sql

# Validate seed data consistency
npm run validate:seed-data

# Check seed data health
npm run seed:health-check
```

### **Development Workflow**

```bash
# Typical development session
npm run seed:minimal          # Start with foundation
npm run test                  # Run unit tests (use MOCK_PATTERNS)
npm run test:integration      # Run integration tests (use seeded data)

# Demo preparation  
npm run seed:full            # Load rich data for demos
npm run dev                  # Start development server

# Reset when needed
npm run seed:reset           # Clean slate with minimal foundation
```

---

## 📝 Script Details

### **index.ts - Main Orchestrator**

Primary entry point that coordinates all seed operations:

```typescript
// Usage patterns
tsx scripts/seed/index.ts --minimal    # Load minimal seed
tsx scripts/seed/index.ts --full       # Load full seed  
tsx scripts/seed/index.ts --reset      # Reset + minimal
tsx scripts/seed/index.ts --validate   # Validate consistency
```

**Key Functions**:
- Database connection management
- Transaction handling for atomic operations
- Progress reporting and error handling
- Environment validation (dev/test only)

### **shared/infrastructure.ts**

Core system data that rarely changes:

```typescript
// Issue statuses
export const ISSUE_STATUSES = [
  { id: "status-open", name: "Open", color: "#ef4444" },
  { id: "status-in-progress", name: "In Progress", color: "#f59e0b" },
  { id: "status-resolved", name: "Resolved", color: "#10b981" },
  // ... more statuses
];

// Priority levels
export const PRIORITY_LEVELS = [
  { id: "priority-low", name: "Low", level: 1 },
  { id: "priority-medium", name: "Medium", level: 2 },
  { id: "priority-high", name: "High", level: 3 }, 
  { id: "priority-critical", name: "Critical", level: 4 },
];

// User roles and permissions
export const USER_ROLES = [
  { id: "role-admin", name: "Admin", permissions: [...] },
  { id: "role-member", name: "Member", permissions: [...] },
  { id: "role-guest", name: "Guest", permissions: [...] },
];
```

### **shared/auth-users.ts**

User accounts with proper authentication setup:

```typescript
export const SEED_USERS = [
  {
    id: SEED_TEST_IDS.USERS.ADMIN,
    email: "tim@austinpinball.org",
    password: "admin123",
    role: "admin",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    metadata: {
      firstName: "Tim",
      lastName: "Froehlich", 
      permissions: ["*"], // Full access
    }
  },
  {
    id: SEED_TEST_IDS.USERS.MEMBER1,
    email: "harry@austinpinball.org", 
    password: "member123",
    role: "member",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    // ... more user details
  },
];
```

**Features**:
- Supabase auth.users entries with proper metadata
- Organization assignments via app_metadata
- Role-based permission sets
- Consistent passwords for development

### **shared/sample-data.ts**

Rich sample content for realistic testing:

```typescript
export const SAMPLE_ORGANIZATIONS = [
  {
    id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    name: "Austin Pinball Collective",
    description: "Premier pinball community in Austin, TX",
    settings: { theme: "pinball", timezone: "America/Chicago" },
  },
  {
    id: SEED_TEST_IDS.ORGANIZATIONS.competitor,  
    name: "Competitor Arcade",
    description: "Local arcade competitor for testing",
    settings: { theme: "arcade", timezone: "America/Chicago" },
  },
];

export const SAMPLE_MACHINES = [
  {
    id: "machine-mm-001",
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    status: "active",
    locationId: "test-location-austin-hq",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  },
  // ... more machines with predictable IDs
];

export const SAMPLE_ISSUES = [
  {
    id: "issue-mm-flipper-001", 
    title: "Right flipper sticking intermittently",
    description: "Right flipper occasionally sticks in up position",
    priority: "medium",
    status: "open",
    machineId: "machine-mm-001",
    createdBy: SEED_TEST_IDS.USERS.MEMBER1,
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  },
  // ... more issues with descriptive IDs
];
```

### **shared/types.ts**

TypeScript definitions for seed operations:

```typescript
export interface SeedOperation {
  name: string;
  description: string;
  execute: () => Promise<SeedResult>;
}

export interface SeedResult {
  success: boolean;
  recordsCreated: number;
  duration: number;
  errors?: string[];
}

export interface SeedConfig {
  minimal: boolean;
  full: boolean;
  reset: boolean;
  validate: boolean;
}
```

---

## 🔒 Security & Environment Safety

### **Environment Restrictions**

Seed scripts **ONLY** run in development/test environments:

```typescript
// Automatic environment validation
const ALLOWED_ENVIRONMENTS = ['development', 'test', 'local'];

if (!ALLOWED_ENVIRONMENTS.includes(process.env.NODE_ENV)) {
  throw new Error('Seed scripts only allowed in development/test environments');
}

// URL validation prevents production accidents
if (databaseUrl.includes('production') || databaseUrl.includes('prod')) {
  throw new Error('Cannot run seed scripts against production database');
}
```

### **Data Safety**

- **Atomic operations**: All seed operations use database transactions
- **Validation before execution**: Check database state before making changes
- **Rollback on errors**: Failed operations are automatically rolled back
- **Idempotent operations**: Scripts can be run multiple times safely

---

## 🧪 Testing Integration

### **Memory-Safe Testing Patterns**

Scripts coordinate with testing infrastructure for memory safety:

```typescript
// Integration with worker-scoped PGlite
export async function seedTestDatabase(db: PGliteDatabase, level: 'minimal' | 'full') {
  // Uses same SEED_TEST_IDS constants
  // Memory-efficient seeding for test databases
  const results = await seedInfrastructure(db);
  const users = await seedUsers(db);
  const sampleData = await seedSampleData(db, level);
  
  return {
    organizations: [SEED_TEST_IDS.ORGANIZATIONS.primary, SEED_TEST_IDS.ORGANIZATIONS.competitor],
    users: users.map(u => u.id),
    machines: sampleData.machines,
    issues: sampleData.issues,
  };
}
```

### **SQL Constants Generation**

TypeScript SEED_TEST_IDS → SQL constants for pgTAP tests:

```typescript
// scripts/generate-sql-constants.ts
export function generateSQLConstants() {
  const sqlFunctions = Object.entries(SEED_TEST_IDS.ORGANIZATIONS)
    .map(([key, value]) => `
CREATE OR REPLACE FUNCTION test_org_${key}() 
RETURNS TEXT AS $$ SELECT '${value}'::TEXT $$ LANGUAGE SQL IMMUTABLE;`);
    
  return {
    filename: 'supabase/tests/constants.sql',
    content: sqlFunctions.join('\n'),
  };
}
```

---

## 📊 Monitoring & Validation

### **Health Check Commands**

```bash
# Validate seed data consistency
npm run validate:seed-data

# Check for expected record counts
npm run seed:health-check

# Verify SEED_TEST_IDS usage
npm run validate:test-constants
```

### **Typical Health Checks**

```typescript
// Validation example
export async function validateSeedHealth(db: Database) {
  const checks = [
    {
      name: 'Organizations exist',
      query: 'SELECT COUNT(*) FROM organizations',
      expected: 2, // primary + competitor
    },
    {
      name: 'Users have proper organization assignments', 
      query: `SELECT COUNT(*) FROM auth.users 
              WHERE (raw_app_meta_data->>'organizationId') IS NOT NULL`,
      expected: 8,
    },
    {
      name: 'Machines belong to organizations',
      query: 'SELECT COUNT(*) FROM machines WHERE organization_id IS NOT NULL',
      expected: 10, // minimal seed machines
    },
  ];
  
  return await runHealthChecks(checks);
}
```

### **Performance Monitoring**

```bash
# Track seed operation performance
npm run seed:minimal --timing    # Show detailed timing
npm run seed:full --benchmark    # Performance baseline

# Monitor database size after seeding
npm run db:size-check
```

---

## 🔧 Development & Debugging

### **Debugging Seed Operations**

```bash
# Verbose output with detailed logging
DEBUG=seed:* npm run seed:minimal

# Dry run (validate without changes)
npm run seed:minimal --dry-run

# Step-by-step execution
npm run seed:minimal --step
```

### **Common Issues & Solutions**

**Issue**: "Organization already exists" error
```bash
# Solution: Reset database first
npm run seed:reset
```

**Issue**: Foreign key constraint violations  
```bash
# Solution: Check SEED_TEST_IDS consistency
npm run validate:test-constants
npm run generate:sql-constants  # Regenerate if needed
```

**Issue**: Memory issues during testing
```bash
# Solution: Verify worker-scoped patterns
rg "createSeededTestDatabase" src/test/  # Should be zero results
rg "withIsolatedTest" src/test/          # Should be used everywhere
```

**Issue**: Inconsistent test data across environments
```bash
# Solution: Verify SEED_TEST_IDS usage
npm run validate:seed-data
rg "test-org-|org-1" src/test/ --count  # Should be zero (use SEED_TEST_IDS)
```

---

## 🚀 Advanced Usage

### **Custom Seed Extensions**

For specialized scenarios, extend the base seed:

```typescript
// scripts/seed/custom/security-testing.ts
export async function seedSecurityScenario(db: Database) {
  // Build on minimal seed foundation
  await runMinimalSeed(db);
  
  // Add specific security test data
  await db.insert(issues).values({
    id: "issue-security-test-001",
    title: "CONFIDENTIAL: Security Audit",
    isConfidential: true,
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: "machine-mm-001", // Reference existing machine
  });
  
  return { securityIssue: "issue-security-test-001" };
}

// Usage
npm run tsx scripts/seed/custom/security-testing.ts
```

### **Environment-Specific Variations**

```typescript
// Different seed levels per environment
export function getSeedConfig(): SeedConfig {
  switch (process.env.NODE_ENV) {
    case 'test':
      return { minimal: true, full: false };  // Fast testing
    case 'development':
      return { minimal: false, full: true };  // Rich dev data
    case 'staging':
      return { minimal: true, full: false };  // Consistent staging
    default:
      throw new Error('Seed not allowed in this environment');
  }
}
```

### **Performance Optimization**

```typescript
// Batch operations for large datasets
export async function seedLargeDataset(db: Database) {
  const BATCH_SIZE = 100;
  const totalMachines = 1000;
  
  for (let i = 0; i < totalMachines; i += BATCH_SIZE) {
    const batch = Array.from({ length: BATCH_SIZE }, (_, idx) => ({
      id: `machine-perf-${i + idx + 1}`,
      name: `Performance Test Machine ${i + idx + 1}`,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    }));
    
    await db.insert(machines).values(batch);
    console.log(`Seeded batch ${i + 1}-${i + BATCH_SIZE}`);
  }
}
```

---

## 📚 Related Documentation

**Core Architecture**:
- [Seed Data Architecture](../../docs/testing/seed-data-architecture.md) - Complete system overview
- [SEED_TEST_IDS Constants](./../../src/test/constants/seed-test-ids.ts) - Central ID definitions
- [Testing Patterns](../../docs/quick-reference/testing-patterns.md) - Usage examples

**Testing Integration**:
- [Test Database Guide](../../docs/testing/test-database.md) - Memory-safe PGlite patterns
- [Integration Testing](../../docs/testing/archetype-integration-testing.md) - Full-stack with seed data
- [Security Testing](../../docs/testing/archetype-security-testing.md) - Cross-org validation

**Technical Implementation**:
- [Database Setup Scripts](../setup-rls.ts) - RLS configuration
- [pgTAP Testing](../../docs/testing/pgtap-rls-testing.md) - SQL constants usage

---

## ✅ Success Checklist

**Proper Setup**:
- [ ] `npm run seed:minimal` completes without errors
- [ ] All SEED_TEST_IDS constants are used consistently
- [ ] Database contains expected record counts
- [ ] Generated SQL constants are up-to-date

**Testing Integration**:
- [ ] Integration tests use `getSeededTestData()` function
- [ ] Security tests validate both organizations
- [ ] pgTAP tests use generated SQL constants
- [ ] Memory-safe patterns enforced throughout

**Development Workflow**:
- [ ] Seed operations are fast and reliable
- [ ] Debugging is straightforward with readable IDs
- [ ] Demo environments have rich, realistic data
- [ ] Health checks validate data consistency

**Quality Assurance**:
- [ ] No hardcoded test IDs outside SEED_TEST_IDS
- [ ] All environments use consistent seed data
- [ ] Foreign key relationships are stable
- [ ] Performance meets development needs

---

This seed management system provides a reliable foundation for predictable, debuggable testing while supporting rich development scenarios and comprehensive security validation.

**Last Updated**: 2025-08-19 (Phase 0 - Seed data architecture implementation)