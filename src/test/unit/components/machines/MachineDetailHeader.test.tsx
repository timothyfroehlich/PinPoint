import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MachineDetailHeader } from "~/components/machines/MachineDetailHeader";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";

/**
 * Minimal `MachineForLayout` fixture. The header only reads identity +
 * PBM-reserved metadata, but the prop type requires the full shape, so we
 * provide valid defaults and let callers override the fields under test.
 */
function makeMachine(
  overrides: Partial<MachineForLayout> = {}
): MachineForLayout {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    initials: "GZ",
    nextIssueNumber: 1,
    name: "Godzilla",
    ownerId: null,
    invitedOwnerId: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    description: null,
    ownerRequirements: null,
    settingsRequests: null,
    settingsInstructions: null,
    presenceStatus: "on_the_floor",
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    opdbId: null,
    ipdbId: null,
    issues: [],
    owner: null,
    invitedOwner: null,
    watchers: [],
    manufacturer: null,
    year: null,
    edition: null,
    backboxImageUrl: null,
    ...overrides,
  };
}

describe("MachineDetailHeader", () => {
  it("renders the initials chip", () => {
    render(<MachineDetailHeader machine={makeMachine({ initials: "GZ" })} />);
    expect(screen.getByText("GZ")).toBeInTheDocument();
  });

  it("renders the machine name", () => {
    render(<MachineDetailHeader machine={makeMachine({ name: "Godzilla" })} />);
    expect(
      screen.getByRole("heading", { name: "Godzilla" })
    ).toBeInTheDocument();
  });

  it("shows the manufacturer · year · edition sub-line when all present", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          manufacturer: "Stern",
          year: 2021,
          edition: "Premium",
        })}
      />
    );
    expect(screen.getByTestId("machine-meta")).toHaveTextContent(
      "Stern · 2021 · Premium"
    );
  });

  it("omits absent parts with no trailing separator", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          manufacturer: "Stern",
          year: 2021,
          edition: null,
        })}
      />
    );
    expect(screen.getByTestId("machine-meta").textContent).toBe("Stern · 2021");
  });

  it("renders no sub-line when manufacturer, year, and edition are all absent", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          manufacturer: null,
          year: null,
          edition: null,
        })}
      />
    );
    expect(screen.queryByTestId("machine-meta")).not.toBeInTheDocument();
  });
});
