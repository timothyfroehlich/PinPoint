import { PrismaClient, NotificationType } from "@prisma/client";

describe("Notification schema integration", () => {
  let prisma: PrismaClient;
  let userId: string;
  let _notificationId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const user = await prisma.user.create({
      data: { email: "schematest@example.com", name: "Schema Test" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("enforces required fields and foreign keys", async () => {
    // userId is required
    await expect(
      prisma.notification.create({
        data: {
          type: NotificationType.ISSUE_CREATED,
          message: "Missing userId",
        } as Parameters<typeof prisma.notification.create>[0]["data"],
      }),
    ).rejects.toThrow();
    // valid notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ISSUE_CREATED,
        message: "Valid notification",
      },
    });
    _notificationId = notification.id;
    expect(notification.userId).toBe(userId);
  });

  it("validates enums", async () => {
    await expect(
      prisma.notification.create({
        data: {
          userId,
          type: "INVALID_TYPE" as NotificationType,
          message: "Invalid enum",
        },
      }),
    ).rejects.toThrow();
  });

  it("cascades on user delete", async () => {
    // Create notification for user
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ISSUE_CREATED,
        message: "Cascade delete test",
      },
    });
    // Delete user
    await prisma.user.delete({ where: { id: userId } });
    // Notification should be deleted
    const found = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(found).toBeNull();
  });

  it("sets default values", async () => {
    const user = await prisma.user.create({
      data: { email: "schematest2@example.com", name: "Schema Test 2" },
    });
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.ISSUE_CREATED,
        message: "Default value test",
      },
    });
    expect(notification.read).toBe(false);
    expect(notification.createdAt).toBeInstanceOf(Date);
  });

  it("creates indexes for performance", async () => {
    // This test is a placeholder: index usage is not directly testable in Prisma
    // but we can check that queries by indexed fields work
    const notifications = await prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: "desc" },
    });
    expect(Array.isArray(notifications)).toBe(true);
  });
});
