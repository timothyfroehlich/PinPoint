# Drizzle + Zod Validation Patterns

## Overview

Drizzle integrates seamlessly with Zod for runtime validation. You can generate Zod schemas from your Drizzle tables, ensuring your validation always matches your database schema.

## Installation

```bash
npm install drizzle-zod zod
```

## Generating Zod Schemas

### Basic Schema Generation

```typescript
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { issues } from "~/server/db/schema";

// Generate schemas from Drizzle table
export const insertIssueSchema = createInsertSchema(issues);
export const selectIssueSchema = createSelectSchema(issues);

// Types
type InsertIssue = z.infer<typeof insertIssueSchema>;
type SelectIssue = z.infer<typeof selectIssueSchema>;
```

### Custom Refinements

```typescript
// Add custom validation rules
export const insertIssueSchema = createInsertSchema(issues, {
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  // Custom email validation for reporter
  reporterEmail: z.string().email().optional(),
});

// Add business logic validation
export const createIssueInputSchema = insertIssueSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    organizationId: true, // Set by server
  })
  .extend({
    attachments: z.array(z.string().url()).max(5).optional(),
  })
  .refine(
    (data) => {
      // If anonymous, must provide email
      if (!data.createdById && !data.reporterEmail) {
        return false;
      }
      return true;
    },
    {
      message: "Anonymous issues must include reporter email",
    },
  );
```

## tRPC Integration

### Input Validation

```typescript
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createIssueInputSchema } from "~/server/validators/issue";

export const issueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createIssueInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Input is fully typed and validated
      const issue = await ctx.db
        .insert(issues)
        .values({
          ...input,
          organizationId: ctx.organization.id,
          createdById: ctx.session.user.id,
        })
        .returning();

      return issue[0];
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: insertIssueSchema.partial().omit({
          id: true,
          organizationId: true,
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Partial update with validated data
      const updated = await ctx.db
        .update(issues)
        .set(input.data)
        .where(
          and(
            eq(issues.id, input.id),
            eq(issues.organizationId, ctx.organization.id),
          ),
        )
        .returning();

      return updated[0];
    }),
});
```

### Output Validation

```typescript
// Ensure API responses match expected shape
const issueWithRelationsSchema = selectIssueSchema.extend({
  machine: selectMachineSchema,
  status: selectIssueStatusSchema,
  createdBy: selectUserSchema.nullable(),
  _count: z.object({
    comments: z.number(),
    attachments: z.number(),
  }),
});

export const issueRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(issueWithRelationsSchema)
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          issue: issues,
          machine: machines,
          status: issueStatuses,
          createdBy: users,
          commentCount: count(comments.id),
        })
        .from(issues)
        // ... joins
        .where(eq(issues.id, input.id));

      // Transform to match output schema
      return {
        ...result.issue,
        machine: result.machine,
        status: result.status,
        createdBy: result.createdBy,
        _count: {
          comments: result.commentCount,
          attachments: 0, // Would come from another query
        },
      };
    }),
});
```

## Form Integration

### React Hook Form + Zod

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createIssueInputSchema } from "~/server/validators/issue";

export function CreateIssueForm() {
  const createIssue = api.issue.create.useMutation();

  const form = useForm({
    resolver: zodResolver(createIssueInputSchema),
    defaultValues: {
      title: "",
      description: "",
      machineId: "",
      priorityId: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof createIssueInputSchema>) => {
    try {
      await createIssue.mutateAsync(data);
      // Success handling
    } catch (error) {
      // Error handling
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register("title")} />
      {form.formState.errors.title && (
        <span>{form.formState.errors.title.message}</span>
      )}
      {/* Other fields */}
    </form>
  );
}
```

### Server Actions + Zod

```typescript
"use server";

import { createIssueInputSchema } from "~/server/validators/issue";

export async function createIssueAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const rawData = {
    title: formData.get("title"),
    description: formData.get("description"),
    machineId: formData.get("machineId"),
  };

  const validation = createIssueInputSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message,
    };
  }

  try {
    await db.insert(issues).values(validation.data);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: "Failed to create issue",
    };
  }
}
```

## Advanced Patterns

### Discriminated Unions

```typescript
// Different validation based on issue type
const baseIssueSchema = createInsertSchema(issues);

export const issueInputSchema = z.discriminatedUnion("type", [
  // Hardware issue requires serial number
  baseIssueSchema.extend({
    type: z.literal("hardware"),
    serialNumber: z.string().min(1),
    errorCode: z.string().optional(),
  }),

  // Software issue requires version
  baseIssueSchema.extend({
    type: z.literal("software"),
    softwareVersion: z.string().min(1),
    stackTrace: z.string().optional(),
  }),

  // General issue
  baseIssueSchema.extend({
    type: z.literal("general"),
  }),
]);
```

### Nested Validation

```typescript
// Validate nested data structures
const createIssueWithDetailsSchema = createInsertSchema(issues)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // Validate attachments
    attachments: z
      .array(
        z.object({
          file: z.instanceof(File),
          description: z.string().optional(),
        }),
      )
      .max(5)
      .optional(),

    // Validate initial comment
    initialComment: z
      .object({
        content: z.string().min(1).max(5000),
        isInternal: z.boolean().default(false),
      })
      .optional(),

    // Validate custom fields
    customFields: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  });
```

### Permission-Based Validation

```typescript
// Different schemas based on user permissions
export function getIssueUpdateSchema(permissions: string[]) {
  const baseSchema = insertIssueSchema
    .partial()
    .omit({ id: true, organizationId: true });

  // Regular users can only update certain fields
  if (!permissions.includes("issue:admin")) {
    return baseSchema.pick({
      title: true,
      description: true,
      attachments: true,
    });
  }

  // Admins can update everything
  return baseSchema;
}

// Usage in tRPC
export const issueRouter = createTRPCRouter({
  update: protectedProcedure
    .input((ctx) => {
      const schema = getIssueUpdateSchema(ctx.user.permissions);
      return z.object({
        id: z.string(),
        data: schema,
      });
    })
    .mutation(async ({ ctx, input }) => {
      // Update with permission-validated data
    }),
});
```

## ⚠️ MIGRATION: Prisma Validation Patterns

### Schema Generation Differences

```typescript
// OLD: Manual Zod schemas for Prisma
const CreateIssueSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  machineId: z.string(),
  // Must manually keep in sync with Prisma schema
});

// NEW: Generated from Drizzle
export const createIssueSchema = createInsertSchema(issues, {
  // Only specify custom validations
  title: z.string().min(1).max(255),
});
```

### Type Safety

```typescript
// OLD: Prisma types + manual Zod
import { Issue } from "@prisma/client";
type CreateIssueInput = z.infer<typeof CreateIssueSchema>;
// Types might drift apart

// NEW: Drizzle + drizzle-zod
type InsertIssue = z.infer<typeof insertIssueSchema>;
type SelectIssue = z.infer<typeof selectIssueSchema>;
// Always in sync with database schema
```

## Utilities

### Schema Factories

```typescript
// Create reusable schema factories
export function createPaginationSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    hasMore: z.boolean(),
  });
}

// Usage
const paginatedIssuesSchema = createPaginationSchema(selectIssueSchema);
```

### Error Formatting

```typescript
import { z } from "zod";

export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.join(".");
      return `${path}: ${err.message}`;
    })
    .join(", ");
}

// Usage in API
try {
  const validated = schema.parse(input);
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: formatZodError(error),
    });
  }
}
```

## Testing

```typescript
import { describe, it, expect } from "vitest";

describe("Issue validation", () => {
  it("should validate valid issue input", () => {
    const input = {
      title: "Test Issue",
      description: "Description",
      machineId: "123",
      priorityId: "high",
    };

    const result = createIssueInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject invalid input", () => {
    const input = {
      title: "", // Too short
      machineId: "123",
    };

    const result = createIssueInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0]?.path).toEqual(["title"]);
  });
});
```

## Best Practices

1. **Generate base schemas** from Drizzle tables
2. **Extend with business logic** rather than rewriting
3. **Use discriminated unions** for complex validation
4. **Create reusable utilities** for common patterns
5. **Test your schemas** independently from your API
