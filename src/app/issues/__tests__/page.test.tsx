import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SessionProvider } from "next-auth/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { IssueDetailView } from "~/components/issues/IssueDetailView";
import { type IssueWithDetails } from "~/types/issue";

// Mock the tRPC query hook directly to avoid HTTP calls
const { mockGetByIdQuery } = vi.hoisted(() => ({
  mockGetByIdQuery: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    issue: {
      core: {
        getById: {
          useQuery: mockGetByIdQuery,
        },
      },
    },
  },
}));

// Mock the permissions hook
const { mockUsePermissions } = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
}));

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: mockUsePermissions,
}));

// Mock Next.js navigation
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

// Mock MUI components
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

// Mock all the child components to simplify testing
vi.mock("~/components/issues/IssueDetail", () => ({
  IssueDetail: ({ issue }: { issue: IssueWithDetails }) => (
    <div data-testid="issue-detail">
      <h1 data-testid="issue-title">{issue.title}</h1>
      <div data-testid="issue-description">{issue.description}</div>
      <div data-testid="issue-status">{issue.status.name}</div>
      <div data-testid="machine-info">{issue.machine.model.name}</div>
      <div data-testid="issue-assignee">Assignee Section</div>
      <div data-testid="mock-issue-created-by">{issue.createdBy.name}</div>
    </div>
  ),
}));

vi.mock("~/components/issues/IssueComments", () => ({
  IssueComments: ({ issue }: { issue: IssueWithDetails }) => (
    <div data-testid="issue-comments">
      <div data-testid="public-comments">Comments Section</div>
      {issue.comments.map((comment) => (
        <div key={comment.id} data-testid={`comment-${comment.id}`}>
          {comment.content}
          {comment.content.includes("Internal") && (
            <div data-testid="internal-comment-badge">Internal</div>
          )}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("~/components/issues/IssueTimeline", () => ({
  IssueTimeline: () => <div data-testid="issue-timeline">Timeline</div>,
}));

vi.mock("~/components/issues/IssueStatusControl", () => ({
  IssueStatusControl: () => (
    <div>
      <div data-testid="status-dropdown">Status Control</div>
    </div>
  ),
}));

vi.mock("~/components/issues/IssueActions", () => ({
  IssueActions: ({
    hasPermission,
  }: {
    hasPermission: (permission: string) => boolean;
  }) => (
    <div>
      {hasPermission("issues:edit") ? (
        <button data-testid="edit-issue-button">Edit</button>
      ) : (
        <button
          data-testid="disabled-edit-button"
          disabled
          title="You need edit permissions to modify this issue"
        >
          Edit
        </button>
      )}

      {hasPermission("issues:assign") ? (
        <button data-testid="assign-user-button">Assign</button>
      ) : (
        <button
          data-testid="disabled-assign-button"
          disabled
          title="You need assign permissions to assign this issue"
        >
          Assign
        </button>
      )}

      {hasPermission("issues:close") && (
        <button data-testid="close-issue-button">Close</button>
      )}
    </div>
  ),
}));

const mockIssueData: IssueWithDetails = {
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

// Simple wrapper component for tests
function TestWrapper({
  children,
  session = mockSession,
}: {
  children: React.ReactNode;
  session?: any;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

describe("IssueDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful query response
    mockGetByIdQuery.mockReturnValue({
      data: mockIssueData,
      error: null,
      refetch: vi.fn(),
    });
    // Default permissions
    mockUsePermissions.mockReturnValue({
      hasPermission: vi.fn(() => false),
      isAuthenticated: true,
    });
  });

  describe("Public User View", () => {
    it("should display issue details for unauthenticated users", async () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        isAuthenticated: false,
      });

      render(
        <TestWrapper session={null}>
          <IssueDetailView
            issue={mockIssueData}
            session={null}
            issueId="test-issue-1"
          />
        </TestWrapper>,
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
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        isAuthenticated: false,
      });

      render(
        <TestWrapper session={null}>
          <IssueDetailView
            issue={mockIssueData}
            session={null}
            issueId="test-issue-1"
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId("issue-timeline")).not.toBeInTheDocument();
      });
    });
  });

  describe("Authenticated User View", () => {
    it("should display full issue details for authenticated users", async () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        isAuthenticated: true,
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
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
  });

  describe("Permission-based Controls", () => {
    it("should show edit controls for users with edit permissions", async () => {
      const mockHasPermission = vi.fn(
        (permission: string) => permission === "issues:edit",
      );
      mockUsePermissions.mockReturnValue({
        hasPermission: mockHasPermission,
        isAuthenticated: true,
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("edit-issue-button")).toBeInTheDocument();
      });
    });

    it("should show assign controls for users with assign permissions", async () => {
      const mockHasPermission = vi.fn(
        (permission: string) => permission === "issues:assign",
      );
      mockUsePermissions.mockReturnValue({
        hasPermission: mockHasPermission,
        isAuthenticated: true,
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("assign-user-button")).toBeInTheDocument();
      });
    });

    it("should show close controls for users with close permissions", async () => {
      const mockHasPermission = vi.fn(
        (permission: string) => permission === "issues:close",
      );
      mockUsePermissions.mockReturnValue({
        hasPermission: mockHasPermission,
        isAuthenticated: true,
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("close-issue-button")).toBeInTheDocument();
      });
    });

    it("should show permission tooltips on disabled buttons", async () => {
      const mockHasPermission = vi.fn(() => false);
      mockUsePermissions.mockReturnValue({
        hasPermission: mockHasPermission,
        isAuthenticated: true,
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
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

  describe("Error States", () => {
    it("should show 404 error for non-existent issues", async () => {
      mockGetByIdQuery.mockReturnValue({
        data: null,
        error: new Error("not found"),
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("issue-not-found")).toBeInTheDocument();
        expect(screen.getByText("Issue not found")).toBeInTheDocument();
      });
    });

    it("should show permission denied error for unauthorized access", async () => {
      mockGetByIdQuery.mockReturnValue({
        data: null,
        error: new Error("UNAUTHORIZED"),
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("permission-denied")).toBeInTheDocument();
        expect(
          screen.getByText("You do not have permission to view this issue"),
        ).toBeInTheDocument();
      });
    });

    it("should show network error for failed requests", async () => {
      mockGetByIdQuery.mockReturnValue({
        data: null,
        error: new Error("Network error"),
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
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

  describe("Responsive Design", () => {
    it("should show desktop layout by default", async () => {
      render(
        <TestWrapper>
          <IssueDetailView
            issue={mockIssueData}
            session={mockSession}
            issueId="test-issue-1"
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("desktop-layout")).toBeInTheDocument();
        expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
      });
    });
  });
});
