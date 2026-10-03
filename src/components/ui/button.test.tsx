import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "~/components/ui/button";

describe("Button", () => {
  it("preserves children and disables loading buttons even with disabled=false", () => {
    const { rerender } = render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeEnabled();

    rerender(<Button loading>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeDisabled();

    rerender(
      <Button loading disabled={false}>
        Click me
      </Button>
    );
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
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
