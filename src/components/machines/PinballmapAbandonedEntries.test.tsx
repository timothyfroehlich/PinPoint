import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { PinballmapAbandonedEntries } from "./PinballmapAbandonedEntries";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  removeMachineFromPinballMapAction: vi.fn(),
}));

describe("PinballmapAbandonedEntries", () => {
  const entries = [
    {
      lmxId: 101,
      locationUrl: "https://pinballmap.com/map?by_location_id=10",
      title: "Old title",
      commentCount: 0,
    },
    {
      lmxId: 202,
      locationUrl: "https://pinballmap.com/map?by_location_id=20",
      title: "Older title",
      commentCount: 0,
    },
  ] as const;

  it("links each manual cleanup to its location when an authorized viewer lacks credentials", () => {
    render(
      <PinballmapAbandonedEntries
        machineId="machine-1"
        entries={entries}
        canPush={true}
        writeEnabled={false}
      />
    );

    const links = screen.getAllByRole("link", {
      name: "Remove it on Pinball Map",
    });
    expect(links[0]).toHaveAttribute(
      "href",
      "https://pinballmap.com/map?by_location_id=10"
    );
    expect(links[1]).toHaveAttribute(
      "href",
      "https://pinballmap.com/map?by_location_id=20"
    );
  });

  it("shows no cleanup affordance to a viewer without the push capability", () => {
    render(
      <PinballmapAbandonedEntries
        machineId="machine-1"
        entries={entries}
        canPush={false}
        writeEnabled={true}
      />
    );

    expect(
      screen.queryByRole("link", { name: "Remove it on Pinball Map" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Remove machine from Pinball Map",
      })
    ).not.toBeInTheDocument();
  });
});
