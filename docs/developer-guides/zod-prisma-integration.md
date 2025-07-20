# Zod-Prisma Integration Guide

## Overview

This guide covers the comprehensive `zod-prisma-types` integration implemented in PinPoint to enable type-safe, schema-validated testing and create an LLM agent-friendly development environment.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Generated Schemas](#generated-schemas)
- [Testing Patterns](#testing-patterns)
- [tRPC Integration](#trpc-integration)
- [Agent Guidelines](#agent-guidelines)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Basic Usage

```typescript
// Import generated schemas
import { UserSchema, IssueCreateInputSchema } from "~/prisma/generated/zod";

// Validate mock data
const validUser = UserSchema.parse({
  id: "clh7xkg7w0000x9yz0qj3k1vq", // Valid CUID format
  name: "Test User",
  email: "test@example.com",
  // ... other required fields
});

// Validate input data
const validInput = IssueCreateInputSchema.parse({
  title: "Test Issue",
  description: "Test description",
  machineId: "clh7xkg7w0001x9yz0qj3k1vq",
});
```

### Using Test Infrastructure

```typescript
import { createValidUser, validateMockData } from "~/src/test/mockContext";

// Use factory functions
const user = createValidUser({
  name: "Custom Name",
  email: "custom@example.com",
});

// Validate custom mock data
const customIssue = validateMockData(IssueSchema, {
  id: "clh7xkg7w0002x9yz0qj3k1vq",
  title: "Custom Issue",
  // ... other fields
});
```

## Architecture

### Components

1. **Prisma Generator**: Configured in `prisma/schema.prisma`
2. **Generated Schemas**: Located in `prisma/generated/zod/`
3. **Test Infrastructure**: Enhanced `src/test/mockContext.ts`
4. **tRPC Integration**: Schema validation in routers
5. **Golden Examples**: `src/lib/zod/__tests__/golden-test-with-zod.test.ts`

### Configuration

The Prisma generator is configured with these key options:

```prisma
generator zod {
  provider                         = "zod-prisma-types"
  output                          = "./generated/zod"
  useMultipleFiles                = true
  createInputTypes                = true
  createRelationValuesTypes       = true
  createPartialTypes              = true
  createOptionalDefaultValuesTypes = true
  addInputTypeValidation          = false
  addIncludeType                  = true
  addSelectType                   = true
  useTypeAssertions               = true  // Critical for TypeScript strictest mode
}
```

## Generated Schemas

### File Structure

```
prisma/generated/zod/
├── index.ts                     # Barrel exports
├── modelSchema/                 # Model schemas (User, Issue, etc.)
├── inputTypeSchemas/           # Input schemas (Create, Update, etc.)
└── outputTypeSchemas/          # Output type schemas
```

### Key Schema Types

#### Model Schemas

- `UserSchema` - Complete user model validation
- `IssueSchema` - Complete issue model validation
- `MachineSchema` - Complete machine model validation
- `OrganizationSchema` - Complete organization model validation

#### Input Schemas

- `UserCreateInputSchema` - User creation input
- `IssueUncheckedCreateInputSchema` - Issue creation with IDs
- `IssueCreateInputSchema` - Issue creation with nested objects
- `UserUpdateInputSchema` - User update operations

#### Key Differences

- **CreateInput**: Expects nested objects (e.g., `machine: { connect: { id } }`)
- **UncheckedCreateInput**: Accepts direct IDs (e.g., `machineId: "string"`)

## Testing Patterns

### Golden Example Structure

```typescript
describe("Schema-Validated Testing", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it("should create user with schema validation", async () => {
    // ✅ Generate validated mock data
    const mockUser: User = UserSchema.parse({
      id: "clh7xkg7w0000x9yz0qj3k1vq", // Valid CUID
      name: "Test User",
      email: "test@example.com",
      emailVerified: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      bio: null,
      profilePicture: null,
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: false,
      notificationFrequency: "IMMEDIATE",
    });

    // ✅ Validate input against schema
    const input = UserCreateInputSchema.parse({
      name: "Test User",
      email: "test@example.com",
    });

    // Mock and test
    ctx.db.user.create.mockResolvedValue(mockUser);
    const result = await ctx.db.user.create({ data: input });

    // ✅ Verify result matches schema
    expect(() => UserSchema.parse(result)).not.toThrow();
  });
});
```

### Best Practices

1. **Always Use CUID Format**: `clh7xkg7w0000x9yz0qj3k1vq`
2. **Validate All Mock Data**: Use schemas to ensure data consistency
3. **Use Factory Functions**: Leverage `createValidUser()`, etc.
4. **Test Schema Compliance**: Verify results match schemas
5. **Handle Validation Errors**: Test both success and failure cases

### CUID Generation

For valid CUID format in tests:

```typescript
// Use this pattern for generating test CUIDs
const generateTestCUID = (suffix: string = "q") =>
  `clh7xkg7w${Date.now().toString().slice(-12)}x9yz0qj3k1v${suffix}`;

// Or use predefined ones for consistency
const USER_ID = "clh7xkg7w0000x9yz0qj3k1vq";
const ORG_ID = "clh7xkg7w0001x9yz0qj3k1vr";
const MACHINE_ID = "clh7xkg7w0002x9yz0qj3k1vs";
```

## tRPC Integration

### Router Schema Usage

```typescript
import { IssueUncheckedCreateInputSchema } from "~/prisma/generated/zod";

export const issueRouter = createTRPCRouter({
  create: organizationProcedure
    .input(
      // Pick only frontend-provided fields
      IssueUncheckedCreateInputSchema.pick({
        title: true,
        description: true,
        consistency: true,
        machineId: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Backend adds required fields
      const issueData = {
        ...input,
        organizationId: ctx.organization.id,
        statusId: defaultStatus.id,
        priorityId: defaultPriority.id,
        createdById: ctx.session.user.id,
      };

      return ctx.db.issue.create({ data: issueData });
    }),
});
```

### Schema Selection Patterns

```typescript
// ✅ Pick specific fields for API input
const ApiInputSchema = ModelUncheckedCreateInputSchema.pick({
  field1: true,
  field2: true,
});

// ✅ Omit sensitive fields
const PublicSchema = ModelSchema.omit({
  password: true,
  internalNotes: true,
});

// ✅ Extend with custom validation
const ExtendedSchema = ModelCreateInputSchema.extend({
  confirmPassword: z.string().min(8),
});
```

## Agent Guidelines

### For LLM Agents Working with This System

#### 1. Schema Discovery

```typescript
// Always import required schemas first
import {
  UserSchema,
  IssueUncheckedCreateInputSchema,
  // ... other needed schemas
} from "~/prisma/generated/zod";
```

#### 2. Mock Data Generation

```typescript
// Use validation to ensure data correctness
const createValidMockData = <T>(
  schema: ZodType<T>,
  overrides: Partial<T> = {},
): T => {
  const baseData = {
    // Provide sensible defaults
    id: generateTestCUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return schema.parse(baseData);
};
```

#### 3. Error Handling

```typescript
// Always handle validation errors gracefully
try {
  const validData = UserSchema.parse(mockData);
  return validData;
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Validation failed:", error.issues);
    // Provide helpful error context
  }
  throw error;
}
```

#### 4. Testing Patterns

- Always validate mock data with schemas
- Use CUID format for IDs
- Leverage existing factory functions
- Test both success and failure scenarios
- Ensure all required fields are provided

## Troubleshooting

### Common Issues

#### 1. CUID Validation Errors

```
Error: String must contain at least 25 character(s)
```

**Solution**: Use proper CUID format: `clh7xkg7w0000x9yz0qj3k1vq`

#### 2. TypeScript exactOptionalPropertyTypes Errors

```
Error: Argument of type '{ prop: string | undefined }' is not assignable
```

**Solution**: Partially fixed with `useTypeAssertions = true` in generator config.

**Known Limitation**: Generated Include/Select schemas may still show TypeScript errors with `exactOptionalPropertyTypes: true`. This is a known issue with `zod-prisma-types` v3.2.4 and `exactOptionalPropertyTypes`. The schemas are functional and tests pass, but TypeScript may show errors in generated files.

**Workaround**: Generated files are excluded from both git tracking and ESLint, but may still appear in TypeScript checking.

#### 3. Schema Not Found Errors

```
Error: Cannot find module '~/prisma/generated/zod'
```

**Solution**: Run `npx prisma generate` to regenerate schemas

#### 4. ESLint Errors in Generated Files

**Solution**: Generated files are excluded in `eslint.config.js`

### Regenerating Schemas

```bash
# Regenerate all schemas after Prisma model changes
npx prisma generate

# Verify generation was successful
ls prisma/generated/zod/
```

### Validation Debugging

```typescript
// Add detailed error logging
const validateWithLogging = <T>(schema: ZodType<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(
        "Validation errors:",
        error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          received: issue.received,
        })),
      );
    }
    throw error;
  }
};
```

## Benefits

### For Developers

1. **Type Safety**: Automatic validation of all test data
2. **Schema Documentation**: Generated schemas serve as living docs
3. **Error Prevention**: Invalid data caught at validation time
4. **Maintainability**: Schema changes auto-update test requirements

### For LLM Agents

1. **Intelligent Mock Generation**: Schema-guided data creation
2. **Validation Feedback**: Clear error messages for invalid data
3. **Pattern Recognition**: Consistent testing patterns to follow
4. **Reduced Errors**: Automatic validation prevents common mistakes

## Next Steps

1. **Extend Router Integration**: Apply schema validation to more tRPC routers
2. **Enhanced Factory Functions**: Add more specialized mock data generators
3. **Custom Validators**: Create domain-specific validation rules
4. **Performance Optimization**: Consider schema caching for large test suites

---

For more information, see:

- [Testing Patterns Guide](./testing-patterns.md)
- [TypeScript Strictest Guide](./typescript-strictest.md)
- [Golden Example Test](../src/lib/zod/__tests__/golden-test-with-zod.test.ts)
