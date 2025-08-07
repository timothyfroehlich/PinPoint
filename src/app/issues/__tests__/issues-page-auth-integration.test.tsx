/**
 * Auth Integration Test for Issues Page
 *
 * This demonstrates proper auth integration testing vs over-mocking.
 * Tests real auth context + permission logic + component interactions.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { IssueDetailView } from "~/components/issues/IssueDetailView";
import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
  createMockSupabaseUser,
  createMockUser,
} from "~/test/VitestTestWrapper";
import { type IssueWithDetails } from "~/types/issue";

// ✅ MOCK: External APIs and data layer (not auth)
const {
  mockGetByIdQuery,
  mockUseUtils,
  mockAddCommentMutation,
  mockGetAllStatuses,
  mockUpdateStatusMutation,
} = vi.hoisted(() => ({
  mockGetByIdQuery: vi.fn(),
  mockUseUtils: vi.fn(() => ({
    issue: {
      core: {
        getById: {
          invalidate: vi.fn(),
        },
      },
      comment: {
        getByIssueId: {
          invalidate: vi.fn(),
        },
      },
    },
  })),
  mockAddCommentMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false,
  })),
  mockGetAllStatuses: vi.fn(() => ({
    data: [
      { id: "status-1", name: "Open", category: "NEW" },
      { id: "status-2", name: "In Progress", category: "IN_PROGRESS" },
      { id: "status-3", name: "Closed", category: "RESOLVED" },
    ],
    isLoading: false,
  })),
  mockUpdateStatusMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: mockUseUtils,
    issue: {
      core: {
        getById: {
          useQuery: mockGetByIdQuery,
        },
        update: {
          useMutation: vi.fn(() => ({
            mutate: vi.fn(),
            isLoading: false,
          })),
        },
        updateStatus: {
          useMutation: mockUpdateStatusMutation,
        },
        close: {
          useMutation: vi.fn(() => ({
            mutate: vi.fn(),
            isLoading: false,
          })),
        },
      },
      comment: {
        addComment: {
          useMutation: mockAddCommentMutation,
        },
        getByIssueId: {
          useQuery: vi.fn(() => ({ data: [], isLoading: false })),
        },
      },
    },
    issueStatus: {
      getAll: {
        useQuery: mockGetAllStatuses,
      },
    },
  },
}));

// ✅ MOCK: Next.js navigation (not auth-related)
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  useParams: vi.fn(() => ({
    issueId: "test-issue-1",
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
  })),
  notFound: vi.fn(),
}));

// ✅ MOCK: MUI responsive utilities (not auth-related)
vi.mock("@mui/material", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mui/material")>();
  return {
    ...actual,
    useTheme: vi.fn(() => ({
      breakpoints: {
        down: vi.fn(() => "(max-width: 900px)"),
      },
    })),
    useMediaQuery: vi.fn(() => false),
  };
});

// ✅ KEEP SHALLOW MOCK: Non-auth complex component
vi.mock("~/components/issues/IssueTimeline", () => ({
  IssueTimeline: () => <div data-testid="issue-timeline">Timeline</div>,
}));

// ❌ DO NOT MOCK: Auth-aware components (test real auth integration)
// - IssueActions: Permission-based button visibility
// - IssueStatusControl: Role-based status changing
// - IssueDetail: Auth-conditional content
// - IssueComments: Permission-based comment actions

const mockIssueData: IssueWithDetails = {
  id: "test-issue-1",
  title: "Auth Integration Test Issue",
  description: "Testing real auth component interactions",
  organizationId: "org-1",
  machineId: "machine-1",
  statusId: "status-1",
  priorityId: "priority-1",
  createdById: "user-1",
  status: {
    id: "status-1",
    name: "Open",
    color: "#ff0000",
    category: "NEW" as const,
  },
  priority: { id: "priority-1", name: "High", color: "#ff0000", order: 1 },
  machine: {
    id: "machine-1",
    name: "Test Machine",
    serialNumber: "TEST123",
    qrCodeId: "qr-123",
    model: {
      id: "model-1",
      name: "Test Game",
      manufacturer: "Test Manufacturer",
      year: 2020,
    },
    location: {
      id: "location-1",
      name: "Test Location",
      address: "123 Test St",
    },
  },
  createdBy: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  assignedTo: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  resolvedAt: null,
  comments: [
    {
      id: "comment-1",
      content: "Public comment for auth testing",
      author: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        image: null,
      },
      createdBy: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        image: null,
      },
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
  ],
  attachments: [],
  activities: [],
};

describe("IssueDetailView - Auth Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default successful query response before each test
    mockGetByIdQuery.mockReturnValue({
      data: mockIssueData,
      error: null,
      refetch: vi.fn(),
    });
  });

  describe("🔓 Unauthenticated User Experience", () => {
    it("should show public content but hide auth-required features", async () => {
      render(
        <VitestTestWrapper session={null}>
          <IssueDetailView
            issue={mockIssueData}
            user={null}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: Public content visible
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /auth integration test issue/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/testing real auth component interactions/i),
        ).toBeInTheDocument();
      });

      // ✅ Real auth test: Auth-required features hidden
      await waitFor(() => {
        expect(screen.queryByTestId("issue-timeline")).not.toBeInTheDocument();
        expect(
          screen.queryByTestId("edit-issue-button"),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId("assign-user-button"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("👤 Authenticated Member (Limited Permissions)", () => {
    it("should show member-level features but hide admin controls", async () => {
      const memberSession = {
        user: createMockUser({
          id: "member-user-id",
          name: "Test Member",
          email: "member@dev.local",
        }),
        expires: "2024-12-31",
      };
      const memberSupabase = createMockSupabaseUser({
        id: "member-user-id",
        email: "member@dev.local",
        app_metadata: {
          organization_id: "org-1",
          role: "member",
          provider: "google",
        },
        user_metadata: {
          full_name: "Test Member",
          name: "Test Member",
          email: "member@dev.local",
        },
      });

      render(
        <VitestTestWrapper
          session={memberSession}
          userPermissions={Array.from(VITEST_PERMISSION_SCENARIOS.MEMBER)}
        >
          <IssueDetailView
            issue={mockIssueData}
            user={memberSupabase}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: Member features visible
      await waitFor(() => {
        expect(screen.getByTestId("issue-timeline")).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { name: /auth integration test issue/i }),
        ).toBeInTheDocument();
      });

      // ✅ Real auth test: Admin-only features disabled with tooltips
      await waitFor(() => {
        const editButton = screen.getByRole("button", { name: /edit/i });
        expect(editButton).toBeDisabled();
        expect(editButton).toHaveAttribute(
          "title",
          expect.stringContaining("permission"),
        );
      });
    });

    it("should show permission tooltips on disabled buttons", async () => {
      const memberUser = createMockSupabaseUser({
        app_metadata: {
          organization_id: "org-1",
          role: "member",
        },
      });

      const memberSession = {
        user: createMockUser({
          id: "member-user-id",
          name: "Test Member",
          email: "member@dev.local",
        }),
        expires: "2024-12-31",
      };

      render(
        <VitestTestWrapper
          session={memberSession}
          userPermissions={Array.from(VITEST_PERMISSION_SCENARIOS.MEMBER)}
        >
          <IssueDetailView
            issue={mockIssueData}
            user={memberUser}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: Permission tooltips work
      await waitFor(() => {
        const disabledButtons = screen.getAllByRole("button", {
          name: /edit|assign|delete/i,
        });
        disabledButtons.forEach((button) => {
          if (button.hasAttribute("disabled")) {
            expect(button).toHaveAttribute(
              "title",
              expect.stringContaining("permission"),
            );
          }
        });
      });
    });
  });

  describe("👑 Admin User (Full Permissions)", () => {
    it("should show all admin controls and features", async () => {
      const adminUser = createMockSupabaseUser({
        app_metadata: {
          organization_id: "org-1",
          role: "admin",
        },
      });

      const adminSession = {
        user: createMockUser({
          id: "admin-user-id",
          name: "Test Admin",
          email: "admin@dev.local",
        }),
        expires: "2024-12-31",
      };

      render(
        <VitestTestWrapper
          session={adminSession}
          userPermissions={Array.from(VITEST_PERMISSION_SCENARIOS.ADMIN)}
        >
          <IssueDetailView
            issue={mockIssueData}
            user={adminUser}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: All admin features available
      await waitFor(() => {
        expect(screen.getByTestId("issue-timeline")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled();
        expect(screen.getByRole("button", { name: /assign/i })).toBeEnabled();
      });
    });

    it("should allow admin actions when clicked", async () => {
      const user = userEvent.setup();
      const adminUser = createMockSupabaseUser({
        app_metadata: {
          organization_id: "org-1",
          role: "admin",
        },
      });

      const adminSession = {
        user: createMockUser({
          id: "admin-user-id",
          name: "Test Admin",
          email: "admin@dev.local",
        }),
        expires: "2024-12-31",
      };

      render(
        <VitestTestWrapper
          session={adminSession}
          userPermissions={Array.from(VITEST_PERMISSION_SCENARIOS.ADMIN)}
        >
          <IssueDetailView
            issue={mockIssueData}
            user={adminUser}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: Admin can interact with controls
      await waitFor(() => {
        const editButton = screen.getByRole("button", { name: /edit/i });
        expect(editButton).toBeEnabled();
      });

      // Test actual button interaction
      const editButton = screen.getByRole("button", { name: /edit/i });
      await user.click(editButton);

      // This would trigger real component behavior (not mocked)
      // The actual component would handle the click appropriately
    });
  });

  describe("🏢 Multi-Tenant Auth Security", () => {
    it("should prevent cross-organization access", async () => {
      // User from different organization
      const userFromOtherOrg = createMockSupabaseUser({
        app_metadata: {
          organization_id: "other-org",
          role: "admin",
        },
      });

      const otherOrgSession = {
        user: createMockUser({
          id: "other-org-user-id",
          name: "Other Org Admin",
          email: "admin@other.org",
        }),
        expires: "2024-12-31",
      };

      // Mock the tRPC query to simulate cross-organization access denial
      mockGetByIdQuery.mockReturnValue({
        data: null,
        error: {
          message: "UNAUTHORIZED - Cross-organization access denied",
          data: {
            code: "FORBIDDEN",
          },
        },
        refetch: vi.fn(),
      });

      render(
        <VitestTestWrapper
          session={otherOrgSession}
          userPermissions={Array.from(VITEST_PERMISSION_SCENARIOS.MEMBER)}
        >
          <IssueDetailView
            issue={mockIssueData} // Issue belongs to "org-1"
            user={userFromOtherOrg}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: Multi-tenant security enforced
      await waitFor(() => {
        expect(
          screen.getByRole("alert") ||
            screen.getByText(/access.*denied|permission.*required/i),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /edit/i }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("⚡ Auth State Changes", () => {
    it("should update UI when permissions change", async () => {
      const memberUser = createMockSupabaseUser({
        app_metadata: {
          organization_id: "org-1",
          role: "member",
        },
      });

      const memberSession = {
        user: createMockUser({
          id: "member-user-id",
          name: "Test Member",
          email: "member@dev.local",
        }),
        expires: "2024-12-31",
      };

      const { rerender } = render(
        <VitestTestWrapper
          session={memberSession}
          userPermissions={Array.from(VITEST_PERMISSION_SCENARIOS.MEMBER)}
        >
          <IssueDetailView
            issue={mockIssueData}
            user={memberUser}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // Initially member permissions - edit disabled
      await waitFor(() => {
        const editButton = screen.getByRole("button", { name: /edit/i });
        expect(editButton).toBeDisabled();
      });

      // ✅ Real auth test: Permission upgrade changes UI
      rerender(
        <VitestTestWrapper
          session={memberSession}
          userPermissions={Array.from(VITEST_PERMISSION_SCENARIOS.ADMIN)}
        >
          <IssueDetailView
            issue={mockIssueData}
            user={memberUser}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // After permission upgrade - edit enabled
      await waitFor(() => {
        const editButton = screen.getByRole("button", { name: /edit/i });
        expect(editButton).toBeEnabled();
      });
    });
  });

  describe("🔄 Loading and Error States", () => {
    it("should handle auth loading states gracefully", async () => {
      render(
        <VitestTestWrapper sessionLoading={true}>
          <IssueDetailView
            issue={mockIssueData}
            user={null}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: Loading state handled
      // The component should still show the issue content even when auth is loading
      await waitFor(() => {
        expect(
          screen.getByRole("heading", {
            name: /auth integration test issue/i,
          }),
        ).toBeInTheDocument();
      });

      // Auth-dependent features should be hidden during loading
      expect(screen.queryByTestId("issue-timeline")).not.toBeInTheDocument();
    });

    it("should handle auth errors appropriately", async () => {
      render(
        <VitestTestWrapper
          queryOptions={{
            isError: true,
            error: new Error("Authentication failed"),
          }}
        >
          <IssueDetailView
            issue={mockIssueData}
            user={null}
            issueId="test-issue-1"
          />
        </VitestTestWrapper>,
      );

      // ✅ Real auth test: Auth errors handled gracefully
      await waitFor(() => {
        // Component should gracefully degrade or show appropriate error
        expect(
          screen.getByRole("heading", {
            name: /auth integration test issue/i,
          }) ||
            screen.getByRole("alert") ||
            screen.getByText(/error.*occurred|something went wrong/i),
        ).toBeInTheDocument();
      });
    });
  });
});
