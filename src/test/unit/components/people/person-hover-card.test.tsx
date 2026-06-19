import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PersonHoverCard", () => {
  it("renders plain text (no link) for a null userId", () => {
    render(<PersonHoverCard userId={null} displayName="Anonymous" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
  });

  it("links the trigger to the profile page", () => {
    render(<PersonHoverCard userId="abc" displayName="Admin User" />);
    expect(screen.getByRole("link", { name: "Admin User" })).toHaveAttribute(
      "href",
      "/u/abc"
    );
  });

  it("shows a capitalized role pill after fetch", async () => {
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
