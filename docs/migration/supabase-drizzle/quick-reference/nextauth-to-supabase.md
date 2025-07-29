# NextAuth to Supabase Quick Reference

Quick pattern mapping for authentication. For complete guide, see [Supabase Auth Guide](../../developer-guides/supabase/auth-patterns.md).

## Session Management

```typescript
// NextAuth
import { getServerSession } from "next-auth";
const session = await getServerSession(authOptions);
const userId = session?.user?.id;

// Supabase
import { createServerClient } from "@supabase/ssr";
const supabase = createServerClient(cookies);
const {
  data: { user },
} = await supabase.auth.getUser();
const userId = user?.id;
```

## tRPC Context

```typescript
// NextAuth
export async function createTRPCContext({ req }) {
  const session = await getServerSession(authOptions);
  return { session, db };
}

// Supabase
export async function createTRPCContext({ req }) {
  const supabase = createServerClient(cookies);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { session, db, supabase };
}
```

## Protected Procedures

```typescript
// NextAuth
const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// Supabase (same pattern, different session source)
const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

## Login/Logout

```typescript
// NextAuth
import { signIn, signOut } from "next-auth/react";
await signIn("google");
await signOut();

// Supabase
const supabase = createBrowserClient();
await supabase.auth.signInWithOAuth({ provider: "google" });
await supabase.auth.signOut();
```

## JWT Claims

```typescript
// NextAuth (custom callbacks)
callbacks: {
  jwt: async ({ token, user }) => {
    if (user) {
      token.organizationId = user.organizationId;
    }
    return token;
  };
}

// Supabase (app_metadata)
// Set during user creation/update:
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { organizationId },
});
```

For complete patterns, see [Supabase Auth Patterns](../../developer-guides/supabase/auth-patterns.md).
