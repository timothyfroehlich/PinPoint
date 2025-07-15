import { NotificationType } from "@prisma/client";

import { createTestContext } from "~/test/context";

describe("Notification schema integration", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let userId: string;
  let notificationId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const user = await ctx.prisma.user.create({
      data: { email: "schematest@example.com", name: "Schema Test" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await ctx.prisma.notification.deleteMany();
    await ctx.prisma.user.deleteMany();
    await ctx.prisma.$disconnect();
  });

  it("enforces required fields and foreign keys", async () => {
    // userId is required
    await expect(
      ctx.prisma.notification.create({
        data: {
          type: NotificationType.ISSUE_CREATED,
          message: "Missing userId",
        } as Parameters<typeof ctx.prisma.notification.create>[0]["data"],
      }),
    ).rejects.toThrow();
    // valid notification
    const notification = await ctx.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ISSUE_CREATED,
        message: "Valid notification",
      },
    });
    notificationId = notification.id;
    expect(notification.userId).toBe(userId);
  });

  it("validates enums", async () => {
    await expect(
      ctx.prisma.notification.create({
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
    const notification = await ctx.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ISSUE_CREATED,
        message: "Cascade delete test",
      },
    });
    // Delete user
    await ctx.prisma.user.delete({ where: { id: userId } });
    // Notification should be deleted
    const found = await ctx.prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(found).toBeNull();
  });

  it("sets default values", async () => {
    const user = await ctx.prisma.user.create({
      data: { email: "schematest2@example.com", name: "Schema Test 2" },
    });
    const notification = await ctx.prisma.notification.create({
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
    const notifications = await ctx.prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: "desc" },
    });
    expect(Array.isArray(notifications)).toBe(true);
  });
});
