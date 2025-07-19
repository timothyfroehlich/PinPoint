import { CollectionService } from "./collectionService";
import { CommentCleanupService } from "./commentCleanupService";
import { IssueActivityService } from "./issueActivityService";
import { NotificationService } from "./notificationService";
import { PinballMapService } from "./pinballmapService";
import { QRCodeService } from "./qrCodeService";

import type { ExtendedPrismaClient } from "~/server/db";

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
