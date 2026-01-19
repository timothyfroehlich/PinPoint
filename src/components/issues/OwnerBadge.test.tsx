import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnerBadge } from "./OwnerBadge";

describe("OwnerBadge", () => {
  it("renders the owner badge with crown icon", () => {
    render(<OwnerBadge />);

    const badge = screen.getByTestId("owner-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Game Owner");
  });

  it("renders with default size", () => {
    render(<OwnerBadge />);

    const badge = screen.getByTestId("owner-badge");
    expect(badge).toHaveClass("gap-1");
  });

  it("renders with small size", () => {
    render(<OwnerBadge size="sm" />);

    const badge = screen.getByTestId("owner-badge");
    expect(badge).toHaveClass("text-[10px]");
    expect(badge).toHaveClass("px-1.5");
  });

  it("applies custom className", () => {
    render(<OwnerBadge className="custom-class" />);

    const badge = screen.getByTestId("owner-badge");
    expect(badge).toHaveClass("custom-class");
  });
});
