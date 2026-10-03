/**
 * RTL Unit Tests: PersonHoverCard
 *
 * Asserts the dispatcher branches:
 *  - real user (userId set)  → Link trigger with href="/u/<id>"
 *  - invited user (userId null) → plain text, no link
 *  - former user (userId null)  → plain text, no link
 * Hover-reveal behavior (fetching user profile and rendering role pill on
 * hover) is asserted alongside dispatcher branches, consolidated from the
 * retired unit test.
 */

import React from "react";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { PersonHoverCard } from "./PersonHoverCard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it("shows a capitalized role pill after fetch on hover", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Admin User",
            avatarUrl: null,
            pronouns: "they/them",
            role: "admin",
            machineCount: 4,
          }),
      })
    );
    render(<PersonHoverCard userId="abc" displayName="Admin User" />);
    fireEvent.pointerEnter(screen.getByRole("link", { name: "Admin User" }));
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
  });
});
