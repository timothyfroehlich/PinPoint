# Supabase Authentication Patterns

## Overview

Supabase Auth provides JWT-based authentication with built-in OAuth providers, magic links, and user management. In PinPoint, we use Supabase Auth with custom metadata for multi-tenant isolation.

## JWT Structure

Supabase JWTs contain standard claims plus custom app_metadata:

```typescript
interface SupabaseJWT {
  // Standard claims
  sub: string; // User ID
  email: string;
  aud: string; // Audience
  exp: number; // Expiration

  // Custom app_metadata
  app_metadata: {
    organizationId: string;
    membershipId: string;
    permissions: string[];
  };
}
```

## Session Management

### Server-Side Sessions

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSession() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
```

### Client-Side Sessions

```typescript
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

// Get current user
const {
  data: { user },
} = await supabase.auth.getUser();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN") {
    // Handle sign in
  } else if (event === "SIGNED_OUT") {
    // Handle sign out
  }
});
```

## tRPC Integration

### Context Setup

```typescript
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export async function createTRPCContext(opts: FetchCreateContextFnOptions) {
  const supabase = createServerClient(cookies);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Extract organization from JWT
  const organizationId = session?.user?.app_metadata?.organizationId;

  // Get organization data if authenticated
  let organization = null;
  if (organizationId) {
    organization = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
  }

  return {
    session,
    organization,
    db,
    supabase,
    headers: opts.req.headers,
  };
}
```

### Protected Procedures

```typescript
const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id,
    },
  });
});
```

## OAuth Configuration

### Provider Setup

```typescript
// In Supabase dashboard or via API
const providers = ["google", "github"];

// Client-side OAuth login
async function signInWithOAuth(provider: "google" | "github") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}
```

### Callback Handling

```typescript
// app/auth/callback/route.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = createServerClient(cookies);
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(requestUrl.origin);
}
```

## User Metadata

### Setting Organization Context

```typescript
// During user creation or organization assignment
const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  app_metadata: {
    organizationId: organization.id,
    membershipId: membership.id,
    permissions: ["issue:create_full", "issue:view"],
  },
});
```

### Accessing Metadata

```typescript
function getUserOrganization(session: Session): string | null {
  return session?.user?.app_metadata?.organizationId ?? null;
}

function getUserPermissions(session: Session): string[] {
  return session?.user?.app_metadata?.permissions ?? [];
}
```

## ⚠️ MIGRATION: NextAuth Patterns

### Session Structure Changes

```typescript
// OLD: NextAuth Session
interface NextAuthSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    organizationId?: string;
  };
  expires: string;
}

// NEW: Supabase Session
interface SupabaseSession {
  user: {
    id: string;
    email: string;
    user_metadata: {
      name?: string;
    };
    app_metadata: {
      organizationId?: string;
      permissions: string[];
    };
  };
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
```

### Callback Migration

```typescript
// OLD: NextAuth Callbacks
export const authOptions: NextAuthOptions = {
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.organizationId = token.organizationId;
      return session;
    },
  },
};

// NEW: Supabase Approach
// Metadata is set during user operations, not in callbacks
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { organizationId, permissions },
});
```

### Provider Migration

```typescript
// OLD: NextAuth Provider Config
providers: [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
];

// NEW: Supabase Provider Config
// Configure in Supabase dashboard under Authentication > Providers
// Or via Supabase CLI/API
```

## Security Considerations

1. **JWT Validation**: Supabase automatically validates JWTs. Never trust client-side user data.
2. **Metadata Immutability**: Users cannot modify their own app_metadata (only user_metadata).
3. **RLS Integration**: JWT claims can be used directly in PostgreSQL RLS policies.
4. **Token Refresh**: Supabase handles token refresh automatically in client libraries.

## Common Patterns

### Check User Permissions

```typescript
export function hasPermission(
  session: Session | null,
  permission: string,
): boolean {
  if (!session?.user) return false;
  const permissions = session.user.app_metadata?.permissions ?? [];
  return permissions.includes(permission);
}
```

### Organization-Scoped Queries

```typescript
export const organizationProcedure = protectedProcedure.use(({ ctx, next }) => {
  const organizationId = ctx.session.user.app_metadata?.organizationId;

  if (!organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No organization access",
    });
  }

  return next({
    ctx: {
      ...ctx,
      organizationId,
    },
  });
});
```

### Logout Handling

```typescript
async function handleLogout() {
  // Client-side
  await supabase.auth.signOut();

  // Optional: Redirect to public page
  window.location.href = "/";
}
```

## Testing

```typescript
// Mock Supabase session for tests
export const mockSupabaseSession: Session = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    app_metadata: {
      organizationId: "test-org-id",
      permissions: ["issue:create_full", "issue:view"],
    },
    user_metadata: {
      name: "Test User",
    },
  },
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_at: Date.now() + 3600,
};
```
