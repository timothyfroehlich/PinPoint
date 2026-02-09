---
applyTo: "**/*auth*.ts,**/middleware.ts,src/lib/supabase/**/*.ts,src/app/(auth)/**/*.ts"
---

# Authentication Instructions (Supabase SSR, Single-Tenant)

## Core Objectives

- Provide SSR auth using Supabase without multi-tenant org logic.
- Ensure immediate user resolution after client creation.
- Guarantee progressive enhancement for login/signup forms.

## Required Patterns

1. `createClient()` wrapper in `src/lib/supabase/server.ts` handles cookies & returns a Supabase client.
2. Immediately call `supabase.auth.getUser()` after creating the client (do not insert logic between).
3. Middleware (`middleware.ts`) manages token refresh; do **not** mutate the response object body.
4. OAuth callback route (`src/app/auth/callback/route.ts`) redirects on success.
5. Use Server Actions for mutations (login, signup, logout) with Zod validation.

## Example SSR Client Wrapper

```ts
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "~/lib/supabase/env";

export async function createClient() {
  const cookieStore = cookies();
  const { url, publishableKey } = getSupabaseEnv();
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (pairs) =>
        pairs.forEach((p) => cookieStore.set(p.name, p.value, p.options)),
    },
  });
  await client.auth.getUser(); // REQUIRED immediate call
  return client;
}
```

## Login Server Action Pattern

```ts
// src/app/(auth)/actions.ts
"use server";
import { z } from "zod";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export async function login(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid credentials" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Auth failed" };
  redirect("/dashboard");
}
```

## Forbidden Patterns

- Direct use of `@supabase/supabase-js` in Server Components (use wrapper).
- Introducing organization scoping or RLS logic.
- Performing side-effect logic between `createClient()` and `auth.getUser()`.
- Using deprecated helper packages (e.g., auth-helpers-nextjs).

## Forms & Progressive Enhancement

- Render forms as plain HTML with `<form action={serverAction}>`.
- Client enhancements (validation hints) optional; core submit must work without JS.

## Middleware Essentials

- Implement refresh token logic only; avoid injecting custom response bodies.
- Keep middleware small—delegate business logic to Server Actions.

## Logout Pattern

```ts
export async function logout(): Promise<void> {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

## Testing Guidance (Auth)

- Integration: test login/signup Server Actions with worker-scoped DB & mocked Supabase if needed.
- E2E: Use Playwright to drive actual form submission flows.
- Avoid unit tests for SSR client wrapper complexity—treat as integration boundary.

## Copilot Should Not Suggest

- Multi-tenant permission checks.
- RLS policy enforcement code.
- tRPC procedures.

---

Last Updated: 2025-11-09
