# PinPoint Drizzle + Supabase Migration Plan

_Comprehensive Technical Migration Strategy for Full Stack Transformation_

---

## Executive Summary

This document outlines a unified migration strategy to transform PinPoint from Prisma + NextAuth + Local Storage to Drizzle ORM + Supabase (Auth, Database, Storage) with full Row Level Security. The migration takes an aggressive approach with complete schema redesign and fresh test implementation.

**Key Decisions:**

- Full RLS implementation from the start
- Complete migration to Supabase auth schema (using their JWT structure)
- Big bang approach - Drizzle + Supabase Auth simultaneously
- Delete and rewrite all tests fresh
- Remove service factory pattern entirely
- Defer denormalization optimizations for later

---

## What We Lose vs What We Gain

### What We Lose 😔

**1. Prisma's Developer Experience**

- Auto-generated client with perfect TypeScript types
- Intuitive query syntax (`include`, `select`)
- Excellent error messages
- Large community and extensive documentation
- Drizzle Studio for database exploration

**2. NextAuth Flexibility**

- Complete control over auth flows and callbacks
- Custom session structure and JWT handling
- Ability to implement complex auth logic
- Direct control over User/Account/Session tables

**3. Familiar Patterns**

- Current mock-heavy testing approach
- Service factory abstraction layer
- Established error handling patterns

**4. Zero Vendor Lock-in**

- Currently can switch any component independently
- No reliance on proprietary features

### What We Gain 🚀

**1. Performance Improvements**

- **100x faster cold starts** on Vercel serverless
- **40% faster query execution** for complex operations
- Minimal bundle size (7.4kb vs Prisma's larger client)
- Native edge runtime support

**2. Superior Multi-tenant Security**

- Database-enforced RLS policies
- Impossible to accidentally leak data across organizations
- Automatic tenant isolation at query level
- Reduced application code complexity

**3. Integrated Infrastructure**

- Single platform for auth, database, storage
- Consistent security model across services
- Built-in real-time capabilities (future)
- Automatic backups and scaling

**4. Better Testing**

- Less need for mocks with transaction-based tests
- Direct SQL testing capabilities
- More reliable integration tests
- Cleaner test setup/teardown

**5. Cost Efficiency**

- Predictable pricing model
- Better resource utilization
- Reduced operational overhead

**6. Developer Velocity (Long-term)**

- Faster iteration with integrated services
- Less boilerplate code
- Better debugging with RLS policies
- Native TypeScript throughout

---

## Risk Analysis & Mitigation

### High Risks ⚠️

**1. RLS Complexity**

- **Risk**: RLS policies are harder to debug than application code
- **Mitigation**: Comprehensive RLS testing suite, detailed logging
- **Backup**: Can disable RLS and revert to app-level filtering

**2. Migration Bugs**

- **Risk**: Query translation errors, missing edge cases
- **Mitigation**: Parallel testing environment, comprehensive test coverage
- **Backup**: Git revert to pre-migration state

**3. Auth Migration Complexity**

- **Risk**: User sessions disrupted, auth state issues
- **Mitigation**: No existing users to migrate, fresh start
- **Backup**: Keep NextAuth code as fallback

### Medium Risks ⚡

**1. Learning Curve**

- **Risk**: Drizzle patterns different from Prisma
- **Mitigation**: Start with familiar relational queries, gradual adoption
- **Impact**: 1-2 weeks slower initial development

**2. Vendor Lock-in**

- **Risk**: Tied to Supabase ecosystem
- **Mitigation**: Drizzle works with any PostgreSQL, auth is OAuth-based
- **Impact**: Future migration would be complex but possible

**3. Testing Strategy Change**

- **Risk**: New patterns might not cover all cases
- **Mitigation**: Gradual test migration, maintain critical tests
- **Impact**: Temporary reduction in test confidence

### Low Risks ✓

**1. Performance Degradation**

- **Risk**: Misconfigured RLS policies slow queries
- **Mitigation**: Performance testing, index optimization
- **Impact**: Easy to fix with proper indexes

**2. Feature Parity**

- **Risk**: Some Prisma features not available
- **Mitigation**: Drizzle has equivalent or better alternatives
- **Impact**: Minor refactoring needed

---

## Testing Strategy - Complete Rewrite

### Current Test Inventory

Before deletion, document what each test was validating:

- Unit tests: Business logic, permissions, utilities
- Integration tests: API endpoints, multi-tenant isolation
- Component tests: UI behavior, user interactions

### New Testing Approach

```typescript
// Transaction-based integration tests
describe('Issue Management', () => {
  it('should create issue with RLS isolation', async () => {
    await testTransaction(async (db, orgId) => {
      // All operations automatically rolled back
      const machine = await db.insert(machines).values({...}).returning();
      const issue = await createIssue(db, { machineId: machine[0].id });

      // Test cross-org isolation
      await expectNoAccess(db, issue.id, 'different-org-id');
    });
  });
});
```

---

## Unified Migration Approach (Week 1-2)

### Day 1-2: Project Setup & Schema Design

```bash
# Install all dependencies at once
npm install drizzle-orm @supabase/supabase-js @supabase/ssr
npm install -D drizzle-kit @types/pg tsx

# Set up Supabase project first
# Configure auth providers in Supabase dashboard
```

### New Unified Schema Structure

```typescript
// src/server/db/schema/auth.ts
// Uses Supabase auth.users table structure
export const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email").unique(),
  emailConfirmedAt: timestamp("email_confirmed_at"),
  phone: text("phone"),
  phoneConfirmedAt: timestamp("phone_confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Supabase metadata fields
  rawAppMetaData: jsonb("raw_app_meta_data"),
  rawUserMetaData: jsonb("raw_user_meta_data"),
});

// src/server/db/schema/public.ts
// Application tables with RLS
export const publicSchema = pgSchema("public");

// Simplified profile table linking to auth.users
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => users.id),
    organizationId: text("organization_id").notNull(),
    bio: text("bio"),
    emailNotificationsEnabled: boolean("email_notifications_enabled").default(
      true,
    ),
    notificationFrequency: notificationFrequencyEnum(
      "notification_frequency",
    ).default("IMMEDIATE"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    pgPolicy("users_view_own", {
      for: "all",
      to: "authenticated",
      using: sql`auth.uid() = id`,
    }),
  ],
);

// Simplified roles with JSONB permissions
export const roles = pgTable(
  "roles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    organizationId: text("organization_id").notNull(),
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    isSystem: boolean("is_system").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    pgPolicy("org_members_view", {
      for: "select",
      using: sql`organization_id = auth.jwt() ->> 'organization_id'`,
    }),
  ],
);
```

### Day 3-4: Supabase Auth & Drizzle Context Setup

```typescript
// src/server/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import * as schema from "./schema";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

// New unified context using Supabase auth
export const createTRPCContext = async (opts: CreateTRPCContextOptions) => {
  // Get Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Public context without organization
    const client = postgres(process.env.DATABASE_URL!);
    return {
      db: drizzle(client, { schema }),
      session: null,
      organization: null,
    };
  }

  // Extract organization from JWT
  const organizationId = session.user.app_metadata.organization_id as string;

  // Create DB client with RLS context
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connection: {
      application_name: `pinpoint_${organizationId}`,
    },
  });

  const db = drizzle(client, { schema });

  // Set JWT for RLS policies
  await db.execute(sql`
    SET LOCAL request.jwt.claims = '${JSON.stringify(session.user)}';
    SET LOCAL role = 'authenticated';
  `);

  return {
    db,
    session,
    organization: organizationId
      ? await db.query.organizations.findFirst({
          where: eq(organizations.id, organizationId),
        })
      : null,
  };
};
```

### Step 1.4: Query Migration Examples

```typescript
// Before (Prisma)
const issue = await ctx.db.issue.findFirst({
  where: {
    id: input.issueId,
    organizationId: ctx.organization.id,
  },
  include: {
    machine: {
      include: {
        location: true,
        model: true,
      },
    },
    status: true,
    assignedTo: true,
  },
});

// After (Drizzle with RLS)
const issue = await ctx.db.query.issues.findFirst({
  where: eq(issues.id, input.issueId),
  // No need for organizationId - RLS handles it!
  with: {
    machine: {
      with: {
        location: true,
        model: true,
      },
    },
    status: true,
    assignedTo: true,
  },
});

// Complex query example
const machinesWithIssues = await ctx.db
  .select({
    machine: machines,
    openIssues: sql<number>`count(${issues.id})`.as("open_issues"),
  })
  .from(machines)
  .leftJoin(
    issues,
    and(eq(issues.machineId, machines.id), eq(issues.statusCategory, "OPEN")),
  )
  .groupBy(machines.id)
  .orderBy(desc(sql`open_issues`));
```

### Day 5-6: Storage Integration & Service Functions

```typescript
// src/lib/storage/supabase-storage.ts
export class SupabaseStorage implements ImageStorageProvider {
  async uploadIssueAttachment(file: File, issueId: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("issue-attachments")
      .upload(`${issueId}/${file.name}`, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("issue-attachments").getPublicUrl(data.path);

    return publicUrl;
  }

  async deleteImage(path: string): Promise<void> {
    await supabase.storage.from("issue-attachments").remove([path]);
  }
}
```

### Step 2.3: RLS Policies for Supabase Tables

```sql
-- Storage RLS
CREATE POLICY "Users can upload issue attachments" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'issue-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT id FROM issues
    WHERE organization_id = auth.jwt() ->> 'organization_id'
  )
);

-- Auth RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization members" ON auth.users
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT user_id FROM memberships
    WHERE organization_id = auth.jwt() ->> 'organization_id'
  )
);
```

---

## Architecture Changes

### 1. Direct Service Functions (No Factory Pattern)

```typescript
// New approach - simple, direct functions
export async function createIssueActivity(
  db: DrizzleDB,
  data: {
    issueId: string;
    type: ActivityType;
    actorId: string;
    metadata?: any;
  },
) {
  // RLS handles organization isolation automatically
  return db
    .insert(issueHistory)
    .values({
      issueId: data.issueId,
      type: data.type,
      actorId: data.actorId,
      metadata: data.metadata,
    })
    .returning();
}

// Use directly in tRPC procedures
await createIssueActivity(ctx.db, {
  issueId: issue.id,
  type: "CREATED",
  actorId: ctx.session.user.id,
});
```

### 2. Simplified tRPC Procedures

Your tRPC procedures remain mostly the same with minor updates:

- Remove manual organizationId filtering (RLS handles it)
- Update queries to use Drizzle syntax
- Simplify permission checks (use Supabase JWT claims)

### 3. RLS Testing Strategy

```typescript
// New testing approach with transactions
describe('Issue Creation', () => {
  it('creates issue with proper isolation', async () => {
    await db.transaction(async (tx) => {
      // Set organization context
      await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);

      // Create test data
      const machine = await tx.insert(machines).values({...}).returning();

      // Test procedure
      const issue = await createIssue(tx, {
        title: 'Test Issue',
        machineId: machine[0].id,
      });

      // Assertions
      expect(issue).toBeDefined();

      // Automatic rollback - no cleanup needed!
      throw new Error('Rollback');
    }).catch(() => {
      // Expected rollback
    });
  });
});
```

---

## Schema Optimizations (Immediate Implementation)

### 1. Simplify Permission System ✅

**Implement Now**: JSONB permissions array on roles table

```typescript
export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organization_id").notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  // Eliminates complex many-to-many relationships
});
```

**Implement Now**: JSONB activity log on issues table

```typescript
export const issues = pgTable("issues", {
  // ... existing fields
  activityLog: jsonb("activity_log").$type<ActivityEvent[]>().default([]),
  // Append-only log, no separate history table needed
});
```

### 3. Auto-Collections via Views ✅

**Implement Now**: Materialized views for automatic collections

```sql
CREATE MATERIALIZED VIEW manufacturer_collections AS
SELECT DISTINCT
  model.manufacturer as name,
  location.id as location_id,
  organization_id
FROM machines
JOIN models ON machines.model_id = models.id
JOIN locations ON machines.location_id = locations.id;
```

### Deferred Optimizations (Post-Migration) ⏳

**Denormalization**: Can be added later with simple migrations

- `openIssueCount` on machines table
- `lastActivityAt` timestamps
- Cached aggregates for performance

These optimizations can be implemented anytime after the core migration is stable.

---

## Implementation Timeline

### Week 1: Core Migration

**Day 1-2**: Supabase setup, Drizzle schema design, delete old tests
**Day 3-4**: Auth integration, RLS policies, context setup
**Day 5**: Query migration, service function rewrites

### Week 2: Feature Restoration

**Day 6-7**: Core features (issues, machines, organizations)
**Day 8-9**: Storage, attachments, notifications
**Day 10**: New test suite implementation

### Week 3: Polish & Validation

**Day 11-12**: Performance testing, RLS validation
**Day 13-14**: Frontend integration updates
**Day 15**: Documentation, deployment prep

---

## Source Code Change Analysis

### 🔴 Full Rewrite Required

```
src/server/
├── auth/                     # Complete rewrite for Supabase
│   ├── config.ts            # Remove NextAuth config
│   ├── providers.ts         # Remove NextAuth providers
│   ├── index.ts             # New Supabase auth
│   └── *.test.ts           # Delete all tests
├── db.ts                    # Rewrite for Drizzle
├── db/                      # New folder for schema
│   └── schema/              # All new Drizzle schemas
└── services/                # Complete rewrite
    ├── factory.ts           # DELETE - no more factories
    └── *.ts                 # Rewrite as simple functions
```

### 🟡 Major Changes Required

```
src/server/api/
├── trpc.ts                  # Update context creation
├── trpc.base.ts             # Major auth updates
├── trpc.permission.ts       # Simplify with Supabase JWT
└── routers/
    ├── *.ts                 # Update all queries to Drizzle
    └── __tests__/           # Delete all tests
```

### 🟢 Minimal Changes

```
src/
├── app/                     # Frontend mostly unchanged
│   └── api/
│       ├── auth/            # Update for Supabase
│       └── trpc/            # No changes needed
├── components/              # Minimal auth updates
├── hooks/                   # Update auth hooks only
└── lib/
    ├── permissions/         # Keep permission constants
    └── image-storage/       # Update to use Supabase

```

### 📁 Archive & Reference Only

```
src/server/
├── auth/__tests__/          # Archive for reference
├── api/__tests__/           # Archive for reference
└── services/__tests__/      # Archive for reference
```

---

## Dependency Tree & Migration Priority

### Level 1: Core Infrastructure (Must Fix First)

```
1. Database Connection (db.ts)
   └── Drizzle client setup

2. Supabase Auth (auth/index.ts)
   └── Session management

3. tRPC Context (api/trpc.base.ts)
   ├── Depends on: Database, Auth
   └── All procedures depend on this
```

### Level 2: Core Features

```
4. Organization & User Management
   ├── organization.ts
   ├── user.ts
   └── role.ts (with new JSONB permissions)

5. Machine & Model Management
   ├── model.core.ts
   ├── machine.core.ts
   └── location.ts
```

### Level 3: Issue System

```
6. Issue Core Features
   ├── issue.core.ts (main functionality)
   ├── Depends on: Machines, Users, Organizations
   └── Most complex migration

7. Issue Sub-features
   ├── issue.comment.ts
   ├── issue.attachment.ts (needs storage)
   ├── issue.timeline.ts
   └── issue.status.ts
```

### Level 4: Secondary Features

```
8. Collections & QR Codes
   ├── collection.ts
   └── qrCode.ts

9. Notifications
   └── notification.ts

10. External Integrations
    ├── pinballMap.ts
    └── model.opdb.ts
```

### Migration Strategy by Dependency Level

**Day 1-2**: Complete Level 1 (break everything, fix foundation)
**Day 3-4**: Fix Level 2 (organizations and machines working)
**Day 5-7**: Fix Level 3 (core issue functionality)
**Day 8-10**: Fix Level 4 (remaining features)

This approach ensures each level works before moving to dependencies.

---

## Go/No-Go Criteria

### After Phase 1 (Drizzle):

✅ **Proceed if:**

- All queries successfully migrated
- RLS policies working correctly
- Performance equal or better
- Tests passing with new approach

❌ **Abort if:**

- Performance significantly degraded
- RLS policies causing data isolation issues
- Development velocity severely impacted

### After Phase 2 (Supabase):

✅ **Success if:**

- Auth working with all providers
- Storage handling attachments properly
- Cost projections acceptable
- No critical bugs in 48-hour test period

---

## Migration Rollback Plan

### Phase 1 Rollback (Drizzle):

1. Git revert to pre-migration commit
2. Restore Prisma schema and client
3. No data changes needed (same database)

### Phase 2 Rollback (Supabase):

1. Revert auth to NextAuth
2. Switch storage back to local
3. Update environment variables
4. Keep Drizzle if Phase 1 successful

---

## Future Considerations

### Ready for Future Features:

- **Real-time**: Supabase Realtime subscriptions ready to enable
- **Edge Functions**: Image processing, webhooks
- **AI Features**: Vector embeddings for search
- **Global Distribution**: Multi-region replication

### Multi-Region Strategy:

- Start with US regions (Supabase supports multiple US locations)
- Add EU region when needed (GDPR compliance built-in)
- Australia/APAC expansion supported

---

## Conclusion

This unified migration represents a complete architectural transformation:

1. **Database-Enforced Security**: Full RLS from day one
2. **Simplified Architecture**: No service factories, direct functions
3. **Clean Testing**: Fresh start with transaction-based tests
4. **Modern Auth**: Supabase's proven JWT structure
5. **Future Ready**: Built for real-time, edge functions, global scale

The aggressive "break everything and rebuild" approach is justified by:

- No production data to migrate
- Clear dependency tree for systematic rebuilding
- Opportunity to fix architectural debt
- Significant long-term benefits

**Recommendation**: Archive current backend code and proceed with full rewrite. The dependency tree provides clear migration order, and the lack of legacy constraints allows for optimal architecture from the start.
