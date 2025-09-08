# Validation Best Practices

**Last Updated**: September 5, 2025

## Overview

This document outlines best practices for input validation in the PinPoint application to ensure consistency, maintainability, and prevent duplication across the codebase.

## Centralized Validation Architecture

### Core Principles

1. **Single Source of Truth**: All validation schemas are centralized in `~/lib/validation/schemas.ts`
2. **Consistent Error Messages**: Use standardized error messages across the application
3. **Reusable Patterns**: Create composable schemas that can be combined for complex validation needs
4. **Type Safety**: All validation schemas provide full TypeScript type inference

### Schema Organization

```typescript
// ✅ Good: Import from centralized schemas
import { nameSchema, idSchema, emailSchema } from '~/lib/validation/schemas';

// ❌ Bad: Inline validation patterns
const userSchema = z.object({
  name: z.string().min(1, "Name required").max(255),  // Don't do this
  email: z.string().email()                           // Don't do this
});

// ✅ Good: Use centralized schemas
const userSchema = z.object({
  name: nameSchema,
  email: emailSchema
});
```

## Schema Categories

### 1. Basic ID Schemas

- `idSchema` - General purpose non-empty ID validation
- `uuidSchema` - UUID format validation
- `machineIdSchema`, `userIdSchema`, etc. - Entity-specific IDs

### 2. Text Content Schemas

- `nameSchema` - Entity names (255 char limit)
- `titleSchema` - Issue titles (200 char limit)  
- `commentContentSchema` - User comments (2000 char limit)
- `descriptionSchema` - Longer descriptions (5000 char limit)
- `searchQuerySchema` - Search input (200 char limit)

### 3. Email and Contact Schemas

- `emailSchema` - Email validation with RFC limits
- `optionalEmailSchema` - Optional email validation

### 4. Composite Schemas

- `createEntitySchema` - Basic entity creation
- `updateEntitySchema` - Entity updates with partial fields
- `createIssueSchema` - Issue creation validation
- `createCommentSchema` - Comment creation validation

## Validation Limits

All character limits are defined in the `LIMITS` constant:

```typescript
export const LIMITS = {
  COMMENT_MAX: 2000,
  TITLE_MAX: 200,
  NAME_MAX: 255,
  DESCRIPTION_MAX: 5000,
  SEARCH_QUERY_MAX: 200,
  EMAIL_MAX: 320,
  ROLE_NAME_MAX: 50,
  STATUS_NAME_MAX: 50,
  BIO_MAX: 500,
  COLLECTION_NAME_MAX: 50,
} as const;
```

### Usage

```typescript
// ✅ Good: Use LIMITS constants
const customSchema = z.string().max(LIMITS.TITLE_MAX);

// ❌ Bad: Hardcoded limits
const customSchema = z.string().max(200);
```

## Common Patterns

### Optional vs Required Fields

```typescript
// Required field
const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema
});

// Optional field in updates
const updateUserSchema = z.object({
  id: idSchema,
  name: optionalNameSchema,
  email: optionalEmailSchema
});
```

### Custom Error Messages

When you need custom error messages, extend the base schemas:

```typescript
// ✅ Good: Extend with custom message
const machineNameSchema = nameSchema.refine(
  (name) => !name.includes('test'),
  { message: "Machine names cannot contain 'test'" }
);

// ❌ Bad: Recreate entire schema
const machineNameSchema = z.string()
  .min(1, "Machine name required")
  .max(255, "Too long")
  .refine((name) => !name.includes('test'), "No test names");
```

### Transformations

Use the built-in transformations in centralized schemas:

```typescript
// All text schemas automatically trim whitespace
const result = nameSchema.parse("  John Doe  "); // "John Doe"

// Email schemas normalize to lowercase
const email = emailSchema.parse("USER@EXAMPLE.COM"); // "user@example.com"
```

## ESLint Rules

The project includes custom ESLint rules to prevent validation duplication:

- `validation/no-duplicate-validation` - Detects inline validation patterns that should use centralized schemas
- Suggests appropriate centralized schema replacements
- Enforces use of LIMITS constants instead of hardcoded numbers

### Auto-fixes

Many validation issues can be auto-fixed:

```bash
# Fix validation issues automatically
npm run lint:fix
```

## Validation Consistency Checker

Run the validation consistency checker to find potential issues:

```bash
# Check for validation inconsistencies
npm run validate:consistency
```

This will detect:
- Duplicate validation patterns that should use centralized schemas
- Inconsistent validation limits for the same data types
- Missing imports from the centralized validation library
- Hardcoded limits that should use LIMITS constants

## Migration Guide

### From Inline Validation

1. **Identify the validation pattern**:
   ```typescript
   // Old pattern
   z.string().min(1, "Name required").max(255)
   ```

2. **Find the equivalent centralized schema**:
   ```typescript
   // New pattern  
   nameSchema
   ```

3. **Update imports**:
   ```typescript
   import { nameSchema } from '~/lib/validation/schemas';
   ```

### From Custom Schemas

1. **Check if a centralized schema exists** for your use case
2. **If not**, consider adding it to the centralized schemas
3. **If it's very specific**, extend an existing schema instead of creating from scratch

## Testing Validation

### Test Structure

```typescript
import { nameSchema } from '~/lib/validation/schemas';

describe('nameSchema validation', () => {
  it('should accept valid names', () => {
    const result = nameSchema.safeParse('Valid Name');
    expect(result.success).toBe(true);
  });

  it('should reject empty names', () => {
    const result = nameSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Name is required');
    }
  });
});
```

### Test Coverage

Ensure you test:
- Valid inputs (boundary cases)
- Invalid inputs (empty, too long, wrong format)
- Edge cases (whitespace, special characters)
- Error messages match expectations

## Performance Considerations

### Schema Reuse

```typescript
// ✅ Good: Reuse schemas
const userSchema = z.object({
  name: nameSchema,
  email: emailSchema
});

const adminSchema = userSchema.extend({
  permissions: z.array(z.string())
});

// ❌ Bad: Recreate schemas
const userSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email()
});

const adminSchema = z.object({
  name: z.string().min(1).max(255),  // Duplicated
  email: z.string().email(),         // Duplicated
  permissions: z.array(z.string())
});
```

### Validation Caching

For frequently used schemas, consider caching validation results:

```typescript
// For expensive validations
const memoizedValidation = useMemo(() => {
  return complexSchema.safeParse(data);
}, [data]);
```

## Common Mistakes to Avoid

### 1. Hardcoded Limits

```typescript
// ❌ Don't do this
z.string().max(255)

// ✅ Do this  
z.string().max(LIMITS.NAME_MAX)
```

### 2. Inconsistent Error Messages

```typescript
// ❌ Don't do this - inconsistent messages
z.string().min(1, "Title required")
z.string().min(1, "Name needed")

// ✅ Do this - use centralized schemas with consistent messages
titleSchema
nameSchema
```

### 3. Ignoring Type Inference

```typescript
// ❌ Don't manually type when Zod can infer
interface User {
  name: string;
  email: string;
}

// ✅ Use Zod inference
type User = z.infer<typeof userSchema>;
```

### 4. Not Using Optional Variants

```typescript
// ❌ Don't recreate optional versions
const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional()
});

// ✅ Use provided optional variants
const updateUserSchema = z.object({
  name: optionalNameSchema
});
```

## Future Enhancements

- **Form Integration**: Direct integration with React Hook Form
- **API Documentation**: Auto-generate API docs from validation schemas
- **Database Constraints**: Sync validation limits with database constraints
- **Real-time Validation**: Client-side validation with server-side schema sharing

---

## Quick Reference

### Import Everything You Need
```typescript
import { 
  idSchema, nameSchema, titleSchema, 
  emailSchema, descriptionSchema,
  LIMITS 
} from '~/lib/validation/schemas';
```

### Common Patterns
```typescript
// Entity with name
z.object({ name: nameSchema })

// Update schema
z.object({ id: idSchema, name: optionalNameSchema })

// Custom limit
z.string().max(LIMITS.CUSTOM_MAX)
```

### Check Consistency
```bash
npm run validate:consistency
npm run lint:fix
```