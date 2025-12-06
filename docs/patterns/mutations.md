# Mutation Patterns

## Server Action + Zod Validation + useActionState

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

export type CreateMachineState = {
  ok: boolean;
  message?: string;
  issues?: string[];
};

export async function createMachineAction(
  prevState: CreateMachineState | undefined,
  formData: FormData
): Promise<CreateMachineState> {
  // 1. Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse({
    name: formData.get("name"),
  });

  if (!validation.success) {
    return {
      ok: false,
      message: "Invalid input",
      issues: validation.error.issues.map((i) => i.message),
    };
  }

  const { name } = validation.data;

  // 3. Database operation
  let machineId: string;
  try {
    const [machine] = await db.insert(machines).values({ name }).returning();

    if (!machine) throw new Error("Machine creation failed");
    machineId = machine.id;
  } catch {
    return {
      ok: false,
      message: "Failed to create machine. Please try again.",
    };
  }

  // 4. Revalidate + Redirect on success
  // Note: Redirect must happen outside try/catch
  revalidatePath("/machines");
  redirect(`/machines/${machineId}`);
}
```

**Key points**:

- Separate Zod schemas from Server Actions (Next.js requirement)
- Always validate and authenticate before mutations
- Return a serializable state object (`ok`, `message`, `issues`)
- Use `useActionState` hook in the client component to consume the result
- `redirect()` throws internally, so call it after success logic is complete
- Revalidate affected paths before redirecting
