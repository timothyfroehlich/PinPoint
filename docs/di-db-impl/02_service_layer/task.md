# Phase 2: Service Layer Standardization

## Priority: HIGH - BLOCKER FOR PHASE 3.3 AND PHASE 4

## Dependencies

- Phase 1 must be completed first

## Objective

Create a centralized service factory and update tRPC context to provide services through dependency injection.

## Files to Create/Modify

### 1. Create `src/server/services/factory.ts` (NEW FILE)

**Purpose:** Centralized service instantiation with proper dependencies

**Implementation:**

```typescript
import type { ExtendedPrismaClient } from "~/server/db";
import { NotificationService } from "./notificationService";
import { CollectionService } from "./collectionService";
import { PinballMapService } from "./pinballmapService";
import { IssueActivityService } from "./issueActivityService";
import { CommentCleanupService } from "./commentCleanupService";
import { QRCodeService } from "./qrCodeService";

export class ServiceFactory {
  constructor(private db: ExtendedPrismaClient) {}

  createNotificationService(): NotificationService {
    return new NotificationService(this.db);
  }

  createCollectionService(): CollectionService {
    return new CollectionService(this.db);
  }

  createPinballMapService(): PinballMapService {
    return new PinballMapService(this.db);
  }

  createIssueActivityService(): IssueActivityService {
    return new IssueActivityService(this.db);
  }

  createCommentCleanupService(): CommentCleanupService {
    return new CommentCleanupService(this.db);
  }

  createQRCodeService(): QRCodeService {
    return new QRCodeService(this.db);
  }
}

export type IServiceFactory = ServiceFactory;
```

### 2. Update `src/server/api/trpc.base.ts`

**Changes Required:**

- Import `DatabaseProvider` instead of `db`
- Import `ServiceFactory`
- Update `createTRPCContext` to:
  - Create database provider instance
  - Get database client from provider
  - Create service factory with database
  - Add both `db` and `services` to context

**Key Changes:**

```typescript
import { DatabaseProvider } from "~/server/db/provider";
import { ServiceFactory } from "~/server/services/factory";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const dbProvider = new DatabaseProvider();
  const db = dbProvider.getClient();
  const services = new ServiceFactory(db);

  // ... rest of existing logic

  return {
    db,
    services,
    session,
    organization,
    ...opts,
  };
};
```

### 3. Verify Service Compatibility

**Check each service class:**

- Ensure constructor accepts `ExtendedPrismaClient` (not regular PrismaClient)
- Update imports if needed
- No other changes should be required

## Testing Requirements

1. Service factory creates instances correctly
2. tRPC context includes service factory
3. Services are accessible in procedures
4. Type safety is maintained

## Acceptance Criteria

- [ ] Service factory created with all services
- [ ] tRPC context updated to include service factory
- [ ] All services can be instantiated through factory
- [ ] TypeScript types are correct
- [ ] Basic unit test for service factory
- [ ] tRPC context test updated
