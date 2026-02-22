import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MobileHeader } from "./MobileHeader";

// Mock dependencies
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ComponentProps<"img">) => (
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/components/notifications/NotificationList", () => ({
  NotificationList: () => <button aria-label="Notifications">Bell</button>,
}));

vi.mock("./user-menu-client", () => ({
  UserMenu: ({
    userName,
    testId = "user-menu-button",
  }: {
    userName: string;
    testId?: string;
  }) => <button data-testid={testId}>{userName}</button>,
}));

vi.mock("./header-sign-in-button", () => ({
  HeaderSignInButton: ({
    testId = "nav-signin",
  }: {
    testId?: string;
    className?: string;
  }) => (
    <a href="/login?next=%2Fdashboard" data-testid={testId}>
      Sign In
    </a>
  ),
}));

describe("MobileHeader", () => {
  it("renders logo link on both auth and unauth states", () => {
    render(<MobileHeader isAuthenticated={false} />);
    const logo = screen.getByRole("link", { name: "PinPoint" });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("href", "/dashboard");
    // Logo image present
    expect(screen.getByAltText("P")).toBeInTheDocument();
    // Logo text present
    expect(screen.getByText("PinPoint")).toBeInTheDocument();
  });

  it("renders mobile-header testid", () => {
    render(<MobileHeader isAuthenticated={false} />);
    expect(screen.getByTestId("mobile-header")).toBeInTheDocument();
  });

  it("renders APC logo linking to austinpinballcollective.org", () => {
    render(<MobileHeader isAuthenticated={false} />);
    const apcLink = screen.getByRole("link", {
      name: "Austin Pinball Collective",
    });
    expect(apcLink).toBeInTheDocument();
    expect(apcLink).toHaveAttribute(
      "href",
      "https://austinpinballcollective.org"
    );
    expect(apcLink).toHaveAttribute("target", "_blank");
    expect(apcLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByAltText("Austin Pinball Collective")
    ).toBeInTheDocument();
  });

  describe("unauthenticated state", () => {
    it("shows Sign In and Sign Up buttons with correct testids", () => {
      render(<MobileHeader isAuthenticated={false} />);
      expect(screen.getByTestId("mobile-nav-signin")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-nav-signup")).toBeInTheDocument();
      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
    });

    it("Sign In links to login page", () => {
      render(<MobileHeader isAuthenticated={false} />);
      const signInLink = screen.getByTestId("mobile-nav-signin");
      expect(signInLink.closest("a")).toHaveAttribute(
        "href",
        expect.stringContaining("/login")
      );
    });

    it("Sign Up links to signup page", () => {
      render(<MobileHeader isAuthenticated={false} />);
      const signUpLink = screen.getByTestId("mobile-nav-signup");
      expect(signUpLink.closest("a")).toHaveAttribute("href", "/signup");
    });

    it("does not show notification bell or user menu", () => {
      render(<MobileHeader isAuthenticated={false} />);
      expect(
        screen.queryByRole("button", { name: "Notifications" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("mobile-user-menu-button")
      ).not.toBeInTheDocument();
    });
  });

  describe("authenticated state", () => {
    const notifications = [
      {
        id: "n1",
        type: "new_comment" as const,
        createdAt: new Date(),
        link: "/m/AFM/i/1",
        machineInitials: "AFM",
        issueNumber: 1,
      },
    ];

    it("shows notification bell and user menu", () => {
      render(
        <MobileHeader
          isAuthenticated={true}
          userName="Alex Smith"
          notifications={notifications}
        />
      );
      expect(
        screen.getByRole("button", { name: "Notifications" })
      ).toBeInTheDocument();
      expect(screen.getByTestId("mobile-user-menu-button")).toBeInTheDocument();
    });

    it("passes userName to UserMenu", () => {
      render(
        <MobileHeader
          isAuthenticated={true}
          userName="Alex Smith"
          notifications={[]}
        />
      );
      expect(screen.getByTestId("mobile-user-menu-button")).toHaveTextContent(
        "Alex Smith"
      );
    });

    it("does not show Sign In or Sign Up buttons", () => {
      render(
        <MobileHeader
          isAuthenticated={true}
          userName="Alex Smith"
          notifications={[]}
        />
      );
      expect(screen.queryByTestId("mobile-nav-signin")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mobile-nav-signup")).not.toBeInTheDocument();
    });
  });
});
