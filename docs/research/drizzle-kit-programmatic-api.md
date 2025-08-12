# Drizzle-Kit Programmatic API Research

**Date**: 2025-08-11  
**Context**: Replace `execSync('npx drizzle-kit generate')` with programmatic approach in PGlite test setup

## Executive Summary

✅ **Drizzle-kit provides robust programmatic APIs** that can completely replace CLI-based schema generation for our PGlite testing setup.

**Key Finding**: The `drizzle-kit/api` module offers functions like `generateDrizzleJson()` and `generateMigration()` that can generate CREATE TABLE statements directly from Drizzle schema objects without any CLI dependencies.

## Available APIs

### Core Functions (`drizzle-kit/api`)

```typescript
import { 
  generateDrizzleJson, 
  generateMigration, 
  pushSchema 
} from 'drizzle-kit/api'
```

| Function | Purpose | Returns |
|----------|---------|---------|
| `generateDrizzleJson(imports, prevId?, schemaFilters?, casing?)` | Converts schema objects to JSON representation | Schema snapshot |
| `generateMigration(prev, cur)` | Compares schema snapshots, generates SQL | Array of SQL statements |
| `pushSchema(imports, drizzleInstance, ...)` | Direct schema push to database | Migration statements + warnings |

### Database-Specific Variants
- **SQLite**: `generateSQLiteDrizzleJson()`, `generateSQLiteMigration()`
- **MySQL**: Similar MySQL-specific functions
- **PostgreSQL**: Standard functions work for PostgreSQL

## Implementation Examples

### Basic Schema-to-SQL Generation

```typescript
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import * as schema from '~/server/db/schema'

async function generateSchemaSQL(): Promise<string[]> {
  const emptySchema = {} // Initial state
  
  const statements = await generateMigration(
    generateDrizzleJson(emptySchema),
    generateDrizzleJson(schema)
  )
  
  return statements
}
```

### PGlite Integration (Recommended for Our Use Case)

```typescript
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '~/server/db/schema'

async function createTestDatabase() {
  const client = new PGlite()
  
  // Generate SQL from schema programmatically
  const statements = await generateMigration(
    generateDrizzleJson({}), // Empty initial state
    generateDrizzleJson(schema)
  )
  
  // Apply statements to PGlite
  for (const statement of statements) {
    await client.exec(statement)
  }
  
  return drizzle(client, { schema })
}
```

### Enhanced Error Handling Pattern

```typescript
async function generateCreateStatements(schema: any): Promise<string[]> {
  try {
    const statements = await generateMigration(
      generateDrizzleJson({}),
      generateDrizzleJson(schema)
    )
    return statements
  } catch (error) {
    console.error('Schema generation failed:', error)
    // Could fall back to CLI approach if needed
    throw new Error(`Programmatic schema generation failed: ${error.message}`)
  }
}
```

## Advantages Over CLI Approach

| Aspect | CLI (`execSync`) | Programmatic API |
|--------|------------------|------------------|
| **Performance** | ❌ Process spawning overhead | ✅ Direct function calls |
| **Error Handling** | ❌ Shell error parsing | ✅ Native JS/TS exceptions |
| **Dependencies** | ❌ Requires CLI in PATH | ✅ Direct module import |
| **Debugging** | ❌ Limited visibility | ✅ Full stack traces |
| **File Management** | ❌ Temp files, cleanup | ✅ In-memory operations |
| **CI/CD Reliability** | ❌ External process risks | ✅ Pure JavaScript |

## Integration with Current Project

### Current Pattern (Replace This)

```typescript
// ❌ Current approach - complex and fragile
async function generateSchemaSQL(): Promise<string[]> {
  const tmpDir = join(tmpdir(), `drizzle-test-${Date.now()}`)
  const configPath = join(tmpDir, "drizzle.config.ts")
  // ... 50+ lines of file management and execSync
}
```

### Recommended Replacement

```typescript
// ✅ New approach - clean and direct
async function generateSchemaSQL(): Promise<string[]> {
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api')
  const schema = await import('~/server/db/schema')
  
  return await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema)
  )
}
```

**Code Reduction**: ~100 lines → ~10 lines

## Implementation Considerations

### Module Loading
- Use dynamic imports for compatibility: `await import('drizzle-kit/api')`
- CommonJS fallback if needed: `require('drizzle-kit/api')`
- Some environments prefer the require approach

### Error Strategies
1. **Primary**: Use programmatic API
2. **Fallback**: Enhanced manual schema creation (current fallback approach)
3. **Emergency**: CLI approach (if programmatic fails)

### Migration Concept
- APIs work by comparing "before" and "after" schema states
- For new schema: compare empty schema `{}` to current schema
- Results in CREATE TABLE statements for initial setup

## Recommended Implementation Plan

### Phase 1: Drop-in Replacement
1. Replace `generateSchemaSQL()` function in `pglite-test-setup.ts`
2. Use `generateMigration()` API directly
3. Keep enhanced fallback as safety net
4. Test with existing integration tests

### Phase 2: Enhanced Integration
1. Create utility functions for common patterns
2. Add proper error handling and logging
3. Optimize for performance (caching if beneficial)

### Phase 3: Cleanup
1. Remove temporary file management code
2. Remove CLI dependencies
3. Update documentation

## Testing Validation

**Tests to Run**:
- [ ] All existing integration tests pass
- [ ] Schema accuracy matches current fallback
- [ ] Performance improvement (should be faster)
- [ ] Error handling works correctly
- [ ] CI/CD compatibility

## Code Example: Complete Solution

```typescript
// src/test/helpers/pglite-test-setup.ts (updated section)
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import * as schema from '~/server/db/schema'

/**
 * Generate SQL DDL from actual Drizzle schema using programmatic API
 * Replaces CLI-based approach with direct function calls
 */
async function generateSchemaSQL(): Promise<string[]> {
  try {
    // Use programmatic API to generate migration from empty to current schema
    const statements = await generateMigration(
      generateDrizzleJson({}), // Empty initial schema
      generateDrizzleJson(schema) // Current schema
    )
    
    return statements
  } catch (error) {
    console.warn('Programmatic schema generation failed, using fallback:', error)
    throw error // Will trigger fallback in caller
  }
}

/**
 * Apply ACTUAL Drizzle schema to PGlite database
 * Now uses programmatic API instead of CLI
 */
async function applyDrizzleSchema(db: TestDatabase): Promise<void> {
  try {
    const sqlStatements = await generateSchemaSQL()
    
    for (const statement of sqlStatements) {
      if (statement.trim()) {
        await db.execute(sql.raw(statement))
      }
    }
  } catch (error) {
    console.warn('Programmatic schema application failed, using fallback:', error)
    await createFallbackSchema(db)
  }
}
```

## Conclusion

**Recommendation**: ✅ **Implement programmatic API approach immediately**

**Benefits**:
- Cleaner, more maintainable code
- Better performance and reliability
- Enhanced debugging capabilities
- Perfect fit for PGlite testing scenarios

**Risk**: Low - fallback strategies ensure reliability

This approach perfectly aligns with the project's direct conversion philosophy and will provide a solid foundation for the testing infrastructure going forward.