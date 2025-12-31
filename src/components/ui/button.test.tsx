
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./button";
import { Loader2 } from "lucide-react";

// Mock Loader2 to avoid issues with icon rendering in tests if necessary,
// though lucide-react usually behaves well.
// But checking for the SVG content is easier if we know what it renders.

describe("Button", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("applies loading state correctly", () => {
    render(<Button loading>Click me</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    // Check for spinner. lucide icons usually render an svg with specific class
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
    expect(button).toHaveTextContent("Click me");
  });

  it("handles explicit disabled prop with loading", () => {
    render(<Button loading disabled={false}>Click me</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not pollute DOM with loading prop", () => {
    render(<Button loading data-testid="btn">Click me</Button>);
    const button = screen.getByTestId("btn");
    expect(button).not.toHaveAttribute("loading");
  });

  it("ignores loading state when asChild is true", () => {
    render(
      <Button asChild loading>
        <a href="#">Link</a>
      </Button>
    );

    const link = screen.getByRole("link", { name: /link/i });
    expect(link).toBeInTheDocument();
    // Should NOT have spinner
    expect(link.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
