import { CollectionService } from "../collectionService";
import { CommentCleanupService } from "../commentCleanupService";
import { ServiceFactory } from "../factory";
import { IssueActivityService } from "../issueActivityService";
import { NotificationService } from "../notificationService";
import { PinballMapService } from "../pinballmapService";
import { QRCodeService } from "../qrCodeService";

import type { ExtendedPrismaClient } from "~/server/db";

jest.mock("../notificationService");
jest.mock("../collectionService");
jest.mock("../pinballmapService");
jest.mock("../issueActivityService");
jest.mock("../commentCleanupService");
jest.mock("../qrCodeService");

describe("ServiceFactory", () => {
  let factory: ServiceFactory;
  const mockDb = {} as ExtendedPrismaClient;

  beforeEach(() => {
    factory = new ServiceFactory(mockDb);
  });

  it("should create a NotificationService instance", () => {
    const service = factory.createNotificationService();
    expect(service).toBeInstanceOf(NotificationService);
    expect(NotificationService).toHaveBeenCalledWith(mockDb);
  });

  it("should create a CollectionService instance", () => {
    const service = factory.createCollectionService();
    expect(service).toBeInstanceOf(CollectionService);
    expect(CollectionService).toHaveBeenCalledWith(mockDb);
  });

  it("should create a PinballMapService instance", () => {
    const service = factory.createPinballMapService();
    expect(service).toBeInstanceOf(PinballMapService);
    expect(PinballMapService).toHaveBeenCalledWith(mockDb);
  });

  it("should create an IssueActivityService instance", () => {
    const service = factory.createIssueActivityService();
    expect(service).toBeInstanceOf(IssueActivityService);
    expect(IssueActivityService).toHaveBeenCalledWith(mockDb);
  });

  it("should create a CommentCleanupService instance", () => {
    const service = factory.createCommentCleanupService();
    expect(service).toBeInstanceOf(CommentCleanupService);
    expect(CommentCleanupService).toHaveBeenCalledWith(mockDb);
  });

  it("should create a QRCodeService instance", () => {
    const service = factory.createQRCodeService();
    expect(service).toBeInstanceOf(QRCodeService);
    expect(QRCodeService).toHaveBeenCalledWith(mockDb);
  });
});
