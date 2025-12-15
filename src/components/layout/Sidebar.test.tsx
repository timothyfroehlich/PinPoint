import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
  });

  it("renders accessible links when expanded", () => {
    render(<Sidebar />);

    // Check for main nav items by their text
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Issues" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Machines" })).toBeInTheDocument();

    // Check for Logo link
    expect(screen.getByRole("link", { name: "Austin Pinball Collective" })).toBeInTheDocument();
  });

  it("renders accessible links when collapsed", () => {
    // Set collapsed state in localStorage
    window.localStorage.setItem("sidebar-collapsed", "true");

    render(<Sidebar />);

    // Wait for effect to run (though it runs on mount, render is usually enough)
    // We check if the "Collapse" button text changes to confirm it's collapsed
    const collapseButton = screen.getByRole("button", { name: "Expand sidebar" });
    expect(collapseButton).toBeInTheDocument();

    // These checks will fail if the text is removed from DOM and no aria-label is present
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Issues" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Machines" })).toBeInTheDocument();

    // Logo link check - currently it has no text when collapsed
    // We expect this to fail initially, or we want to fix it so it passes.
    // For now, let's see what happens.
    // The logo link when collapsed shows a CircleDot icon.
    // We might want it to still say "Austin Pinball Collective" or "Dashboard"
    expect(screen.getByRole("link", { name: "Austin Pinball Collective" })).toBeInTheDocument();
  });
});
