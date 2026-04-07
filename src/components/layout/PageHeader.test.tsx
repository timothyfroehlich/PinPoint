import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PageHeader } from "./PageHeader";

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

describe("PageHeader", () => {
  it("renders the title as an h1", () => {
    render(<PageHeader title="My Page" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "My Page" })
    ).toBeInTheDocument();
  });

  it("always renders border-b class", () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.firstChild).toHaveClass("border-b");
  });

  it("does not render breadcrumb nav when not provided", () => {
    render(<PageHeader title="Test" />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("does not render breadcrumb nav when empty array is provided", () => {
    render(<PageHeader title="Test" breadcrumbs={[]} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders breadcrumbs with links", () => {
    render(
      <PageHeader
        title="Detail"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Machines", href: "/m" },
        ]}
      />
    );
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveAttribute("href", "/");
    const machinesLink = screen.getByRole("link", { name: "Machines" });
    expect(machinesLink).toHaveAttribute("href", "/m");
  });

  it("renders titleAdornment alongside the title", () => {
    render(
      <PageHeader
        title="My Page"
        titleAdornment={<span data-testid="badge">Active</span>}
      />
    );
    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(
      <PageHeader title="My Page" actions={<button>Do Something</button>} />
    );
    expect(
      screen.getByRole("button", { name: "Do Something" })
    ).toBeInTheDocument();
  });

  it("does not render actions container when actions is undefined", () => {
    const { container } = render(<PageHeader title="My Page" />);
    // The actions wrapper div should not be present
    const actionDivs = container.querySelectorAll(".flex.items-center.gap-3");
    // Only the title row flex container should exist, not an actions div
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("merges additional className", () => {
    const { container } = render(
      <PageHeader title="Test" className="extra-class" />
    );
    expect(container.firstChild).toHaveClass("extra-class");
  });
});
