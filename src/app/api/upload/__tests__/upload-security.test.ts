/**
 * @jest-environment node
 */
import { type NextRequest } from "next/server";
import { type Session } from "next-auth";

// Mock the dependencies BEFORE importing
const mockAuth = jest.fn();
const mockOrganizationFindUnique = jest.fn();
const mockMembershipFindFirst = jest.fn();
const mockIssueFindUnique = jest.fn();
const mockAttachmentCount = jest.fn();
const mockAttachmentCreate = jest.fn();
const mockValidateIssueAttachment = jest.fn();
const mockUploadImage = jest.fn();

jest.mock("~/server/auth", () => ({
  auth: mockAuth,
}));

// Mock database provider
const mockDb = {
  organization: {
    findUnique: mockOrganizationFindUnique,
  },
  membership: {
    findFirst: mockMembershipFindFirst,
  },
  issue: {
    findUnique: mockIssueFindUnique,
  },
  attachment: {
    count: mockAttachmentCount,
    create: mockAttachmentCreate,
  },
};

jest.mock("~/server/db/provider", () => ({
  getGlobalDatabaseProvider: jest.fn().mockReturnValue({
    getClient: jest.fn().mockReturnValue(mockDb),
    disconnect: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("~/lib/image-storage/local-storage", () => ({
  imageStorage: {
    validateIssueAttachment: mockValidateIssueAttachment,
    uploadImage: mockUploadImage,
  },
}));

jest.mock("~/env", () => ({
  env: {
    DEFAULT_ORG_SUBDOMAIN: "test-default-org",
  },
}));

// Import after mocking
import { POST } from "../issue/route";

// Mock NextRequest for testing
function createMockRequest(
  url: string,
  init?: { method?: string; body?: FormData; headers?: Record<string, string> },
) {
  const headersMap = new Map(Object.entries(init?.headers ?? {}));
  return {
    method: init?.method ?? "GET",
    headers: {
      get: (name: string) => headersMap.get(name) ?? null,
    },
    formData: (): Promise<FormData> => Promise.resolve(init?.body ?? new FormData()),
  } as unknown as NextRequest;
}

describe("Upload Security Tests", () => {
  const mockUserSession: Session = {
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    },
    expires: "2024-12-31",
  };

  const mockOrganization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  };

  const mockMembership = {
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    roleId: "role-1",
    role: {
      id: "role-1",
      name: "member",
      permissions: [{ name: "issue:create" }, { name: "attachment:create" }],
    },
  };

  const mockIssue = {
    id: "issue-1",
    organizationId: "org-1",
  };

  const mockFormData = new FormData();
  mockFormData.append(
    "file",
    new File(["test"], "test.jpg", { type: "image/jpeg" }),
  );
  mockFormData.append("issueId", "issue-1");

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful mocks
    mockAuth.mockResolvedValue(mockUserSession);
    mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
    mockMembershipFindFirst.mockResolvedValue(mockMembership);
    mockIssueFindUnique.mockResolvedValue(mockIssue);
    mockAttachmentCount.mockResolvedValue(0);
    mockValidateIssueAttachment.mockResolvedValue(true);
    mockUploadImage.mockResolvedValue("/uploads/test.jpg");
    mockAttachmentCreate.mockResolvedValue({
      id: "attachment-1",
      url: "/uploads/test.jpg",
    });
  });

  describe("Authentication Tests", () => {
    it("should reject unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Authentication required");
    });

    it("should reject users without session", async () => {
      mockAuth.mockResolvedValue({ user: null, expires: "2024-12-31" });

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Authentication required");
    });
  });

  describe("Organization Context Tests", () => {
    it("should reject when organization not found", async () => {
      mockOrganizationFindUnique.mockResolvedValue(null);

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "nonexistent" },
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe(
        'Organization with subdomain "nonexistent" not found',
      );
    });

    it("should use default subdomain when header missing", async () => {
      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
      });

      await POST(request);

      expect(mockOrganizationFindUnique).toHaveBeenCalledWith({
        where: { subdomain: "test-default-org" },
      });
    });
  });

  describe("IDOR Vulnerability Tests", () => {
    it("should reject users who are not members of the organization", async () => {
      mockMembershipFindFirst.mockResolvedValue(null);

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "test" },
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("User is not a member of this organization");
    });

    it("should reject access to issues from other organizations", async () => {
      // User is member of org-1, but issue belongs to org-2
      mockIssueFindUnique.mockResolvedValue(null);

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "test" },
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Issue not found");
    });

    it("should validate issue belongs to user's organization", async () => {
      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "test" },
      });

      await POST(request);

      expect(mockIssueFindUnique).toHaveBeenCalledWith({
        where: { id: "issue-1" },
        select: {
          id: true,
          organizationId: true,
          machine: {
            select: {
              id: true,
              model: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    });
  });

  describe("Cross-Organization Attack Scenarios", () => {
    it("should prevent user from org A uploading to issue from org B", async () => {
      // Simulate user from org-1 trying to access issue from org-2
      const orgAUser: Session = {
        user: {
          id: "user-orgA",
          email: "userA@example.com",
          name: "User A",
        },
        expires: "2024-12-31",
      };

      const orgA = {
        id: "org-A",
        name: "Organization A",
        subdomain: "org-a",
      };

      const membershipA = {
        id: "membership-A",
        userId: "user-orgA",
        organizationId: "org-A",
        roleId: "role-A",
        role: {
          id: "role-A",
          name: "member",
          permissions: [
            { name: "issue:create" },
            { name: "attachment:create" },
          ],
        },
      };

      // Issue belongs to org-B, but user is from org-A
      mockAuth.mockResolvedValue(orgAUser);
      mockOrganizationFindUnique.mockResolvedValue(orgA);
      mockMembershipFindFirst.mockResolvedValue(membershipA);
      mockIssueFindUnique.mockResolvedValue(null); // Issue not found in org-A

      const formData = new FormData();
      formData.append(
        "file",
        new File(["test"], "test.jpg", { type: "image/jpeg" }),
      );
      formData.append("issueId", "issue-from-org-B");

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: formData,
        headers: { "x-subdomain": "org-a" },
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Issue not found");
    });

    it("should allow valid uploads within same organization", async () => {
      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "test" },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.attachment).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing file", async () => {
      const formData = new FormData();
      formData.append("issueId", "issue-1");

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: formData,
        headers: { "x-subdomain": "test" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("No file provided");
    });

    it("should handle missing issueId", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new File(["test"], "test.jpg", { type: "image/jpeg" }),
      );

      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: formData,
        headers: { "x-subdomain": "test" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Issue ID required");
    });
  });

  describe("Database Query Security", () => {
    it("should query membership with correct organization and user", async () => {
      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "test" },
      });

      await POST(request);

      expect(mockMembershipFindFirst).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          userId: "user-1",
        },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      });
    });

    it("should query issue with organization scoping", async () => {
      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "test" },
      });

      await POST(request);

      expect(mockIssueFindUnique).toHaveBeenCalledWith({
        where: { id: "issue-1" },
        select: {
          id: true,
          organizationId: true,
          machine: {
            select: {
              id: true,
              model: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    it("should create attachment with correct organizationId", async () => {
      const request = createMockRequest("http://localhost/api/upload/issue", {
        method: "POST",
        body: mockFormData,
        headers: { "x-subdomain": "test" },
      });

      await POST(request);

      expect(mockAttachmentCreate).toHaveBeenCalledWith({
        data: {
          url: "/uploads/test.jpg",
          fileName: "test.jpg",
          fileType: "image/jpeg",
          issueId: "issue-1",
          organizationId: "org-1",
        },
      });
    });
  });
});
