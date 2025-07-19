/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";

import IssuePage from "../[issueId]/page";

import { TRPCProvider } from "~/app/_trpc/Provider";
import { createMockTRPCClient } from "~/test/mockTRPCClient";
import { type IssueWithDetails } from "~/types/issue";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useParams: jest.fn(() => ({
    issueId: "test-issue-1",
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
  })),
  notFound: jest.fn(),
}));

// Mock MUI components to avoid complex rendering
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  Skeleton: ({ children, ...props }: { children?: React.ReactNode }) => (
    <div data-testid="skeleton" {...props}>
      {children}
    </div>
  ),
}));

const mockIssueData = {
  id: "test-issue-1",
  title: "Test Issue Title",
  description: "Test issue description",
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
      content: "Public comment",
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

const mockSession = {
  user: {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

describe("IssuePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Public User View", () => {
    it("should display issue details for unauthenticated users", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      render(
        <SessionProvider session={null}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("issue-title")).toHaveTextContent(
          "Test Issue Title",
        );
        expect(screen.getByTestId("issue-description")).toHaveTextContent(
          "Test issue description",
        );
        expect(screen.getByTestId("issue-status")).toHaveTextContent("Open");
        expect(screen.getByTestId("machine-info")).toHaveTextContent(
          "Test Game",
        );
        expect(screen.getByTestId("public-comments")).toBeInTheDocument();
      });
    });

    it("should hide admin controls for unauthenticated users", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      render(
        <SessionProvider session={null}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(
          screen.queryByTestId("edit-issue-button"),
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId("status-dropdown")).not.toBeInTheDocument();
        expect(
          screen.queryByTestId("assign-user-button"),
        ).not.toBeInTheDocument();
      });
    });

    it("should show only public comments for unauthenticated users", async () => {
      const issueWithMixedComments = {
        ...mockIssueData,
        comments: [
          {
            id: "comment-1",
            content: "Public comment",
            isInternal: false,
            createdBy: { id: "user-1", name: "Test User" },
            createdAt: new Date("2024-01-01T00:00:00Z"),
          },
          {
            id: "comment-2",
            content: "Internal comment",
            isInternal: true,
            createdBy: { id: "user-1", name: "Test User" },
            createdAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
      };

      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(issueWithMixedComments),
          },
        },
      });

      render(
        <SessionProvider session={null}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Public comment")).toBeInTheDocument();
        expect(screen.queryByText("Internal comment")).not.toBeInTheDocument();
      });
    });
  });

  describe("Authenticated User View", () => {
    it("should display full issue details for authenticated users", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("issue-title")).toHaveTextContent(
          "Test Issue Title",
        );
        expect(screen.getByTestId("issue-assignee")).toBeInTheDocument();
        expect(screen.getByTestId("issue-created-by")).toHaveTextContent(
          "Test User",
        );
        expect(screen.getByTestId("issue-timeline")).toBeInTheDocument();
      });
    });

    it("should show all comments for authenticated users", async () => {
      const issueWithMixedComments = {
        ...mockIssueData,
        comments: [
          {
            id: "comment-1",
            content: "Public comment",
            isInternal: false,
            createdBy: { id: "user-1", name: "Test User" },
            createdAt: new Date("2024-01-01T00:00:00Z"),
          },
          {
            id: "comment-2",
            content: "Internal comment",
            isInternal: true,
            createdBy: { id: "user-1", name: "Test User" },
            createdAt: new Date("2024-01-01T00:00:00Z"),
          },
        ],
      };

      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(issueWithMixedComments),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Public comment")).toBeInTheDocument();
        expect(screen.getByText("Internal comment")).toBeInTheDocument();
        expect(
          screen.getByTestId("internal-comment-badge"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Permission-based Controls", () => {
    it("should show edit controls for users with edit permissions", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      const sessionWithEditPermission = {
        ...mockSession,
        user: {
          ...mockSession.user,
          permissions: ["issues:edit"],
        },
      };

      render(
        <SessionProvider session={sessionWithEditPermission}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("edit-issue-button")).toBeInTheDocument();
        expect(screen.getByTestId("status-dropdown")).toBeInTheDocument();
      });
    });

    it("should show assign controls for users with assign permissions", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      const sessionWithAssignPermission = {
        ...mockSession,
        user: {
          ...mockSession.user,
          permissions: ["issues:assign"],
        },
      };

      render(
        <SessionProvider session={sessionWithAssignPermission}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("assign-user-button")).toBeInTheDocument();
      });
    });

    it("should show close controls for users with close permissions", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      const sessionWithClosePermission = {
        ...mockSession,
        user: {
          ...mockSession.user,
          permissions: ["issues:close"],
        },
      };

      render(
        <SessionProvider session={sessionWithClosePermission}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("close-issue-button")).toBeInTheDocument();
      });
    });

    it("should show permission tooltips on disabled buttons", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      const sessionWithoutPermissions = {
        ...mockSession,
        user: {
          ...mockSession.user,
          permissions: [],
        },
      };

      render(
        <SessionProvider session={sessionWithoutPermissions}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("disabled-edit-button")).toHaveAttribute(
          "title",
          "You need edit permissions to modify this issue",
        );
        expect(screen.getByTestId("disabled-assign-button")).toHaveAttribute(
          "title",
          "You need assign permissions to assign this issue",
        );
      });
    });
  });

  describe("Loading States", () => {
    it("should show skeleton loader while fetching issue data", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockImplementation(
                () =>
                  new Promise(() => {
                    /* Never resolves */
                  }),
              ), // Never resolves
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      expect(screen.getByTestId("issue-skeleton")).toBeInTheDocument();
      expect(screen.getByTestId("comments-skeleton")).toBeInTheDocument();
      expect(screen.getByTestId("timeline-skeleton")).toBeInTheDocument();
    });

    it("should show loading states for individual actions", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
            updateStatus: jest
              .fn<
                Promise<IssueWithDetails>,
                [{ id: string; statusId: string }]
              >()
              .mockImplementation(
                () =>
                  new Promise(() => {
                    /* Never resolves */
                  }),
              ), // Never resolves
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("issue-title")).toBeInTheDocument();
      });

      // Simulate status change
      const statusDropdown = screen.getByTestId("status-dropdown");
      statusDropdown.click();

      await waitFor(() => {
        expect(screen.getByTestId("status-loading")).toBeInTheDocument();
      });
    });
  });

  describe("Error States", () => {
    it("should show 404 error for non-existent issues", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockRejectedValue(new Error("Issue not found")),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("issue-not-found")).toBeInTheDocument();
        expect(screen.getByText("Issue not found")).toBeInTheDocument();
      });
    });

    it("should show permission denied error for unauthorized access", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockRejectedValue(new Error("UNAUTHORIZED")),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("permission-denied")).toBeInTheDocument();
        expect(
          screen.getByText("You do not have permission to view this issue"),
        ).toBeInTheDocument();
      });
    });

    it("should show network error for failed requests", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockRejectedValue(new Error("Network error")),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("network-error")).toBeInTheDocument();
        expect(
          screen.getByText("Failed to load issue. Please try again."),
        ).toBeInTheDocument();
        expect(screen.getByTestId("retry-button")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByRole("main")).toHaveAttribute(
          "aria-label",
          "Issue details",
        );
        expect(
          screen.getByRole("heading", { name: "Test Issue Title" }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("region", { name: "Issue comments" }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("region", { name: "Issue timeline" }),
        ).toBeInTheDocument();
      });
    });

    it("should support keyboard navigation", async () => {
      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        const editButton = screen.getByTestId("edit-issue-button");
        expect(editButton).toHaveAttribute("tabIndex", "0");

        const statusDropdown = screen.getByTestId("status-dropdown");
        expect(statusDropdown).toHaveAttribute("tabIndex", "0");
      });
    });
  });

  describe("Responsive Design", () => {
    it("should adapt layout for mobile screens", async () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("mobile-layout")).toBeInTheDocument();
        expect(screen.getByTestId("mobile-actions-menu")).toBeInTheDocument();
      });
    });

    it("should show desktop layout on larger screens", async () => {
      // Mock window.innerWidth for desktop
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const mockTRPCClient = createMockTRPCClient({
        issue: {
          core: {
            getById: jest
              .fn<Promise<IssueWithDetails>, [{ id: string }]>()
              .mockResolvedValue(mockIssueData),
          },
        },
      });

      render(
        <SessionProvider session={mockSession}>
          <TRPCProvider>
            <IssuePage params={{ issueId: "test-issue-1" }} />
          </TRPCProvider>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("desktop-layout")).toBeInTheDocument();
        expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
      });
    });
  });
});
