# Phase 2A: Drizzle Schema Migration Analysis

**Task**: Migrate PinPoint's Prisma schema to Drizzle ORM with 1:1 parity  
**Focus Areas**: Users & Permissions system, Multi-tenant architecture  
**Database**: Supabase PostgreSQL

## Schema Analysis Summary

### Complexity Overview
- **Total Models**: 22 models across 5 domains
- **Multi-Tenant Tables**: 15 tables with `organizationId` 
- **Global Tables**: 7 tables (User, Account, Session, Model, Permission, etc.)
- **JSON Fields**: 4 fields requiring type preservation
- **Critical Indexes**: QR codes, multi-tenant queries, permissions

### Domain Breakdown
1. **Auth & Users** (7 models) - Global identity system
2. **Organizations & Tenancy** (4 models) - Multi-tenant core  
3. **Assets & Machines** (4 models) - Physical inventory
4. **Issues & Workflow** (5 models) - Issue tracking system
5. **Collections & Notifications** (4 models) - Organization features

## Critical Analysis Areas

### 1. User & Permission System (High Risk)

**Current Prisma Structure:**
```prisma
User (global) 
├─ Membership (user + org + role)
├─ Role (org-scoped with permissions[])  
└─ Permission (global permission definitions)
```

**Key Concerns:**
- **Many-to-many relationship**: Role ↔ Permission via `@relation("RolePermissions")`
- **Permission checking frequency**: Used on every authenticated request
- **Multi-tenant complexity**: Users belong to multiple orgs with different roles
- **JSON vs Array**: Prisma `permissions Permission[]` becomes Drizzle join table

**Migration Strategy:**
```typescript
// Drizzle equivalent - maintain exact same relationship pattern
export const rolePermissions = pgTable("_RolePermissions", {
  roleId: text("A").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: text("B").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
  index("idx_role_permissions_role").on(table.roleId),
  index("idx_role_permissions_permission").on(table.permissionId),
]);
```

**Critical Validation Needed:**
- [ ] Permission queries return identical results
- [ ] Role membership resolution works correctly  
- [ ] Multi-tenant permission isolation functions properly
- [ ] Performance matches current system

### 2. Multi-Tenant Architecture

**Organization Scoping Pattern:**
- **Required on 15 tables**: `organizationId String` field
- **Critical for security**: Prevents cross-tenant data leaks
- **Query impact**: Every tenant query includes `WHERE organizationId = ?`

**Essential Indexes:**
```typescript
// Must have these indexes for performance
index("idx_issue_org_status").on(table.organizationId, table.statusId),
index("idx_machine_org_location").on(table.organizationId, table.locationId),
index("idx_membership_user_org").on(table.userId, table.organizationId),
```

### 3. JSON Fields (Defer Optimization)

**Current JSON Fields:**
- `Issue.checklist` - JSON array of checklist items
- `Collection.filterCriteria` - Auto-collection rules
- `CollectionType.generationRules` - Collection generation config
- `User.emailNotificationsEnabled` - Boolean field (not JSON)

**Migration Strategy**: Keep as `json()` type initially
```typescript
checklist: json("checklist").$type<ChecklistItem[]>(),
filterCriteria: json("filter_criteria").$type<FilterCriteria>().default({}),
```

### 4. QR Code System (Performance Critical)

**Current Pattern:**
```prisma
Machine {
  qrCodeId String @unique @default(cuid())
  @@index([qrCodeId])
}
```

**Drizzle Migration:**
```typescript
export const machines = pgTable("Machine", {
  qrCodeId: text("qr_code_id").unique().$defaultFn(() => createId()),
}, (table) => [
  uniqueIndex("Machine_qr_code_id_key").on(table.qrCodeId),
  index("Machine_qr_code_id_idx").on(table.qrCodeId), // For scanning performance
]);
```

## Modular Schema Structure

### File Organization
```
src/server/db/schema/
├── index.ts          # Barrel exports + relations
├── auth.ts           # User, Account, Session, VerificationToken  
├── organizations.ts  # Organization, Membership, Role, Permission
├── machines.ts       # Location, Model, Machine
├── issues.ts         # Issue, Priority, IssueStatus, Comment, Attachment, IssueHistory, Upvote
└── collections.ts    # Collection, CollectionType, Notification, PinballMapConfig
```

### Domain Separation Logic
- **auth.ts**: Global user identity (no organizationId)
- **organizations.ts**: Multi-tenant management and RBAC
- **machines.ts**: Physical asset management
- **issues.ts**: Issue tracking workflow
- **collections.ts**: Organization features and configs

## Database Connection Strategy

### Supabase Integration
**Current Prisma Setup:**
```typescript
datasource db {
  provider  = "postgresql"
  url       = env("POSTGRES_PRISMA_URL")      // Pooled connection
  directUrl = env("POSTGRES_URL_NON_POOLING") // Direct connection
}
```

**Drizzle + Supabase Pattern:**
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Use Supabase connection strings
const connectionString = process.env.POSTGRES_PRISMA_URL!;
const sql = postgres(connectionString, { max: 1 }); // Connection pool config
export const db = drizzle(sql);
```

**Integration Strategy:**
- Reuse existing Supabase connection strings
- Maintain compatibility with current environment setup
- Share connection pool between Prisma and Drizzle during migration

## Type Safety & Validation

### Generated Types Compatibility
**Prisma Generated Types:**
```typescript
type User = {
  id: string;
  memberships: (Membership & { 
    role: Role & { permissions: Permission[] } 
  })[];
}
```

**Drizzle Equivalent:**
```typescript
// Must generate identical structure for tRPC compatibility
type User = InferSelectModel<typeof users> & {
  memberships: (InferSelectModel<typeof memberships> & {
    role: InferSelectModel<typeof roles> & {
      permissions: InferSelectModel<typeof permissions>[];
    }
  })[];
}
```

### tRPC Integration Points
**Critical Areas Requiring Type Validation:**
- `createTRPCContext` - Session and user type structure
- Router procedures expecting Prisma types
- Permission checking utilities
- Multi-tenant query patterns

## Risk Mitigation

### High-Risk Areas
1. **Permission System**: Many-to-many relationships are complex
2. **Multi-tenant Queries**: Security-critical organizationId filtering
3. **QR Code Performance**: Mission-critical for scanning workflow
4. **Type Compatibility**: 50+ tRPC procedures depend on exact types

### Validation Strategy
```typescript
// Dual-ORM validation pattern
async function validateUserPermissions(userId: string, orgId: string) {
  const [prismaResult, drizzleResult] = await Promise.all([
    // Prisma query
    prisma.user.findFirst({
      where: { id: userId },
      include: { 
        memberships: { 
          where: { organizationId: orgId },
          include: { role: { include: { permissions: true } } }
        }
      }
    }),
    
    // Drizzle equivalent
    db.select()
      .from(users)
      .leftJoin(memberships, eq(users.id, memberships.userId))
      .leftJoin(roles, eq(memberships.roleId, roles.id))
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(users.id, userId),
        eq(memberships.organizationId, orgId)
      ))
  ]);
  
  // Validate identical results
  validateEquivalence(normalize(prismaResult), normalize(drizzleResult));
}
```

## Implementation Priority

### Phase 2A.1: Foundation Setup
1. Install Drizzle dependencies
2. Create modular schema files
3. Set up Drizzle config and database client
4. Implement dual-ORM validation utilities

### Phase 2A.2: Core Schema Implementation
1. **auth.ts** - Global user identity (lowest risk)
2. **organizations.ts** - Multi-tenant core (high complexity)
3. **machines.ts** - Asset management (QR code critical)
4. **issues.ts** - Issue workflow (most complex)
5. **collections.ts** - Organization features (lowest priority)

### Phase 2A.3: Validation & Integration
1. Type generation validation
2. Permission system testing
3. Multi-tenant query validation
4. QR code performance verification

## Success Criteria

### Functional Requirements
- [ ] All 22 models migrated with exact field parity
- [ ] Permission system works identically to Prisma version
- [ ] Multi-tenant isolation maintained across all queries
- [ ] QR code scanning performance preserved
- [ ] All JSON fields properly typed and functional

### Technical Requirements  
- [ ] TypeScript compilation successful with generated types
- [ ] tRPC context integration functional
- [ ] Database connection pooling optimized
- [ ] Essential indexes created for performance
- [ ] Dual-ORM validation utilities operational

### Performance Requirements
- [ ] Permission queries ≤ current Prisma latency
- [ ] QR code lookups ≤ 50ms response time
- [ ] Multi-tenant queries perform within 10% of current baseline
- [ ] Connection pool efficiency maintained during dual-ORM period

## Next Steps

1. **Dependencies Installation**: Add Drizzle packages and configuration
2. **Schema Implementation**: Start with auth.ts (safest domain)
3. **Validation Setup**: Create dual-ORM comparison utilities
4. **Progressive Migration**: Domain-by-domain with validation at each step

**Critical Path**: Organizations.ts must be perfect before any router migrations begin in Phase 2B-2E.