import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnerBadge } from "./OwnerBadge";

describe("OwnerBadge", () => {
  it("renders the owner badge with crown icon", () => {
    render(<OwnerBadge />);

    const badge = screen.getByTestId("owner-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/^Owner$/);
  });

  describe("inline tone", () => {
    // The machine-settings audit line is 12px muted copy; a filled pill there
    // shouts over the text it annotates (PP-tn6t review), so the inline tone
    // drops the fill and keeps only the crown + label.
    it("keeps the label and the test id", () => {
      render(<OwnerBadge tone="inline" />);

      const badge = screen.getByTestId("owner-badge");
      expect(badge).toHaveTextContent(/^Owner$/);
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
