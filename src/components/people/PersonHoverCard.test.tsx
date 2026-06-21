/**
 * RTL Unit Tests: PersonHoverCard
 *
 * Asserts the dispatcher branches:
 *  - real user (userId set)  → Link trigger with href="/u/<id>"
 *  - invited user (userId null) → plain text, no link
 *  - former user (userId null)  → plain text, no link
 *
 * Hover-reveal behaviour is NOT asserted (Radix portal + hover is flaky in
 * jsdom). The !userId branch never renders any Radix at all, making those
 * two cases trivial.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PersonHoverCard } from "./PersonHoverCard";

describe("PersonHoverCard", () => {
  it("renders a profile link for a real user", () => {
    render(<PersonHoverCard userId="abc" displayName="Sarah Chen" />);
    const link = screen.getByRole("link", { name: "Sarah Chen" });
    expect(link).toHaveAttribute("href", "/u/abc");
  });

  it("renders plain text (no link) for an invited user", () => {
    render(<PersonHoverCard userId={null} displayName="Invited Person" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Invited Person")).toBeInTheDocument();
  });

  it("renders plain text for a former user", () => {
    render(<PersonHoverCard userId={null} displayName="Former user" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Former user")).toBeInTheDocument();
  });
});
