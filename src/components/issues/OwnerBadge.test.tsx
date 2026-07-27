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

  describe("inline tone", () => {
    // The machine-settings audit line is 12px muted copy; a filled pill there
    // shouts over the text it annotates (PP-tn6t review), so the inline tone
    // drops the fill and keeps only the crown + label.
    it("keeps the label and the test id", () => {
      render(<OwnerBadge tone="inline" />);

      const badge = screen.getByTestId("owner-badge");
      expect(badge).toHaveTextContent("Game Owner");
    });

    it("renders no filled pill — no background, border, or uppercasing", () => {
      render(<OwnerBadge tone="inline" />);

      const badge = screen.getByTestId("owner-badge");
      expect(badge.className).not.toMatch(/\bbg-/);
      expect(badge.className).not.toMatch(/\bborder\b/);
      expect(badge).not.toHaveClass("uppercase");
    });

    it("still accepts a custom className", () => {
      render(<OwnerBadge tone="inline" className="mx-1" />);

      expect(screen.getByTestId("owner-badge")).toHaveClass("mx-1");
    });
  });
});
