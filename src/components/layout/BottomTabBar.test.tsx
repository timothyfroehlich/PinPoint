import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BottomTabBar } from "./BottomTabBar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// FeedbackWidget uses Sentry — mock it to keep tests simple
vi.mock("~/components/feedback/FeedbackWidget", () => ({
  FeedbackWidget: () => <button type="button">Feedback</button>,
}));

describe("BottomTabBar", () => {
  it("renders the four main tabs with correct links", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: /issues/i })).toHaveAttribute(
      "href",
      "/issues"
    );
    expect(screen.getByRole("link", { name: /machines/i })).toHaveAttribute(
      "href",
      "/m"
    );
    expect(screen.getByRole("link", { name: /report/i })).toHaveAttribute(
      "href",
      "/report"
    );
  });

  it("renders the More button", () => {
    render(<BottomTabBar />);
    expect(
      screen.getByRole("button", { name: /more options/i })
    ).toBeInTheDocument();
  });

  it("highlights the active tab based on pathname", () => {
    render(<BottomTabBar />);

    // usePathname is mocked to return "/dashboard"
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");

    const issuesLink = screen.getByRole("link", { name: /issues/i });
    expect(issuesLink).not.toHaveAttribute("aria-current", "page");
  });

  it("uses issuesPath prop for the Issues tab link", () => {
    render(<BottomTabBar issuesPath="/issues?status=open" />);
    expect(screen.getByRole("link", { name: /issues/i })).toHaveAttribute(
      "href",
      "/issues?status=open"
    );
  });

  it("opens the More sheet when More button is clicked", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar />);

    // Sheet content is not rendered until opened
    expect(screen.queryByTestId("more-sheet-help")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /more options/i }));

    expect(screen.getByTestId("more-sheet-help")).toBeInTheDocument();
    expect(screen.getByTestId("more-sheet-whats-new")).toBeInTheDocument();
    expect(screen.getByTestId("more-sheet-about")).toBeInTheDocument();
  });

  it("does not show Admin Panel in More sheet for non-admin roles", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar role="member" />);

    await user.click(screen.getByRole("button", { name: /more options/i }));

    expect(screen.queryByTestId("more-sheet-admin")).not.toBeInTheDocument();
  });

  it("shows Admin Panel in More sheet for admin role", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar role="admin" />);

    await user.click(screen.getByRole("button", { name: /more options/i }));

    const adminLink = screen.getByTestId("more-sheet-admin");
    expect(adminLink).toBeInTheDocument();
    expect(adminLink).toHaveAttribute("href", "/admin/users");
  });
});
