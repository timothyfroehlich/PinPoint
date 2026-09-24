import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest";
import { usePathname } from "next/navigation";
import { openFeedbackForm } from "~/components/feedback/FeedbackWidget";
import { BottomTabBar } from "./BottomTabBar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
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
  openFeedbackForm: vi.fn(),
}));

vi.mock("~/components/layout/QuickSearch", () => ({
  MobileQuickSearchTrigger: ({ className }: { className?: string }) => (
    <button className={className} data-testid="quick-search-mobile-trigger">
      Search
    </button>
  ),
}));

describe("BottomTabBar", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
  });

  it("replaces Dashboard with Search and preserves the remaining destinations", () => {
    render(<BottomTabBar />);

    expect(
      screen.queryByRole("link", { name: /dashboard/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("quick-search-mobile-trigger")
    ).toBeInTheDocument();
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

  it("uses the saved mobile report destination", () => {
    render(<BottomTabBar reportHref="/report/multiple" />);
    expect(screen.getByRole("link", { name: /report/i })).toHaveAttribute(
      "href",
      "/report/multiple"
    );
  });

  it("renders the More button", () => {
    render(<BottomTabBar />);
    expect(
      screen.getByRole("button", { name: /more options/i })
    ).toBeInTheDocument();
  });

  it("highlights the active tab based on pathname", () => {
    vi.mocked(usePathname).mockReturnValue("/issues");
    render(<BottomTabBar />);

    const issuesLink = screen.getByRole("link", { name: /issues/i });
    expect(issuesLink).toHaveAttribute("aria-current", "page");
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

    expect(screen.getByTestId("more-sheet-feedback")).toBeInTheDocument();
    expect(screen.getByTestId("more-sheet-help")).toBeInTheDocument();
    expect(screen.getByTestId("more-sheet-whats-new")).toBeInTheDocument();
    expect(screen.getByTestId("more-sheet-about")).toBeInTheDocument();
  });

  it("offers Multiple issues in More only with batch access", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BottomTabBar role="guest" />);
    await user.click(screen.getByRole("button", { name: /more options/i }));
    expect(screen.queryByTestId("more-sheet-multiple-issues")).toBeNull();

    rerender(<BottomTabBar role="member" />);
    expect(screen.getByTestId("more-sheet-multiple-issues")).toHaveAttribute(
      "href",
      "/report/multiple"
    );
  });

  it("calls openFeedbackForm and closes the sheet when Feedback is clicked", async () => {
    const user = userEvent.setup();
    const mockedOpenFeedbackForm = openFeedbackForm as MockedFunction<
      typeof openFeedbackForm
    >;
    mockedOpenFeedbackForm.mockClear();

    render(<BottomTabBar />);

    await user.click(screen.getByRole("button", { name: /more options/i }));

    const feedbackButton = screen.getByTestId("more-sheet-feedback");
    expect(feedbackButton).toBeInTheDocument();
    expect(screen.getByText("Feedback")).toBeInTheDocument();

    await user.click(feedbackButton);

    expect(mockedOpenFeedbackForm).toHaveBeenCalledOnce();
  });

  it("does not show User Management or Integrations in More sheet for non-admin roles", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar role="member" />);

    await user.click(screen.getByRole("button", { name: /more options/i }));

    expect(screen.queryByTestId("more-sheet-admin")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("more-sheet-admin-integrations")
    ).not.toBeInTheDocument();
  });

  it("highlights Issues tab (not Machines) when viewing an issue detail page", () => {
    vi.mocked(usePathname).mockReturnValue("/m/BB/i/4");
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /issues/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /machines/i })).not.toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("highlights Issues tab (not Machines) when on the issues list for a machine (no trailing slash)", () => {
    vi.mocked(usePathname).mockReturnValue("/m/BB/i");
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /issues/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /machines/i })).not.toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("highlights Machines tab when viewing a machine detail page", () => {
    vi.mocked(usePathname).mockReturnValue("/m/BB");
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /machines/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /issues/i })).not.toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("shows User Management in More sheet for admin role", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar role="admin" />);

    await user.click(screen.getByRole("button", { name: /more options/i }));

    const adminLink = screen.getByTestId("more-sheet-admin");
    expect(adminLink).toBeInTheDocument();
    expect(adminLink).toHaveAttribute("href", "/admin/users");
    expect(adminLink).toHaveTextContent("User Management");
  });

  it("shows Integrations link in More sheet for admin role", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar role="admin" />);

    await user.click(screen.getByRole("button", { name: /more options/i }));

    const integrationsLink = screen.getByTestId(
      "more-sheet-admin-integrations"
    );
    expect(integrationsLink).toBeInTheDocument();
    expect(integrationsLink).toHaveAttribute("href", "/admin/integrations");
    expect(integrationsLink).toHaveTextContent("Integrations");
  });
});
