import { CollectionService } from "./collectionService";
import { CommentCleanupService } from "./commentCleanupService";
import { IssueActivityService } from "./issueActivityService";
import { NotificationService } from "./notificationService";
import { PinballMapService } from "./pinballmapService";
import { QRCodeService } from "./qrCodeService";
import { RoleService } from "./roleService";

import type { DrizzleClient } from "~/server/db/drizzle";

/**
 * Factory for creating service instances.
 * This class ensures that all services receive the same database client
 * and can be a central point for injecting other dependencies or configurations.
 *
 * In a development environment, this factory can be used to inject validation
 * logic into services to audit specific, known-problematic queries.
 *
 * @see src/server/services/validation-helper.ts
 */
export class ServiceFactory {
  constructor(
    private db: DrizzleClient,
    private organizationId?: string,
  ) {}

  createNotificationService(): NotificationService {
    const service = new NotificationService(this.db);
    // Example of targeted auditing: If NotificationService had complex queries
    // that were historically a source of bugs, we could wrap or audit them here
    // when the `DB_AUDIT_QUERIES` flag is enabled.
    //
    // For example, if there was a method `service.getRecentNotifications`:
    //
    // if (process.env.DB_AUDIT_QUERIES === 'true') {
    //   const originalMethod = service.getRecentNotifications.bind(service);
    //   service.getRecentNotifications = (...args) => {
    //     console.log('Auditing getRecentNotifications query...');
    //     // Here you would construct a representative query object and audit it.
    //     // auditDatabaseQuery({ select: { userId: '...' } });
    //     return originalMethod(...args);
    //   };
    // }
    return service;
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

  // Organization-scoped services
  createRoleService(organizationId?: string): RoleService {
    const orgId = organizationId ?? this.organizationId;
    if (!orgId) {
      throw new Error("Organization ID required for RoleService");
    }
    return new RoleService(this.db, orgId);
  }

  // Factory method to create organization-scoped factory
  withOrganization(organizationId: string): ServiceFactory {
    return new ServiceFactory(this.db, organizationId);
  }
}
