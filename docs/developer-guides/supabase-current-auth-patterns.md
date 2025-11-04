# Current Supabase Auth Patterns

Current authentication patterns used in PinPoint. **Note**: NextAuth has been removed - these are our current operational patterns.

## 🏗️ Client Creation Patterns

### Server Client

```typescript
// utils/supabase/server.ts - CURRENT PATTERN
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
// utils/supabase/client.ts - CURRENT PATTERN
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

## 🔄 tRPC Context Pattern

### Current Context Implementation

```typescript
// CURRENT: Supabase SSR context
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
    db, // Drizzle client
    supabase,
  };
}
```

## 🌐 Middleware Pattern

### Token Refresh Middleware

```typescript
// middleware.ts - CURRENT PATTERN
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

## ⚡ Server Actions

### Authentication Actions

```typescript
// actions/auth.ts - CURRENT PATTERN
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

## 🔐 Server Components Auth

### Protected Pages Pattern

```typescript
// app/dashboard/page.tsx - CURRENT PATTERN
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

## 🧪 Testing Patterns

### Auth Mocks

```typescript
// Essential mocks for auth testing
vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "123", email: "test@example.com" } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "123" } } },
        error: null,
      }),
    },
  }),
}));
```

## 📋 Common Patterns Checklist

**Every Auth Implementation Should:**

- [ ] Use `@supabase/ssr` package (NOT deprecated auth-helpers)
- [ ] Use `getAll()`/`setAll()` for cookies (NOT individual methods)
- [ ] Call `getUser()` in middleware for token refresh
- [ ] Handle auth errors gracefully
- [ ] Use Server Actions for auth flows

**Protected Routes Should:**

- [ ] Check auth in Server Components with `await`
- [ ] Redirect to login on missing auth
- [ ] Access user metadata properly

**Testing Should:**

- [ ] Mock `next/headers` and Supabase client
- [ ] Use factory functions for auth states
- [ ] Test both authenticated and unauthenticated flows

## ⚠️ Critical Anti-Patterns

**❌ NEVER:**

- Use deprecated `@supabase/auth-helpers` packages
- Use individual cookie methods (`get()`, `set()`, `remove()`)
- Skip `getUser()` call in middleware
- Use client auth patterns in server context
- Forget to mock `next/headers` in tests
