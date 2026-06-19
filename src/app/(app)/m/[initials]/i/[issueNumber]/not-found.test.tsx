import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import IssueNotFound from "./not-found";

/**
 * Thin render smoke test for the issue-level not-found page (PP-2053.9).
 *
 * Verifies that the component:
 *  - renders without throwing
 *  - shows the actionable user-facing message
 *  - exposes the two CTA links (report + browse)
 *  - does NOT expose any internal detail or PII (CORE-SEC-007)
 */
describe("IssueNotFound", () => {
  it("renders the not-found page with actionable copy and links", () => {
    render(<IssueNotFound />);

    expect(
      screen.getByRole("heading", { name: /issue not found/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/may have been removed/i)).toBeInTheDocument();

    const reportLink = screen.getByRole("link", { name: /report an issue/i });
    expect(reportLink).toBeInTheDocument();
    expect(reportLink).toHaveAttribute("href", "/report");

    const browseLink = screen.getByRole("link", { name: /browse all issues/i });
    expect(browseLink).toBeInTheDocument();
    expect(browseLink).toHaveAttribute("href", "/issues");
  });

  it("does not expose internal identifiers or email addresses (CORE-SEC-007)", () => {
    const { container } = render(<IssueNotFound />);
    // No emails, no database IDs, no stack trace fragments
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toMatch(/uuid|id=|Error:|stack/i);
  });
});
