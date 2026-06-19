import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileHero } from "~/app/(app)/u/[id]/profile-hero";

describe("ProfileHero", () => {
  const base = {
    name: "Admin User",
    pronouns: "they/them",
    role: "admin" as const,
    avatarUrl: null,
    memberSince: "Jun 2026",
  };

  it("shows name, pronouns, role pill and member-since", () => {
    render(<ProfileHero {...base} isOwn={false} editHref="/u/x?edit=1" />);
    expect(
      screen.getByRole("heading", { name: /Admin User/ })
    ).toBeInTheDocument();
    expect(screen.getByText("they/them")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText(/Jun 2026/)).toBeInTheDocument();
  });

  it("shows the Edit link only for the owner", () => {
    const { rerender } = render(
      <ProfileHero {...base} isOwn={false} editHref="/u/x?edit=1" />
    );
    expect(screen.queryByRole("link", { name: /edit profile/i })).toBeNull();
    rerender(<ProfileHero {...base} isOwn={true} editHref="/u/x?edit=1" />);
    expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute(
      "href",
      "/u/x?edit=1"
    );
  });
});
