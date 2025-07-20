# Task: Implement Enhanced Agent Architecture with zod-prisma-types Integration

## Mission Statement

Implement a comprehensive solution for type-safe Prisma mocking that empowers LLM agents with intelligent, schema-driven mock generation. Transform the current TypeScript-Prisma-Jest testing workflow into an agent-friendly architecture using automatically generated Zod schemas.

## Context

### Related GitHub Issue

**Issue #123**: "Implement Enhanced Agent Architecture with zod-prisma-types Integration"

- Contains comprehensive problem analysis and technical requirements
- Documents strategic benefits for agent workflows
- Outlines implementation phases and success criteria

### Current Architecture Challenges

1. **LLM Agent Limitations**: Agents struggle with Prisma's dynamically generated types
2. **Information Impedance Mismatch**: Complex .d.ts files are not LLM-readable
3. **Type-Unsafe Mock Generation**: Agents create plausible but semantically incorrect mocks
4. **Development Velocity**: Manual test creation is slower than agent-assisted

### Strategic Vision

Create a **single source of truth** architecture where:

- Prisma schema generates both TypeScript types AND Zod schemas
- Zod schemas serve as LLM-readable documentation for data structures
- Agents can reason about data shapes from explicit validation rules
- Runtime validation ensures API-database-client consistency

## Technical Research Foundation

This implementation is based on comprehensive research documented in the user's TypeScript mocking analysis, validated against Context7's latest documentation for:

- **zod-prisma-types v3.2.0**: Actively maintained, supports all required features
- **Zod v3.25.29**: Current stable with full feature set
- **Prisma Testing Patterns**: Official singleton + jest-mock-extended approach
- **tRPC Integration**: Mature ecosystem for input validation

## Implementation Strategy

### Phase 1: Generator Setup and Configuration

#### 1.1 Install Dependencies

```bash
npm install zod-prisma-types --save-dev
```

#### 1.2 Configure Prisma Generator

Add to `prisma/schema.prisma`:

```prisma
generator zod {
  provider                         = "zod-prisma-types"
  output                           = "./generated/zod"
  useMultipleFiles                 = true
  writeBarrelFiles                 = true
  createInputTypes                 = true
  addInputTypeValidation           = true
  validateWhereUniqueInput         = true
  createOptionalDefaultValuesTypes = true
  createRelationValuesTypes        = true
  createPartialTypes               = true
  useDefaultValidators             = true
  coerceDate                       = true
  writeNullishInModelTypes         = false
  prismaClientPath                 = "@prisma/client"
}
```

#### 1.3 Update Build Pipeline

Ensure `npm run db:generate` or `npx prisma generate` includes Zod generation.

### Phase 2: Schema Generation and Validation

#### 2.1 Generate Initial Schemas

```bash
npx prisma generate
```

#### 2.2 Verify Generated Output

Check `generated/zod/` directory contains:

- Model schemas (e.g., `UserSchema`, `IssueSchema`)
- Input schemas (e.g., `UserCreateInputSchema`)
- Relation schemas (with `createRelationValuesTypes`)
- Optional default schemas

#### 2.3 Type Safety Validation

Ensure generated schemas align with existing Prisma types:

```typescript
import { UserSchema } from "./generated/zod";
import type { User } from "@prisma/client";

// Verify type compatibility
const testUser: User = UserSchema.parse(mockUserData);
```

### Phase 3: Test Infrastructure Enhancement

#### 3.1 Create Golden Examples

Create `src/test/examples/golden-test-with-zod.ts`:

```typescript
import { prismaMock } from "../singleton";
import { UserSchema, UserCreateInputSchema } from "../generated/zod";
import { createUser } from "../services/userService";

describe("createUser - Golden Example", () => {
  it("should create user with schema-validated mock data", async () => {
    // Generate type-safe mock data using Zod schema
    const mockUserData = UserSchema.parse({
      id: "usr_123abc",
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    // Validate input data against input schema
    const inputData = UserCreateInputSchema.parse({
      email: "test@example.com",
      name: "Test User",
    });

    prismaMock.user.create.mockResolvedValue(mockUserData);

    const result = await createUser(inputData);

    expect(result).toEqual(mockUserData);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: inputData,
    });
  });
});
```

#### 3.2 Update Mock Context

Enhance `src/test/mockContext.ts` with Zod integration:

```typescript
import { z } from "zod";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

// Export generated schemas for easy agent access
export * from "../generated/zod";

// Enhanced mock context with schema validation helpers
export function createMockDataForSchema<T>(
  schema: z.ZodSchema<T>,
  overrides: Partial<T> = {},
): T {
  // Helper function for agents to create valid mock data
  const baseData = generateMockDataFromSchema(schema);
  return schema.parse({ ...baseData, ...overrides });
}
```

### Phase 4: Agent Integration

#### 4.1 Update Task File Templates

Create agent instructions in `docs/orchestrator-system/agent-task-templates/`:

**test-agent-template.md**:

```markdown
## Mock Data Creation with Zod Schemas

When creating test data, always use generated Zod schemas:

1. **Import the relevant schema**: `import { UserSchema } from '../generated/zod'`
2. **Use schema.parse()** to validate mock data: `const mockUser = UserSchema.parse({...})`
3. **Reference input schemas** for create/update operations
4. **Check required vs optional fields** from schema definition

## Schema Locations

- Model schemas: `./generated/zod/index.ts`
- Input schemas: `./generated/zod/inputTypeSchemas/index.ts`
- Relation schemas: Available when needed for complex relationships
```

#### 4.2 Context Provision Strategy

Update CLAUDE.md instructions for agents:

```markdown
## Type-Safe Testing with Generated Schemas

### Schema-First Approach

- **Never guess data structures** - always consult generated Zod schemas
- **Validate all mock data** using schema.parse() before use
- **Use input schemas** for API/service parameter validation
- **Check optional fields** to avoid undefined assignment issues

### Schema Locations

- Generated schemas: `src/generated/zod/`
- Golden examples: `src/test/examples/`
- Mock utilities: `src/test/mockContext.ts`
```

### Phase 5: tRPC Integration Enhancement

#### 5.1 Replace Manual Input Types

Update tRPC routers to use generated input schemas:

```typescript
// Before
export const userRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});

// After
import { UserCreateInputSchema } from "../generated/zod";

export const userRouter = createTRPCRouter({
  create: protectedProcedure
    .input(UserCreateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

#### 5.2 Ensure End-to-End Type Safety

Verify that frontend -> tRPC -> Prisma chain maintains strict typing.

### Phase 6: Documentation and Guidelines

#### 6.1 Create Developer Documentation

**docs/developer-guides/zod-schema-integration.md**:

```markdown
# Zod Schema Integration Guide

## Overview

This project uses automatically generated Zod schemas from Prisma models to ensure type safety and enable intelligent agent development.

## Key Concepts

### Schema Generation

- Schemas are generated automatically via `npx prisma generate`
- Output location: `src/generated/zod/`
- Never edit generated files manually

### Testing Patterns

- Use `SchemaName.parse()` to validate mock data
- Import schemas from `src/generated/zod`
- Follow golden examples in `src/test/examples/`

### Agent Development

- Agents should always reference generated schemas
- Mock data must be validated before use
- Input schemas provide API parameter guidance

## Common Patterns

### Creating Mock Data

\`\`\`typescript
import { UserSchema } from '../generated/zod'

const mockUser = UserSchema.parse({
id: 'usr_123',
email: 'test@example.com',
// ... all required fields
})
\`\`\`

### Testing Service Functions

\`\`\`typescript
import { UserCreateInputSchema } from '../generated/zod'

const validInput = UserCreateInputSchema.parse({
email: 'test@example.com',
name: 'Test User'
})
\`\`\`

## Troubleshooting

### Schema Validation Errors

- Check that all required fields are provided
- Verify field types match schema expectations
- Use `.optional()` or `.nullable()` for optional fields

### Build Errors

- Ensure `npx prisma generate` runs after schema changes
- Verify zod-prisma-types generator is configured correctly
- Check that generated files are included in TypeScript compilation
```

#### 6.2 Update Testing Documentation

**docs/developer-guides/testing-patterns.md** (add section):

```markdown
## Zod-Enhanced Testing Patterns

### Schema-Driven Mock Generation

Replace manual mock creation with schema-validated data generation:

\`\`\`typescript
// ❌ Old way - prone to errors
const mockUser = {
id: '123',
email: 'test@example.com'
// Missing required fields, incorrect types
}

// ✅ New way - schema validated
const mockUser = UserSchema.parse({
id: 'usr_123abc',
email: 'test@example.com',
name: 'Test User',
createdAt: new Date(),
updatedAt: new Date()
})
\`\`\`

### Agent Task Instructions

When agents create tests, they should:

1. Import relevant schemas from `../generated/zod`
2. Use schema.parse() for all mock data
3. Reference input schemas for service parameters
4. Follow golden examples for patterns
```

#### 6.3 Update CLAUDE.md

Add to project instructions:

```markdown
## Zod Schema Integration

### For All Development

- **Schema Location**: `src/generated/zod/` contains auto-generated schemas
- **Validation**: Use `SchemaName.parse()` for all mock data creation
- **Input Types**: Use generated input schemas for API parameters

### For Agent Tasks

- **Required Reading**: Always check generated schemas before creating mocks
- **Golden Examples**: Reference `src/test/examples/golden-test-with-zod.ts`
- **Documentation**: See `docs/developer-guides/zod-schema-integration.md`

### Schema Generation

- **Automatic**: Schemas regenerate with `npx prisma generate`
- **Never Edit**: Generated files are overwritten on each generation
- **Source of Truth**: Prisma schema drives all type definitions
```

## Quality Requirements

### Code Quality

- **Zero TypeScript errors**: All generated schemas must be type-safe
- **Schema validation**: All mock data must pass schema.parse()
- **Documentation**: Comprehensive guides for developers and agents
- **Golden examples**: Clear patterns for proper usage

### Testing Requirements

- **Existing tests pass**: No regression in current test suite
- **New patterns work**: Generated schemas enable better test creation
- **Agent compatibility**: Schemas are accessible and understandable

### Integration Requirements

- **Build pipeline**: Generation works in all environments
- **tRPC compatibility**: Input schemas integrate seamlessly
- **Performance**: Generation doesn't significantly impact build time

## Success Criteria

### Technical Success

1. **Schema Generation**: All Prisma models have corresponding Zod schemas
2. **Type Safety**: Generated schemas pass TypeScript strict mode
3. **Integration**: tRPC uses generated input schemas
4. **Documentation**: Comprehensive guides for developers and agents

### Agent Effectiveness

1. **Mock Quality**: Agents create accurate, schema-validated mocks
2. **Task Completion**: Higher success rate for agent-driven test creation
3. **Code Quality**: Agent-generated tests follow golden examples
4. **Developer Experience**: Faster test development workflow

## Completion Instructions

### Testing and Validation

1. **Run full test suite**: `npm run test` must pass
2. **Validate schemas**: Check generated output for completeness
3. **Test tRPC integration**: Verify input schema usage
4. **Agent testing**: Create sample task with schema instructions

### Documentation

1. **Update developer guides**: Complete all documentation sections
2. **Create golden examples**: Comprehensive test patterns
3. **Update CLAUDE.md**: Agent instructions and schema locations
4. **Verify links**: All documentation references work correctly

### Commit and PR

1. **Commit changes**: Descriptive commit messages for each phase
2. **Create PR**: Reference Issue #123
3. **Testing**: Ensure CI passes with new patterns
4. **Review**: Request review focusing on agent usability

When complete:

1. **Notify orchestrator** with implementation summary
2. **Provide examples** of generated schemas and usage
3. **Document any deviations** from original plan
4. **Suggest next steps** for agent integration testing

---

**Related Issue**: [#123](https://github.com/timothyfroehlich/PinPoint/issues/123)
**Priority**: Medium (Track 2 - Strategic Enhancement)
**Estimated Effort**: 6-8 hours
**Dependencies**: None (can proceed independently)
