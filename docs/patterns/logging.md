# Logging Patterns

## Structured Logging in Server Actions

```typescript
// src/app/(auth)/actions.ts
"use server";

import { log } from "~/lib/logger";
import { createClient } from "~/lib/supabase/server";

export async function loginAction(formData: FormData): Promise<LoginResult> {
  // Validate input
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    log.warn(
      { errors: parsed.error.issues, action: "login" },
      "Login validation failed"
    );
    return err("VALIDATION", "Invalid input");
  }

  const { email, password } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      log.warn(
        { action: "login", error: error?.message },
        "Login authentication failed"
      );
      return err("AUTH", error?.message ?? "Authentication failed");
    }

    log.info(
      { userId: data.user.id, action: "login" },
      "User logged in successfully"
    );

    return ok({ userId: data.user.id });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "login",
      },
      "Login server error"
    );
    return err("SERVER", error instanceof Error ? error.message : "Unknown");
  }
}
```

**Key points**:

- Use `log.info()` for successful operations
- Use `log.warn()` for recoverable errors (validation, auth failures)
- Use `log.error()` for server errors with stack traces
- Always include context fields (`userId`, `action`, etc.) but never log PII
- Keep message concise; details go in the context object

**Log format**:

```json
{
  "level": "info",
  "time": "2025-11-13T03:19:13.061Z",
  "msg": "User logged in successfully",
  "userId": "abc123",
  "email": "user@example.com",
  "action": "login"
}
```

**Testing**:

- Unit tests don't need to verify logging (implementation detail)
- E2E tests can check for log files if critical
