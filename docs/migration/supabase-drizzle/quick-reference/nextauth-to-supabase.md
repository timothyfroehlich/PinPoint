# NextAuth → Supabase: Server-Centric Migration Guide

Modern Supabase auth with @supabase/ssr for Next.js App Router. Use Context7 for latest documentation.

## 🚨 Context7 Research First

```bash
# Always verify current patterns before migration
resolve-library-id "supabase"
get-library-docs /supabase/supabase --topic="auth SSR Next.js App Router"
```

---

## 🎯 Migration Philosophy

**Direct Conversion Approach:**

- Server-first authentication with @supabase/ssr
- App Router / Server Components integration
- Cookie-based session management
- No client-side token handling
- Server Actions for auth flows

**🚨 CRITICAL: Use @supabase/ssr (NOT auth-helpers)**

- `@supabase/auth-helpers-nextjs` is DEPRECATED and causes auth loops
- Must use `getAll()` and `setAll()` for cookies (not individual methods)

---

## 🔧 Package Migration

### Remove Deprecated Packages

```bash
# Remove NextAuth
npm uninstall next-auth @auth/prisma-adapter

# Remove deprecated Supabase auth helpers
npm uninstall @supabase/auth-helpers-nextjs @supabase/auth-helpers-shared

# Install modern SSR package
npm install @supabase/ssr
```

---

## 🏗️ Client Creation Patterns

### Server Client (NEW Pattern)

```typescript
// utils/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // CRITICAL: Use getAll/setAll (not individual methods)
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}
```

### Browser Client

```typescript
// utils/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

---

## 🔄 tRPC Context Migration

### From NextAuth to Supabase

```typescript
// OLD: NextAuth context
export async function createTRPCContext({ req }: { req: NextRequest }) {
  const session = await getServerSession(authOptions);
  return {
    session,
    user: session?.user,
    db: prisma,
  };
}

// NEW: Supabase SSR context
export async function createTRPCContext({ req }: { req: NextRequest }) {
  const supabase = createServerClient(/* cookies setup */);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn("Auth session error:", error.message);
    return { session: null, user: null, db, supabase };
  }

  return {
    session,
    user: session?.user ?? null,
    db, // Now Drizzle in direct conversion
    supabase,
  };
}
```

**Protected Procedures:** Minimal changes needed - same session check pattern

---

## 🌐 Next.js Middleware Migration

### Critical Token Refresh Pattern

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // CRITICAL: Always call getUser() for token refresh
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect routes
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
```

---

## ⚡ Server Actions Migration

### Authentication Actions

```typescript
// actions/auth.ts
"use server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect("/error?message=" + error.message);
  }

  revalidatePath("/");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/error?message=" + error.message);
  }

  revalidatePath("/");
  redirect("/login");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect("/error?message=" + error.message);
  }

  redirect("/verify-email");
}
```

**Forms:** Use `<form action={signInAction}>` with Server Actions

---

## 🔐 Server Components Authentication

### Protected Pages

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      {/* Dashboard content */}
    </div>
  )
}
```

**User Data:** Access `user.app_metadata` for organization/role info

---

## 🧪 Testing Patterns

**Server Components:** Mock `next/headers` and `@/utils/supabase/server`
**Server Actions:** Mock auth actions module and test FormData handling

```typescript
// Essential mocks
vi.mock("next/headers", () => ({ cookies: () => ({ getAll: vi.fn() }) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));
```

---

## 🔗 OAuth Migration

**Configuration:** Set up providers in Supabase Dashboard → Authentication → Providers
**Implementation:** Use `signInWithOAuth({ provider: 'google' })` in Server Actions

---

## ⚠️ Migration Pitfalls

**Authentication Issues:**

- ❌ Using deprecated `@supabase/auth-helpers` packages
- ✅ Use `@supabase/ssr` for all new auth implementations
- ❌ Individual cookie methods (`get()`, `set()`, `remove()`)
- ✅ Always use `getAll()` and `setAll()` for cookie management
- ❌ Skipping `getUser()` call in middleware
- ✅ Token refresh on every protected request

**Server Components:**

- ❌ Forgetting to make pages `async` for auth checks
- ✅ Always `await` Supabase calls in Server Components
- ❌ Using client auth patterns in server context
- ✅ Use server client creation patterns

**Testing Setup:**

- ❌ Forgetting to mock `next/headers` in tests
- ✅ Mock both server and client Supabase utilities
- ❌ Complex session state setup in every test
- ✅ Use factory functions for common auth states

---

## 📋 Migration Checklist

**Phase 1: Package Setup (Day 1)**

- [ ] Remove NextAuth and deprecated auth-helpers
- [ ] Install `@supabase/ssr` package
- [ ] Create server and client utilities
- [ ] Update environment variables

**Phase 2: Core Migration (Days 2-3)**

- [ ] Update tRPC context for Supabase sessions
- [ ] Implement middleware with token refresh
- [ ] Convert authentication pages to Server Actions
- [ ] Update protected page patterns

**Phase 3: Testing & Validation (Day 4)**

- [ ] Update all auth-related tests
- [ ] Test OAuth provider flows
- [ ] Verify session persistence
- [ ] Manual testing of all auth flows

---

_Complete auth migration strategy: @docs/migration/supabase-drizzle/direct-conversion-plan.md_
