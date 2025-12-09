import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeedbackWidget } from "~/components/feedback/FeedbackWidget";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry
vi.mock("@sentry/nextjs", () => {
  return {
    getFeedback: vi.fn(),
  };
});

// Mock UI components
vi.mock("~/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  MessageSquare: () => <span>Icon</span>,
  Bug: () => <span>BugIcon</span>,
  Lightbulb: () => <span>FeatureIcon</span>,
}));

// Mock Dropdown components
vi.mock("~/components/ui/dropdown-menu", () => {
  return {
    DropdownMenu: ({ children }: any) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, asChild }: any) => (
      <div>{asChild ? children : <button>{children}</button>}</div>
    ),
    DropdownMenuContent: ({ children }: any) => (
      <div data-testid="dropdown-content">{children}</div>
    ),
    DropdownMenuItem: ({ children, onSelect }: any) => (
      <div onClick={onSelect} data-testid="dropdown-item">
        {children}
      </div>
    ),
  };
});

describe("FeedbackWidget", () => {
  let mockCreateForm: any;
  let mockOpenDialog: any;
  let mockOpen: any;
  let mockFeedbackWidget: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateForm = vi.fn().mockResolvedValue({
      open: vi.fn(),
      appendToDom: vi.fn(),
    });
    mockOpenDialog = vi.fn();
    mockOpen = vi.fn();

    mockFeedbackWidget = {
      createForm: mockCreateForm,
      openDialog: mockOpenDialog,
      open: mockOpen,
    };

    vi.mocked(Sentry.getFeedback).mockReturnValue(mockFeedbackWidget);
  });

  it("calls createForm with correct title and button label for Feature Request", async () => {
    render(<FeedbackWidget />);

    // Simulate clicking the feature request item
    const items = screen.getAllByTestId("dropdown-item");
    const featureItem = items.find((item) =>
      item.textContent.includes("Request a Feature")
    );

    if (featureItem) {
      fireEvent.click(featureItem);
    }

    // Since calling createForm is wrapped in setTimeout
    await waitFor(() => {
      expect(mockCreateForm).toHaveBeenCalledWith(
        expect.objectContaining({
          formTitle: "Request a Feature",
          submitButtonLabel: "Send Feature Request",
        })
      );
    });
  });

  it("calls createForm with correct title and button label for Bug Report", async () => {
    render(<FeedbackWidget />);

    // Simulate clicking the bug report item
    const items = screen.getAllByTestId("dropdown-item");
    const bugItem = items.find((item) =>
      item.textContent.includes("Report a Bug")
    );

    if (bugItem) {
      fireEvent.click(bugItem);
    }

    await waitFor(() => {
      expect(mockCreateForm).toHaveBeenCalledWith(
        expect.objectContaining({
          formTitle: "Report a Bug",
          submitButtonLabel: "Send Bug Report",
        })
      );
    });
  });
});
