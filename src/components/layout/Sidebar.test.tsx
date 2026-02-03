import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "./Sidebar";

// Mock dependencies
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ComponentProps<"img">) => (
    <img alt={alt} {...props} />
  ),
}));

// Mock client-side cookie storage
vi.mock("~/lib/cookies/client", () => ({
  storeSidebarCollapsed: vi.fn(),
}));

describe("Sidebar Accessibility", () => {
  it("provides accessible names for links when collapsed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Initially expanded, links have text content
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toBeInTheDocument();

    // Find collapse button
    const collapseButton = screen.getByRole("button", {
      name: "Collapse sidebar",
    });

    // Collapse the sidebar
    await user.click(collapseButton);

    // Now the sidebar is collapsed.
    // The link should still have an accessible name "Dashboard" via aria-label.
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });
});
