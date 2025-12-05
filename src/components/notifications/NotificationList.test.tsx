import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationList } from "./NotificationList";
import {
  markAsReadAction,
  markAllAsReadAction,
} from "~/app/(app)/notifications/actions";

// Mock server actions
vi.mock("~/app/(app)/notifications/actions", () => ({
  markAsReadAction: vi.fn(),
  markAllAsReadAction: vi.fn(),
}));

// Mock useRouter
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

describe("NotificationList", () => {
  const mockNotifications = [
    {
      id: "1",
      type: "issue_assigned" as const,
      resourceId: "issue-1",
      resourceType: "issue" as const,
      readAt: null,
      createdAt: new Date(),
      link: "/m/MM/i/1", // Add link
      machineInitials: "MM",
      issueNumber: 1,
    },
    // Read notifications are removed from DB, so we don't pass them
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display unread count badge", () => {
    render(<NotificationList notifications={mockNotifications} />);

    // Should show badge with "1"
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should display notifications in dropdown", async () => {
    const user = userEvent.setup();
    render(<NotificationList notifications={mockNotifications} />);

    // Open dropdown
    const trigger = screen.getByRole("button", { name: /notifications/i });
    await user.click(trigger);

    // Check content
    expect(await screen.findByText("Assigned to MM-1")).toBeInTheDocument();
    expect(await screen.findByText("less than a minute ago")).toBeInTheDocument();
  });

  it("should call markAsReadAction when dismiss is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationList notifications={mockNotifications} />);

    // Open dropdown
    const trigger = screen.getByRole("button", { name: /notifications/i });
    await user.click(trigger);

    // Find dismiss button for unread notification
    const dismissButtons = await screen.findAllByRole("button", {
      name: /dismiss/i,
    });
    expect(dismissButtons).toHaveLength(1);

    await user.click(dismissButtons[0]);

    await waitFor(() => {
      expect(markAsReadAction).toHaveBeenCalledWith("1");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("should call markAllAsReadAction when 'Mark all read' is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationList notifications={mockNotifications} />);

    // Open dropdown
    const trigger = screen.getByRole("button", { name: /notifications/i });
    await user.click(trigger);

    const markAllButton = await screen.findByText("Mark all read");
    await user.click(markAllButton);

    await waitFor(() => {
      expect(markAllAsReadAction).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("should call markAsReadAction when notification is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationList notifications={mockNotifications} />);

    // Open dropdown
    const trigger = screen.getByRole("button", { name: /notifications/i });
    await user.click(trigger);

    // Click the notification link
    const notificationLink = await screen.findByText("Assigned to MM-1");
    await user.click(notificationLink);

    await waitFor(() => {
      expect(markAsReadAction).toHaveBeenCalledWith("1");
    });
  });

  it("should close dropdown when notification is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationList notifications={mockNotifications} />);

    // Open dropdown
    const trigger = screen.getByRole("button", { name: /notifications/i });
    await user.click(trigger);

    // Verify it's open
    expect(await screen.findByText("Assigned to MM-1")).toBeInTheDocument();

    // Click the notification link
    const notificationLink = screen.getByText("Assigned to MM-1");
    await user.click(notificationLink);

    // Verify it closes (content should disappear)
    await waitFor(() => {
      expect(screen.queryByText("Assigned to MM-1")).not.toBeInTheDocument();
    });
  });
});
