# Supabase: Latest Updates for Server-Centric Architecture

_Server-first authentication and realtime patterns for Next.js App Router_

## Key Changes Since November 2025

### 🚨 **Critical Migration Required**

**@supabase/auth-helpers → @supabase/ssr**

- **BREAKING:** `@supabase/auth-helpers-nextjs` is DEPRECATED
- **DO:** Migrate to `@supabase/ssr` immediately
- **DON'T:** Use both packages in same project - causes auth loops
- **Migration Impact:** Complete rewrite of client creation and cookie handling

**Server-Centric Authentication**

- **DO:** Use server-side cookie management for session handling
- **DON'T:** Rely on client-side token management patterns
- **Migration Benefit:** Secure, HTTP-only cookies + Server Components support

### 🔄 **New Authentication Patterns**

**Client Creation Changes**

```typescript
// OLD: Deprecated auth-helpers
createServerComponentClient(); // ❌ REMOVED
createClientComponentClient(); // ❌ REMOVED

// NEW: SSR package
createClient(); // ✅ Server utils
createClient(); // ✅ Client utils
```

**Cookie Handling Revolution**

- **DO:** Use `getAll()` and `setAll()` for cookie management
- **DON'T:** Use individual `get()`, `set()`, `remove()` methods
- **Critical:** Prevents session desynchronization and auth loops

**Middleware Requirements**

- **DO:** Always call `supabase.auth.getUser()` in middleware
- **DON'T:** Skip auth token refresh - causes random logouts
- **Migration Impact:** Required for Server Components auth

### ⚡ **Realtime Architecture Changes**

**Broadcast Pattern (Recommended)**

- **DO:** Use database triggers + private channels for realtime
- **DON'T:** Use "Postgres Changes" method for new features
- **Migration Benefit:** Better scalability, security, RLS support

**Authorization with RLS**

- **DO:** Set `private: true` for channels requiring auth
- **DON'T:** Rely on client-side security for realtime data
- **Migration Impact:** Explicit RLS policies required for subscriptions

### 🛠 **Backend Capabilities**

**New Native Features**

- **pg_cron:** Database-native job scheduling
- **pgmq:** Postgres message queues for background tasks
- **Declarative Schemas:** Version-controlled database structure

## Migration Workflow

### Phase 1: Package Migration

```bash
# Remove deprecated packages
npm uninstall @supabase/auth-helpers-nextjs
# Install new SSR package
npm install @supabase/ssr
```

### Phase 2: Client Utilities

Create new server and client utilities:

**utils/supabase/server.ts**

```typescript
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
        /* handle setting */
      },
    },
  });
}
```

**utils/supabase/client.ts**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(url, key);
}
```

### Phase 3: Update Components

Replace all client creation calls:

**Server Components**

```typescript
// OLD
const supabase = createServerComponentClient<Database>({
  cookies: () => cookieStore,
});

// NEW
const supabase = await createClient();
```

**Client Components**

```typescript
// OLD
const supabase = createClientComponentClient<Database>();

// NEW
const supabase = createClient();
```

### Phase 4: Middleware Updates

Implement proper auth refresh:

```typescript
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);

  // CRITICAL: Always call getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect("/login");
  }

  return supabaseResponse; // Must return supabase response
}
```

## Server Actions Integration

**Authentication Actions**

```typescript
"use server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) redirect("/error");
  redirect("/dashboard");
}
```

**Protected Pages**

```typescript
// Server Component
export default async function ProtectedPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return <div>Hello {user.email}</div>
}
```

## Realtime Migration

### Old: Postgres Changes

```typescript
// DEPRECATED - Security limitations
supabase.channel("changes").on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "posts",
  },
  callback,
);
```

### New: Broadcast Pattern

```sql
-- Database trigger
CREATE OR REPLACE FUNCTION notify_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.broadcast('posts', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_broadcast
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION notify_changes();
```

```typescript
// Client subscription with RLS
const channel = supabase
  .channel("posts", {
    config: { private: true },
  })
  .on("broadcast", { event: "update" }, callback)
  .subscribe();
```

## Common Migration Issues

**Cookie Management Failures**

- ❌ Using individual cookie methods breaks auth
- ✅ Always use `getAll()` and `setAll()`
- ❌ Mixing auth-helpers with SSR packages
- ✅ Complete migration to SSR package

**Middleware Problems**

- ❌ Skipping `auth.getUser()` call
- ✅ Always refresh tokens in middleware
- ❌ Not returning supabase response
- ✅ Return modified supabase response object

**Session Management**

- ❌ Using `getSession()` for page protection
- ✅ Use `getUser()` for revalidation and security

**RLS Configuration**

- ❌ Forgetting RLS policies for realtime
- ✅ Explicit policies for broadcast subscriptions

## Testing Strategy

**Mock Server Client**

```typescript
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: "test@example.com" } },
      }),
    },
  }),
}));
```

**Mock Client Component**

```typescript
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "123" } } },
      }),
    },
  }),
}));
```

## Next Steps

1. **Audit current auth-helpers usage** in project
2. **Create new SSR utility files** for server/client
3. **Update all component imports** systematically
4. **Test authentication flows** thoroughly
5. **Migrate realtime subscriptions** to broadcast pattern
6. **Update middleware** with proper token refresh

_Full examples and detailed migration patterns in [tech-stack-research-catchup.md](../tech-stack-research-catchup.md)_
