import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";

// Mock dependencies
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useSearchParams: vi.fn(() => ({
    toString: () => "",
  })),
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

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority,
    fill,
    sizes,
    quality,
    ...props
  }: React.ComponentProps<"img"> & {
    priority?: boolean;
    fill?: boolean;
    sizes?: string;
    quality?: number;
  }) => <img alt={alt} {...props} />,
}));

vi.mock("~/components/notifications/NotificationList", () => ({
  NotificationList: () => (
    <button aria-label="Notifications" data-testid="notification-list">
      Bell
    </button>
  ),
}));

vi.mock("./user-menu-client", () => ({
  UserMenu: ({
    userName,
    role,
  }: {
    userName: string;
    role?: string;
    testId?: string;
  }) => (
    <button data-testid="user-menu-button" data-role={role}>
      {userName}
    </button>
  ),
}));

vi.mock("./header-sign-in-button", () => ({
  HeaderSignInButton: ({
    testId = "nav-signin",
  }: {
    testId?: string;
    className?: string;
  }) => (
    <a href="/login" data-testid={testId}>
      Sign In
    </a>
  ),
}));

vi.mock("./HelpMenu", () => ({
  HelpMenu: ({ newChangelogCount }: { newChangelogCount: number }) => (
    <button
      data-testid="help-menu-trigger"
      data-changelog-count={newChangelogCount}
    >
      Help
    </button>
  ),
}));

// FeedbackWidget uses Sentry -- mock it to keep tests simple
vi.mock("~/components/feedback/FeedbackWidget", () => ({
  openFeedbackForm: vi.fn(),
}));

const defaultAuthProps = {
  isAuthenticated: true as const,
  userName: "Alex Smith",
  role: "member" as const,
  notifications: [],
  issuesPath: "/issues",
  newChangelogCount: 0,
};

const defaultUnauthProps = {
  isAuthenticated: false as const,
  notifications: [],
  issuesPath: "/issues",
  newChangelogCount: 0,
};

describe("AppHeader", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
  });

  it("renders the data-testid on the header element", () => {
    render(<AppHeader {...defaultAuthProps} />);
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
  });

  it("renders PinPoint logo linking to /dashboard", () => {
    render(<AppHeader {...defaultAuthProps} />);
    const logo = screen.getByRole("link", { name: "PinPoint" });
    expect(logo).toHaveAttribute("href", "/dashboard");
  });

  it("renders APC logo with correct external link", () => {
    render(<AppHeader {...defaultAuthProps} />);
    const apcLink = screen.getByTestId("apc-logo-link");
    expect(apcLink).toHaveAttribute(
      "href",
      "https://austinpinballcollective.org"
    );
    expect(apcLink).toHaveAttribute("target", "_blank");
    expect(apcLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  describe("nav items", () => {
    it("renders Dashboard, Issues, and Machines nav links", () => {
      render(<AppHeader {...defaultAuthProps} />);

      expect(screen.getByTestId("nav-dashboard")).toHaveAttribute(
        "href",
        "/dashboard"
      );
      expect(screen.getByTestId("nav-issues")).toHaveAttribute(
        "href",
        "/issues"
      );
      expect(screen.getByTestId("nav-machines")).toHaveAttribute("href", "/m");
    });

    it("uses issuesPath for the Issues link", () => {
      render(
        <AppHeader {...defaultAuthProps} issuesPath="/issues?status=open" />
      );
      expect(screen.getByTestId("nav-issues")).toHaveAttribute(
        "href",
        "/issues?status=open"
      );
    });

    it("highlights the active nav item based on pathname", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppHeader {...defaultAuthProps} />);

      expect(screen.getByTestId("nav-dashboard")).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(screen.getByTestId("nav-issues")).not.toHaveAttribute(
        "aria-current"
      );
      expect(screen.getByTestId("nav-machines")).not.toHaveAttribute(
        "aria-current"
      );
    });

    it("highlights Issues tab when on issue detail page", () => {
      vi.mocked(usePathname).mockReturnValue("/m/GDZ/i/2");
      render(<AppHeader {...defaultAuthProps} />);

      expect(screen.getByTestId("nav-issues")).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(screen.getByTestId("nav-machines")).not.toHaveAttribute(
        "aria-current"
      );
    });

    it("highlights Machines tab when on machine detail page", () => {
      vi.mocked(usePathname).mockReturnValue("/m/GDZ");
      render(<AppHeader {...defaultAuthProps} />);

      expect(screen.getByTestId("nav-machines")).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(screen.getByTestId("nav-issues")).not.toHaveAttribute(
        "aria-current"
      );
    });
  });

  describe("desktop actions", () => {
    it("renders Report Issue button linking to /report", () => {
      render(<AppHeader {...defaultAuthProps} />);
      expect(screen.getByTestId("nav-report-issue")).toBeInTheDocument();
      const reportLink = screen.getByTestId("nav-report-issue").closest("a");
      expect(reportLink).toHaveAttribute("href", "/report");
    });

    it("renders HelpMenu with newChangelogCount", () => {
      render(<AppHeader {...defaultAuthProps} newChangelogCount={5} />);
      const helpMenu = screen.getByTestId("help-menu-trigger");
      expect(helpMenu).toHaveAttribute("data-changelog-count", "5");
    });
  });

  describe("authenticated state", () => {
    it("shows notifications and user menu", () => {
      render(<AppHeader {...defaultAuthProps} />);
      expect(screen.getByTestId("notification-list")).toBeInTheDocument();
      expect(screen.getByTestId("user-menu-button")).toBeInTheDocument();
    });

    it("passes userName to UserMenu", () => {
      render(<AppHeader {...defaultAuthProps} userName="Jane Doe" />);
      expect(screen.getByTestId("user-menu-button")).toHaveTextContent(
        "Jane Doe"
      );
    });

    it("does not show sign in or sign up buttons", () => {
      render(<AppHeader {...defaultAuthProps} />);
      expect(screen.queryByTestId("nav-signin")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nav-signup")).not.toBeInTheDocument();
    });
  });

  describe("unauthenticated state", () => {
    it("shows sign in and sign up buttons", () => {
      render(<AppHeader {...defaultUnauthProps} />);
      expect(screen.getByTestId("nav-signin")).toBeInTheDocument();
      expect(screen.getByTestId("nav-signup")).toBeInTheDocument();
    });

    it("sign up links to /signup", () => {
      render(<AppHeader {...defaultUnauthProps} />);
      const signUpLink = screen.getByTestId("nav-signup").closest("a");
      expect(signUpLink).toHaveAttribute("href", "/signup");
    });

    it("does not show notifications or user menu", () => {
      render(<AppHeader {...defaultUnauthProps} />);
      expect(screen.queryByTestId("notification-list")).not.toBeInTheDocument();
      expect(screen.queryByTestId("user-menu-button")).not.toBeInTheDocument();
    });
  });
});
