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
  it("renders title as h1", () => {
    render(<PageHeader title="My Page" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "My Page" })
    ).toBeInTheDocument();
  });

  it("always has border-b class", () => {
    const { container } = render(<PageHeader title="My Page" />);
    expect(container.firstChild).toHaveClass("border-b");
  });

  it("renders back button when backHref is provided", () => {
    render(<PageHeader title="My Page" backHref="/previous" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/previous");
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("does not render back button when backHref is omitted", () => {
    render(<PageHeader title="My Page" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(<PageHeader title="My Page" actions={<button>Save</button>} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("does not render actions container when not provided", () => {
    const { container } = render(<PageHeader title="My Page" />);
    // Only the root div should be present; no extra wrapper divs for actions
    const divs = container.querySelectorAll("div");
    expect(divs).toHaveLength(1);
  });

  it("merges className prop", () => {
    const { container } = render(
      <PageHeader title="My Page" className="mt-8" />
    );
    expect(container.firstChild).toHaveClass("mt-8");
    expect(container.firstChild).toHaveClass("border-b");
  });
});
