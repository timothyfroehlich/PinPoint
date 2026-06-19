import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileStatGrid } from "~/app/(app)/u/[id]/profile-stat-grid";

describe("ProfileStatGrid", () => {
  it("renders all four stats with labels", () => {
    render(
      <ProfileStatGrid
        reported={4}
        comments={9}
        machinesOwned={4}
        fixed={2}
        collectionHref="/c/owner/x"
      />
    );
    expect(screen.getByText("Issues reported")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("Machines owned")).toBeInTheDocument();
    expect(screen.getByText("Issues fixed")).toBeInTheDocument();
    expect(screen.getAllByText("4")).toHaveLength(2); // reported=4, machinesOwned=4
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("links the machines tile to the collection", () => {
    render(
      <ProfileStatGrid
        reported={0}
        comments={0}
        machinesOwned={3}
        fixed={0}
        collectionHref="/c/owner/x"
      />
    );
    expect(
      screen.getByRole("link", { name: /machines owned/i })
    ).toHaveAttribute("href", "/c/owner/x");
  });
});
