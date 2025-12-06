# Authentication Patterns

## Auth Check in Server Components

```typescript
// src/app/dashboard/page.tsx
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Now user is guaranteed to exist
  return <DashboardContent user={user} />;
}
```

## Auth Check in Server Actions

```typescript
"use server";

import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

export async function updateProfileAction(
  prevState: { ok: boolean; message?: string } | undefined,
  formData: FormData
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Option 1: Redirect to login
    redirect("/login");
  }

  // Option 2: Return error state (if handled by client)
  // return { ok: false, message: "Unauthorized" };

  // Mutation logic here...
  return { ok: true, message: "Profile updated" };
}
```

**Key points**:

- Always call `auth.getUser()` immediately after creating client (CORE-SSR-002)
- Use `redirect()` for unauthenticated users
- Never skip auth checks in protected routes (CORE-SEC-001)

## Protected Route Pattern

When a route requires authentication, use this pattern at the top of the page component:

```typescript
// src/app/issues/page.tsx (or any protected route)
import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";

export default async function ProtectedPage(): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // User is guaranteed to be authenticated here
  return <div>Protected content</div>;
}
```

**Key points**:

- Check auth at the very start of the component (before any other logic)
- Use `redirect("/login")` to send unauthenticated users to login page
- After the guard, `user` is guaranteed to exist (type narrowing)
- This pattern reached Rule of Three (used in `/dashboard`, `/issues`, `/machines`)

## Logout Action Pattern

```typescript
// src/app/(auth)/actions.ts
export async function logoutAction(): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { ok: false, message: "Failed to sign out" };
    }
  } catch (error) {
    return { ok: false, message: "Something went wrong" };
  }

  // Redirect happens after successful logout
  redirect("/");
}
```

**Key points**:

- `redirect` calls typically happen outside try/catch blocks or after successful logic
- Return a state object if you need to handle errors in the UI via `useActionState`
- If using `redirect`, the client component will simply navigate away
