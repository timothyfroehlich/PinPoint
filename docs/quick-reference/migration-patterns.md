# Migration Patterns: Direct Conversion

Current migration workflows for solo development velocity. Focus on clean implementations over complex validation.

## 🎯 Core Migration Philosophy

**Direct Conversion Principles:**

- One router at a time, test immediately
- Clean Drizzle implementations (no Prisma remnants)
- Server-centric auth with @supabase/ssr
- Manual validation over automated infrastructure
- TypeScript compilation as primary safety net

---

## 🔐 Supabase SSR Authentication

### Server Client Creation

```typescript
// utils/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });
}
```

### Next.js Middleware Integration

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);

  // CRITICAL: Always call getUser() for token refresh
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect("/login");
  }

  return response;
}
```

### Server Action Auth Pattern

```typescript
// actions/auth.ts
"use server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) redirect("/error");
  redirect("/dashboard");
}
```

---

## 🗄️ Prisma → Drizzle Direct Conversion

### Router Conversion Workflow

**1. Setup Phase:**

```typescript
// Before: Prisma client in tRPC context
ctx.prisma.user.findMany();

// After: Drizzle query
ctx.db.query.users.findMany();
```

**2. Query Conversion:**

```typescript
// Prisma include pattern
const posts = await prisma.post.findMany({
  include: { author: true, comments: true },
});

// Drizzle relational queries
const posts = await db.query.posts.findMany({
  with: { author: true, comments: true },
});
```

**3. Organizational Scoping:**

```typescript
// Maintain multi-tenancy with Drizzle
const posts = await db.query.posts.findMany({
  where: eq(posts.organizationId, ctx.user.organizationId),
});
```

### Generated Columns Pattern

```typescript
// schema.ts
export const posts = pgTable("posts", {
  title: text("title").notNull(),
  content: text("content").notNull(),

  // Move computed logic to database
  searchVector: tsvector("search_vector").generatedAlwaysAs(
    sql`setweight(to_tsvector('english', title), 'A') || 
        setweight(to_tsvector('english', content), 'B')`,
    { mode: "stored" },
  ),
});
```

---

## 🧪 Testing Migration Patterns

### PGlite In-Memory Testing

```typescript
// vitest.setup.ts
vi.mock("./src/db/index.ts", async (importOriginal) => {
  const { PGlite } = await vi.importActual("@electric-sql/pglite");
  const { drizzle } = await vi.importActual("drizzle-orm/pglite");

  const client = new PGlite();
  const testDb = drizzle(client, { schema });

  return {
    ...(await importOriginal()),
    db: testDb,
  };
});
```

### Router Test Updates

```typescript
// Update existing router tests
const mockDb = vi.hoisted(() => ({
  query: { users: { findMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

test("router procedure", async () => {
  mockDb.query.users.findMany.mockResolvedValue([{ id: 1 }]);
  // Test logic
});
```

---

## ⚡ Next.js App Router Integration

### Server Component Data Fetching

```typescript
// app/posts/page.tsx
import { db } from '@/lib/db'

export default async function PostsPage() {
  // Direct data fetching in Server Component
  const posts = await db.query.posts.findMany({
    with: { author: true }
  })

  return <PostsList posts={posts} />
}
```

### Server Actions for Mutations

```typescript
// actions/posts.ts
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  await db.insert(posts).values({
    title: formData.get("title") as string,
    content: formData.get("content") as string,
  });

  revalidatePath("/posts");
}
```

---

## 🚦 Migration Execution Order

### Phase 1: Foundation (Days 1-3)

1. **Supabase SSR setup** - Replace auth-helpers immediately
2. **Database utilities** - Set up PGlite testing
3. **Middleware update** - Implement proper token refresh

### Phase 2: Router Conversion (Days 4-14)

1. **Simple CRUD first** - Build confidence with patterns
2. **One router at a time** - Test after each conversion
3. **Clean implementations** - Remove all Prisma code

### Phase 3: Validation (Days 15-16)

1. **End-to-end testing** - Key user flows
2. **Performance check** - Query optimization
3. **Documentation update** - Record any behavior changes

---

## ⚠️ Common Migration Pitfalls

**Authentication Issues:**

- ❌ Using individual cookie methods (`get()`, `set()`)
- ✅ Always use `getAll()` and `setAll()`
- ❌ Skipping `getUser()` in middleware
- ✅ Token refresh on every protected request

**Database Conversion:**

- ❌ Keeping Prisma patterns in Drizzle
- ✅ Use relational queries for joins
- ❌ Manual transaction management
- ✅ Leverage database-generated columns

**Testing Strategy:**

- ❌ External Docker databases for tests
- ✅ PGlite in-memory for fast feedback
- ❌ Mocking individual query methods
- ✅ Mock entire database module

---

## 📋 Daily Migration Checklist

**Before Converting Each Router:**

- [ ] Read current router structure and complexity
- [ ] Identify organizational scoping requirements
- [ ] Plan query conversion approach
- [ ] Set up appropriate test mocks

**During Conversion:**

- [ ] Convert one procedure at a time
- [ ] Maintain TypeScript compilation
- [ ] Test each procedure after conversion
- [ ] Keep organizational scoping intact

**After Conversion:**

- [ ] Run full TypeScript build
- [ ] Test key user flows manually
- [ ] Document any behavior changes
- [ ] Commit with descriptive message

---

## 🎯 Success Indicators

**Technical Metrics:**

- TypeScript build passes
- No Prisma imports remaining
- All tests pass with new mocks
- Manual user flows work correctly

**Velocity Metrics:**

- Converting 1-2 routers per day
- Immediate issue resolution
- Clean, readable Drizzle code
- No parallel validation overhead

---

_Reference: @docs/migration/supabase-drizzle/direct-conversion-plan.md for complete strategy_
