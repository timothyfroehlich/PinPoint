import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "~/components/layout/Sidebar";
import { vi, describe, it, expect } from "vitest";
import React from "react";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => (
    <a {...props}>{children}</a>
  ),
}));

// Mock logoutAction
vi.mock("~/app/(auth)/actions", () => ({
  logoutAction: vi.fn(),
}));

describe("Sidebar", () => {
  it("renders correctly", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("should NOT contain Settings or Sign Out links", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
  });

  it("should have a collapse toggle button", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar-toggle")).toBeInTheDocument();
  });

  it("should toggle collapse state when button is clicked", () => {
    render(<Sidebar />);
    const toggleButton = screen.getByTestId("sidebar-toggle");

    // Initially expanded - text should be visible
    expect(screen.getByText("Dashboard")).toBeVisible();

    // Click to collapse
    fireEvent.click(toggleButton);

    // Now text should be hidden.
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(toggleButton);
    expect(screen.getByText("Dashboard")).toBeVisible();
  });
});
