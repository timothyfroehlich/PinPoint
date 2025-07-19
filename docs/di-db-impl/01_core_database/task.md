# Phase 1: Core Database Module Refactoring

## Priority: CRITICAL - BLOCKER FOR ALL OTHER PHASES

## Objective

Transform the database module from a singleton pattern to a factory pattern with provider class, eliminating auto-initialization on import.

## Files to Modify

### 1. `src/server/db.ts`

**Current State:**

- Exports singleton `db` instance that auto-initializes on import
- Creates Prisma client with Accelerate extension
- Uses global caching in development

**Target State:**

- Export only `createPrismaClient` factory function
- Export `ExtendedPrismaClient` type
- Remove all instance exports
- Remove global singleton pattern

### 2. Create `src/server/db/provider.ts` (NEW FILE)

**Purpose:** Provide controlled database instance management

**Implementation:**

```typescript
import { createPrismaClient, type ExtendedPrismaClient } from "../db";

export class DatabaseProvider {
  private instance?: ExtendedPrismaClient;

  getClient(): ExtendedPrismaClient {
    if (!this.instance) {
      this.instance = createPrismaClient();
    }
    return this.instance;
  }

  async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
      this.instance = undefined;
    }
  }

  // For testing purposes
  reset(): void {
    this.instance = undefined;
  }
}

// Singleton provider for production use
let globalProvider: DatabaseProvider | undefined;

export function getGlobalDatabaseProvider(): DatabaseProvider {
  if (!globalProvider) {
    globalProvider = new DatabaseProvider();
  }
  return globalProvider;
}
```

## Testing Requirements

1. Ensure `createPrismaClient` can be called without side effects
2. Verify provider properly manages instance lifecycle
3. Test disconnect and reset functionality

## Migration Notes

- This change will break all files importing `{ db }`
- Other phases will fix these imports
- Ensure TypeScript compilation still works after changes

## Acceptance Criteria

- [ ] No database connection created on module import
- [ ] Factory function works correctly
- [ ] Provider class manages lifecycle properly
- [ ] Types are correctly exported
- [ ] No global state except optional provider singleton
- [ ] Basic unit tests for provider class
