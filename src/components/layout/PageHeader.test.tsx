import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("auto-wraps a string title in an h1 with typography classes", () => {
    render(<PageHeader title="My Page" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("My Page");
    expect(h1).toHaveClass("text-balance");
    expect(h1).toHaveClass("text-3xl");
    expect(h1).toHaveClass("font-bold");
    expect(h1).toHaveClass("tracking-tight");
  });

  it("renders a ReactNode title directly without auto-wrapping", () => {
    render(
      <PageHeader
        title={
          <h1 className="text-balance text-3xl font-bold tracking-tight">
            Custom Title
          </h1>
        }
      />
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Custom Title"
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("always renders border-b class", () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.firstChild).toHaveClass("border-b");
  });

  it("renders titleAdornment alongside a string title", () => {
    render(
      <PageHeader
        title="My Page"
        titleAdornment={<span data-testid="adornment">Badge</span>}
      />
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "My Page"
    );
    expect(screen.getByTestId("adornment")).toBeInTheDocument();
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

  it("does not render actions container when actions is null", () => {
    render(<PageHeader title="My Page" actions={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("merges additional className", () => {
    const { container } = render(
      <PageHeader title="Test" className="extra-class" />
    );
    expect(container.firstChild).toHaveClass("extra-class");
  });
});
