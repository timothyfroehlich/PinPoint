import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageHeader } from "./PageHeader";

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
    render(<PageHeader title="My Page" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("merges additional className", () => {
    const { container } = render(
      <PageHeader title="Test" className="extra-class" />
    );
    expect(container.firstChild).toHaveClass("extra-class");
  });
});
