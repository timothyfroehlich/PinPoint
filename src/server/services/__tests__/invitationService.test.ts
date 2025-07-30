import { randomBytes } from "crypto";

import { addDays } from "date-fns";
import { Resend } from "resend";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  InvitationService,
  type CreateInvitationParams,
  type InvitationWithDetails,
} from "../invitationService";

import type { ExtendedPrismaClient } from "~/server/db";

// Mock crypto module
vi.mock("crypto", () => ({
  randomBytes: vi.fn(),
}));

// Mock date-fns module
vi.mock("date-fns", () => ({
  addDays: vi.fn(),
}));

// Mock Resend module
vi.mock("resend", () => ({
  Resend: vi.fn(),
}));

// Mock environment
vi.mock("~/env.js", () => ({
  env: {
    RESEND_API_KEY: "test-api-key",
    VERCEL_URL: "test.example.com",
  },
}));

// Create mock Prisma client
const mockPrisma = {
  invitation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  membership: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  $accelerate: {
    invalidate: vi.fn(),
    ttl: vi.fn(),
  },
} as unknown as ExtendedPrismaClient;

describe("InvitationService", () => {
  let service: InvitationService;
  let mockRandomBytesImpl: ReturnType<typeof vi.fn>;
  let mockAddDaysImpl: ReturnType<typeof vi.fn>;
  let mockResendSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup crypto mock
    mockRandomBytesImpl = vi.mocked(randomBytes);
    mockRandomBytesImpl.mockReturnValue(
      Buffer.from(
        "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
        "hex",
      ),
    );

    // Setup date-fns mock
    mockAddDaysImpl = vi.mocked(addDays);
    mockAddDaysImpl.mockImplementation((date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    });

    // Setup Resend mock
    mockResendSend = vi.fn().mockResolvedValue({
      data: { id: "email-id" },
      error: null,
    });
    vi.mocked(Resend).mockImplementation(
      () =>
        ({
          emails: {
            send: mockResendSend,
          },
        }) as any,
    );

    service = new InvitationService(mockPrisma);
  });

  describe("createInvitation", () => {
    const validParams: CreateInvitationParams = {
      email: "test@example.com",
      organizationId: "org-123",
      invitedBy: "user-456",
      roleId: "role-789",
      message: "Welcome to our organization!",
    };

    const mockInvitationWithDetails: InvitationWithDetails = {
      id: "invitation-123",
      email: "test@example.com",
      organizationId: "org-123",
      invitedBy: "user-456",
      roleId: "role-789",
      token: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
      status: "PENDING",
      message: "Welcome to our organization!",
      expiresAt: new Date("2024-02-07T00:00:00.000Z"),
      createdAt: new Date("2024-01-31T00:00:00.000Z"),
      updatedAt: new Date("2024-01-31T00:00:00.000Z"),
      organization: {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test-org",
      },
      inviter: {
        id: "user-456",
        name: "John Doe",
        email: "john@example.com",
      },
      role: {
        id: "role-789",
        name: "Member",
      },
    };

    it("should create invitation successfully with message", async () => {
      // Mock: no existing membership
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue(null);

      // Mock: no existing pending invitation
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);

      // Mock: invitation creation
      vi.mocked(mockPrisma.invitation.create).mockResolvedValue(
        mockInvitationWithDetails as any,
      );

      const result = await service.createInvitation(validParams);

      expect(mockPrisma.membership.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: "org-123",
          user: { email: "test@example.com" },
        },
      });

      expect(mockPrisma.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          email: "test@example.com",
          organizationId: "org-123",
          status: "PENDING",
        },
      });

      expect(mockPrisma.invitation.create).toHaveBeenCalledWith({
        data: {
          email: "test@example.com",
          organizationId: "org-123",
          invitedBy: "user-456",
          roleId: "role-789",
          token:
            "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
          expiresAt: expect.any(Date),
          message: "Welcome to our organization!",
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(result).toEqual(mockInvitationWithDetails);
      expect(mockResendSend).toHaveBeenCalled();
    });

    it("should create invitation successfully without message", async () => {
      const paramsWithoutMessage: CreateInvitationParams = {
        email: validParams.email,
        organizationId: validParams.organizationId,
        invitedBy: validParams.invitedBy,
        roleId: validParams.roleId,
      };

      const expectedInvitationWithoutMessage = {
        ...mockInvitationWithDetails,
        message: null,
      };

      // Mock: no existing membership
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue(null);

      // Mock: no existing pending invitation
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);

      // Mock: invitation creation
      vi.mocked(mockPrisma.invitation.create).mockResolvedValue(
        expectedInvitationWithoutMessage as any,
      );

      const result = await service.createInvitation(paramsWithoutMessage);

      expect(mockPrisma.invitation.create).toHaveBeenCalledWith({
        data: {
          email: "test@example.com",
          organizationId: "org-123",
          invitedBy: "user-456",
          roleId: "role-789",
          token:
            "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
          expiresAt: expect.any(Date),
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(result).toEqual(expectedInvitationWithoutMessage);
    });

    it("should throw error if user is already a member", async () => {
      // Mock: existing membership found
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue({
        id: "membership-123",
        userId: "user-789",
        organizationId: "org-123",
        roleId: "role-456",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.createInvitation(validParams)).rejects.toThrow(
        "User is already a member of this organization",
      );

      expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
    });

    it("should throw error if pending invitation already exists", async () => {
      // Mock: no existing membership
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue(null);

      // Mock: existing pending invitation
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue({
        id: "existing-invitation",
        email: "test@example.com",
        organizationId: "org-123",
        invitedBy: "user-456",
        roleId: "role-789",
        token: "existing-token",
        status: "PENDING",
        message: null,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.createInvitation(validParams)).rejects.toThrow(
        "There is already a pending invitation for this email",
      );

      expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
    });

    it("should generate secure token using crypto.randomBytes", async () => {
      // Mock: no existing membership or invitation
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.invitation.create).mockResolvedValue(
        mockInvitationWithDetails as any,
      );

      await service.createInvitation(validParams);

      expect(mockRandomBytesImpl).toHaveBeenCalledWith(32);
    });

    it("should set expiry date to 7 days from now", async () => {
      const fixedNow = new Date("2024-01-31T00:00:00.000Z");

      vi.setSystemTime(fixedNow);

      // Mock: no existing membership or invitation
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.invitation.create).mockResolvedValue(
        mockInvitationWithDetails as any,
      );

      await service.createInvitation(validParams);

      expect(mockAddDaysImpl).toHaveBeenCalledWith(fixedNow, 7);

      vi.useRealTimers();
    });

    it("should continue if email sending fails", async () => {
      // Mock: no existing membership or invitation
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.invitation.create).mockResolvedValue(
        mockInvitationWithDetails as any,
      );

      // Mock: email sending failure
      mockResendSend.mockRejectedValue(new Error("Email service unavailable"));

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {
          // Mock implementation for console.error
        });

      const result = await service.createInvitation(validParams);

      expect(result).toEqual(mockInvitationWithDetails);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to send invitation email:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("validateInvitation", () => {
    const validToken = "valid-token-123";
    const validEmail = "test@example.com";

    const mockValidInvitation: InvitationWithDetails = {
      id: "invitation-123",
      email: validEmail,
      organizationId: "org-123",
      invitedBy: "user-456",
      roleId: "role-789",
      token: validToken,
      status: "PENDING",
      message: "Welcome!",
      expiresAt: new Date("2024-12-31T23:59:59.000Z"), // Future date
      createdAt: new Date("2024-01-31T00:00:00.000Z"),
      updatedAt: new Date("2024-01-31T00:00:00.000Z"),
      organization: {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test-org",
      },
      inviter: {
        id: "user-456",
        name: "John Doe",
        email: "john@example.com",
      },
      role: {
        id: "role-789",
        name: "Member",
      },
    };

    it("should return valid invitation when token and email match", async () => {
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(
        mockValidInvitation,
      );

      const result = await service.validateInvitation(validToken, validEmail);

      expect(mockPrisma.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          token: validToken,
          email: validEmail,
          status: "PENDING",
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(result).toEqual(mockValidInvitation);
    });

    it("should throw error if invitation not found", async () => {
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);

      await expect(
        service.validateInvitation("invalid-token", validEmail),
      ).rejects.toThrow("Invalid or expired invitation");
    });

    it("should throw error if invitation is expired", async () => {
      // Mock will return null due to expiresAt filter
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);

      await expect(
        service.validateInvitation(validToken, validEmail),
      ).rejects.toThrow("Invalid or expired invitation");
    });

    it("should throw error if invitation is not pending", async () => {
      // Mock will return null due to status filter
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);

      await expect(
        service.validateInvitation(validToken, validEmail),
      ).rejects.toThrow("Invalid or expired invitation");
    });
  });

  describe("acceptInvitation", () => {
    const validToken = "valid-token-123";
    const userEmail = "test@example.com";
    const userId = "user-123";

    const mockValidInvitation: InvitationWithDetails = {
      id: "invitation-123",
      email: userEmail,
      organizationId: "org-123",
      invitedBy: "user-456",
      roleId: "role-789",
      token: validToken,
      status: "PENDING",
      message: "Welcome!",
      expiresAt: new Date("2024-12-31T23:59:59.000Z"),
      createdAt: new Date("2024-01-31T00:00:00.000Z"),
      updatedAt: new Date("2024-01-31T00:00:00.000Z"),
      organization: {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test-org",
      },
      inviter: {
        id: "user-456",
        name: "John Doe",
        email: "john@example.com",
      },
      role: {
        id: "role-789",
        name: "Member",
      },
    };

    it("should accept invitation and create membership", async () => {
      // Mock validateInvitation (called internally)
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(
        mockValidInvitation,
      );

      // Mock: no existing membership
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue(null);

      // Mock successful transaction
      vi.mocked(mockPrisma.$transaction).mockImplementation(
        async (_operations: any) => {
          // For transaction array, just return an empty array
          return [];
        },
      );

      await service.acceptInvitation(validToken, userEmail, userId);

      // Verify transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
    });

    it("should mark invitation as accepted if user already has membership", async () => {
      // Mock validateInvitation
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(
        mockValidInvitation,
      );

      // Mock: existing membership found
      vi.mocked(mockPrisma.membership.findFirst).mockResolvedValue({
        id: "existing-membership",
        userId,
        organizationId: "org-123",
        roleId: "role-789",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock invitation update
      vi.mocked(mockPrisma.invitation.update).mockResolvedValue({
        ...mockValidInvitation,
        status: "ACCEPTED",
      } as any);

      await service.acceptInvitation(validToken, userEmail, userId);

      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "invitation-123" },
        data: { status: "ACCEPTED" },
      });

      // Should not create new membership or call transaction
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("should throw error if invitation validation fails", async () => {
      // Mock validateInvitation to throw
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);

      await expect(
        service.acceptInvitation("invalid-token", userEmail, userId),
      ).rejects.toThrow("Invalid or expired invitation");

      expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("revokeInvitation", () => {
    const invitationId = "invitation-123";
    const organizationId = "org-123";

    it("should revoke pending invitation successfully", async () => {
      // Mock successful updateMany
      vi.mocked(mockPrisma.invitation.updateMany).mockResolvedValue({
        count: 1,
      });

      await service.revokeInvitation(invitationId, organizationId);

      expect(mockPrisma.invitation.updateMany).toHaveBeenCalledWith({
        where: {
          id: invitationId,
          organizationId,
          status: "PENDING",
        },
        data: {
          status: "REVOKED",
        },
      });
    });

    it("should handle case where no invitation was updated", async () => {
      // Mock updateMany returning count: 0 (no rows affected)
      vi.mocked(mockPrisma.invitation.updateMany).mockResolvedValue({
        count: 0,
      });

      // Should not throw error - method is void and handles this gracefully
      await expect(
        service.revokeInvitation(invitationId, organizationId),
      ).resolves.toBeUndefined();
    });
  });

  describe("getOrganizationInvitations", () => {
    const organizationId = "org-123";

    const mockInvitations: InvitationWithDetails[] = [
      {
        id: "invitation-1",
        email: "user1@example.com",
        organizationId,
        invitedBy: "user-456",
        roleId: "role-789",
        token: "token-1",
        status: "PENDING",
        message: "Welcome user 1!",
        expiresAt: new Date("2024-12-31T23:59:59.000Z"),
        createdAt: new Date("2024-01-31T00:00:00.000Z"),
        updatedAt: new Date("2024-01-31T00:00:00.000Z"),
        organization: {
          id: organizationId,
          name: "Test Organization",
          subdomain: "test-org",
        },
        inviter: {
          id: "user-456",
          name: "John Doe",
          email: "john@example.com",
        },
        role: {
          id: "role-789",
          name: "Member",
        },
      },
      {
        id: "invitation-2",
        email: "user2@example.com",
        organizationId,
        invitedBy: "user-456",
        roleId: "role-admin",
        token: "token-2",
        status: "ACCEPTED",
        message: null,
        expiresAt: new Date("2024-12-31T23:59:59.000Z"),
        createdAt: new Date("2024-01-30T00:00:00.000Z"),
        updatedAt: new Date("2024-02-01T00:00:00.000Z"),
        organization: {
          id: organizationId,
          name: "Test Organization",
          subdomain: "test-org",
        },
        inviter: {
          id: "user-456",
          name: "John Doe",
          email: "john@example.com",
        },
        role: {
          id: "role-admin",
          name: "Admin",
        },
      },
    ];

    it("should return all invitations for organization", async () => {
      vi.mocked(mockPrisma.invitation.findMany).mockResolvedValue(
        mockInvitations,
      );

      const result = await service.getOrganizationInvitations(organizationId);

      expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      expect(result).toEqual(mockInvitations);
    });

    it("should return empty array if no invitations found", async () => {
      vi.mocked(mockPrisma.invitation.findMany).mockResolvedValue([]);

      const result = await service.getOrganizationInvitations(organizationId);

      expect(result).toEqual([]);
    });
  });

  describe("checkPendingInvitation", () => {
    const email = "test@example.com";

    const mockPendingInvitation: InvitationWithDetails = {
      id: "invitation-123",
      email,
      organizationId: "org-123",
      invitedBy: "user-456",
      roleId: "role-789",
      token: "token-123",
      status: "PENDING",
      message: "Welcome!",
      expiresAt: new Date("2024-12-31T23:59:59.000Z"),
      createdAt: new Date("2024-01-31T00:00:00.000Z"),
      updatedAt: new Date("2024-01-31T00:00:00.000Z"),
      organization: {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test-org",
      },
      inviter: {
        id: "user-456",
        name: "John Doe",
        email: "john@example.com",
      },
      role: {
        id: "role-789",
        name: "Member",
      },
    };

    it("should return pending invitation if found", async () => {
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(
        mockPendingInvitation,
      );

      const result = await service.checkPendingInvitation(email);

      expect(mockPrisma.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          email,
          status: "PENDING",
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(result).toEqual(mockPendingInvitation);
    });

    it("should return null if no pending invitation found", async () => {
      vi.mocked(mockPrisma.invitation.findFirst).mockResolvedValue(null);

      const result = await service.checkPendingInvitation(email);

      expect(result).toBeNull();
    });
  });
});
