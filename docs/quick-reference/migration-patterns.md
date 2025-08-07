# Migration Patterns Quick Reference

Current Supabase + Drizzle + RLS migration patterns. Auto-loaded by Claude Code agents.

## Current Migration Status

**Stage 1**: Supabase Auth integration ✅ IN PROGRESS  
**Stage 2**: Drizzle ORM migration (Weeks 3-4)  
**Stage 3**: Row Level Security activation (Weeks 5-6)

## Supabase Auth Patterns (Stage 1)

### Session Management

```typescript
// ✅ Supabase session access
import { createServerClient } from "@supabase/ssr";

export async function createTRPCContext({ req }: { req: NextRequest }) {
  const supabase = createServerClient(cookies);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn("Auth session error:", error.message);
    return { session: null, supabase };
  }

  return { session, supabase };
}
```

### Client-Side Auth

```typescript
// ✅ Client-side Supabase auth
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Sign in
await supabase.auth.signInWithPassword({
  email,
  password,
});

// Sign out
await supabase.auth.signOut();

// Get current user
const {
  data: { user },
} = await supabase.auth.getUser();
```

### tRPC Context Migration

```typescript
// ✅ Updated tRPC context for Supabase
const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id,
      supabase: ctx.supabase, // Available for RLS queries
    },
  });
});
```

## Drizzle Preparation Patterns (Stage 2)

### Schema Definition Preview

```typescript
// ✅ Future Drizzle schema pattern
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const issues = pgTable("issues", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text("title").notNull(),
  description: text("description"),
  organizationId: text("organization_id").notNull(),
  machineId: text("machine_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Query Pattern Preview

```typescript
// ✅ Future Drizzle query pattern
import { eq, and } from "drizzle-orm";

const userIssues = await db
  .select()
  .from(issues)
  .where(
    and(
      eq(issues.organizationId, organizationId),
      eq(issues.createdBy, userId),
    ),
  );
```

## Row Level Security Preparation (Stage 3)

### Policy Preview Patterns

```sql
-- ✅ Future RLS policy pattern
CREATE POLICY "Users can only access their organization's issues"
ON issues
FOR ALL
USING (organization_id = auth.jwt() ->> 'organization_id');
```

### Supabase Client with RLS

```typescript
// ✅ Future RLS-enabled queries
const { data: issues } = await supabase
  .from("issues")
  .select("*")
  .eq("organization_id", organizationId); // RLS will enforce this automatically
```

## Current Compatibility Patterns

### Dual Auth Support

```typescript
// ✅ Supporting both auth systems during transition
const getCurrentUser = async (ctx: Context) => {
  // Check if Supabase auth is enabled
  if (process.env.USE_SUPABASE_AUTH === "true") {
    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    return user;
  }

  // Fallback to NextAuth
  return ctx.session?.user;
};
```

### Environment Variable Strategy

```bash
# ✅ Feature flags for migration stages
USE_SUPABASE_AUTH=true        # Stage 1: Enable Supabase auth
USE_DRIZZLE_ORM=false         # Stage 2: Enable Drizzle (future)
USE_RLS_POLICIES=false        # Stage 3: Enable RLS (future)
```

### Database Strategy

```typescript
// ✅ Current: Prisma with Supabase auth
export async function getIssues(organizationId: string) {
  return await prisma.issue.findMany({
    where: { organizationId }, // Manual scoping (Stage 1-2)
  });
}

// ✅ Future: Drizzle with RLS
export async function getIssues(supabase: SupabaseClient) {
  const { data } = await supabase.from("issues").select("*"); // RLS handles scoping automatically
  return data;
}
```

## Testing During Migration

### Multi-Auth Testing

```typescript
// ✅ Test both auth systems
describe("Authentication", () => {
  beforeEach(() => {
    process.env.USE_SUPABASE_AUTH = "true";
  });

  it("works with Supabase auth", async () => {
    // Test Supabase auth flow
  });

  afterEach(() => {
    delete process.env.USE_SUPABASE_AUTH;
  });
});
```

### Migration Testing Pattern

```typescript
// ✅ Test data consistency across systems
describe("Data Migration", () => {
  it("maintains data integrity during Prisma->Drizzle migration", async () => {
    // Insert with Prisma
    const prismaIssue = await prisma.issue.create({ data: testData });

    // Verify with Drizzle (when available)
    const drizzleIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, prismaIssue.id));

    expect(drizzleIssue[0]).toMatchObject(prismaIssue);
  });
});
```

## Common Migration Commands

```bash
# Stage 1: Supabase setup ✅ COMPLETE
supabase start
supabase status

# Stage 2: Drizzle ORM ✅ COMPLETE
npm run reset:local    # Using Drizzle
npm run db:push        # Schema changes
npm run db:generate    # Type generation
npm run seed           # Explicit seeding

# Stage 3: RLS activation (future)
supabase db migrate up
```

## Error Handling During Migration

### Graceful Fallbacks

```typescript
// ✅ Handle auth system failures gracefully
async function getAuthenticatedUser(ctx: Context) {
  try {
    if (process.env.USE_SUPABASE_AUTH === "true") {
      const {
        data: { user },
        error,
      } = await ctx.supabase.auth.getUser();
      if (error) throw error;
      return user;
    }
  } catch (error) {
    console.warn("Supabase auth failed, falling back to NextAuth:", error);
    return ctx.session?.user;
  }

  return ctx.session?.user;
}
```

### Migration Validation

```typescript
// ✅ Validate migration state
function validateMigrationState() {
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasPrisma = !!process.env.DATABASE_URL;

  if (!hasSupabase && !hasPrisma) {
    throw new Error("No database configuration found");
  }

  if (process.env.USE_SUPABASE_AUTH === "true" && !hasSupabase) {
    throw new Error("Supabase auth enabled but no Supabase configuration");
  }
}
```

## Documentation Updates

### Required Updates During Migration

When making changes during migration, update:

- `@docs/migration/supabase-drizzle/` - Progress tracking
- `@docs/developer-guides/supabase/` - Supabase patterns
- `@docs/developer-guides/drizzle/` - Drizzle patterns (Stage 2)
- Environment variable documentation
- Testing strategy documentation

### Quick Reference Links

- **Auth Patterns**: `@docs/migration/supabase-drizzle/quick-reference/auth-patterns.md`
- **Prisma → Drizzle**: `@docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md`
- **Phase Checklist**: `@docs/migration/supabase-drizzle/quick-reference/phase-checklist.md`

---

**Migration Hub**: See `@docs/migration/supabase-drizzle/` for complete migration documentation  
**Developer Guide**: See `@docs/migration/supabase-drizzle/developer-guide.md` for detailed patterns

**Last Updated**: 2025-08-03  
**Status**: Active Stage 1 - Supabase Auth integration
