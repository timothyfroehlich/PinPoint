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
          <h1
            data-testid="custom-h1"
            className="text-balance text-3xl font-bold tracking-tight"
          >
            Custom Title
          </h1>
        }
      />
    );
    expect(screen.getByTestId("custom-h1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Custom Title"
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
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

  it("renders actions in a flex container when provided", () => {
    render(
      <PageHeader
        title="My Page"
        actions={<button data-testid="action">Action</button>}
      />
    );
    expect(screen.getByTestId("action")).toBeInTheDocument();
  });
});
