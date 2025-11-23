# Mutation Patterns

## Server Action + Zod Validation + Redirect

```typescript
// src/app/machines/schemas.ts
import { z } from "zod";

export const createMachineSchema = z.object({
  name: z
    .string()
    .min(1, "Machine name is required")
    .max(100, "Machine name must be less than 100 characters")
    .trim(),
});
```

```typescript
// src/app/machines/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { createMachineSchema } from "./schemas";
import { setFlash } from "~/lib/flash";

export async function createMachineAction(formData: FormData): Promise<void> {
  // 1. Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized. Please log in." });
    redirect("/login");
  }

  // 2. Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse({
    name: formData.get("name"),
  });

  if (!validation.success) {
    const firstError = validation.error.issues[0];
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/machines/new");
  }

  const { name } = validation.data;

  // 3. Database operation
  try {
    const [machine] = await db.insert(machines).values({ name }).returning();

    if (!machine) throw new Error("Machine creation failed");

    // 4. Flash + revalidate + redirect on success
    await setFlash({
      type: "success",
      message: `Machine "${name}" created successfully`,
    });
    revalidatePath("/machines");
    redirect(`/machines/${machine.id}`);
  } catch {
    await setFlash({
      type: "error",
      message: "Failed to create machine. Please try again.",
    });
    redirect("/machines/new");
  }
}
```

**Key points**:

- Separate Zod schemas from Server Actions (Next.js requirement)
- Always validate and authenticate before mutations
- Use flash messages + redirect for Post-Redirect-Get pattern
- Revalidate affected paths after mutations
- `redirect()` throws internally to exit the function
- Return type is `Promise<void>` (not `Result<T>`)
