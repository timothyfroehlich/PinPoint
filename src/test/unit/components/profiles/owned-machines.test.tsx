import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnedMachines } from "~/app/(app)/u/[id]/owned-machines";

const machines = [
  { id: "1", initials: "GDZ", name: "Godzilla" },
  { id: "2", initials: "MM", name: "Medieval Madness" },
];

describe("OwnedMachines", () => {
  it("renders cards with chip, name, and open-issue count", () => {
    render(
      <OwnedMachines
        machines={machines}
        total={2}
        hasMore={false}
        ownerId="x"
        openCounts={new Map([["GDZ", 3]])}
      />
    );
    expect(screen.getByText("Godzilla")).toBeInTheDocument();
    expect(screen.getByText("GDZ")).toBeInTheDocument();
    expect(screen.getByText(/3 open/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Godzilla/ })).toHaveAttribute(
      "href",
      "/m/GDZ"
    );
  });

  it("returns null when nothing is owned", () => {
    const { container } = render(
      <OwnedMachines
        machines={[]}
        total={0}
        hasMore={false}
        ownerId="x"
        openCounts={new Map()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'View all N' when capped", () => {
    render(
      <OwnedMachines
        machines={machines}
        total={9}
        hasMore={true}
        ownerId="x"
        openCounts={new Map()}
      />
    );
    expect(screen.getByRole("link", { name: /view all 9/i })).toHaveAttribute(
      "href",
      "/c/owner/x"
    );
  });
});
