import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelinePinballMapCommentRow } from "./MachineTimelinePinballMapCommentRow";
import type { ResolvedPinballMapComment } from "~/lib/timeline/machine-events";

vi.mock("./ConvertPinballMapCommentDialog", () => ({
  ConvertPinballMapCommentDialog: () => null,
}));

function renderRow(
  previousListing: ResolvedPinballMapComment["previousListing"]
): void {
  render(
    <MachineTimelinePinballMapCommentRow
      row={{
        id: "event-1",
        machineId: "machine-1",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        comment: {
          conditionId: 1,
          comment: "left flipper weak",
          username: "pbm_user",
          locationId: 26454,
          convertedIssue: null,
          otherCopies: [],
          previousListing,
        },
      }}
      canConvert={false}
      showRelativeTime={false}
    />
  );
}

describe("MachineTimelinePinballMapCommentRow", () => {
  it("notes a comment from a previous listing", () => {
    renderRow("removed");
    expect(
      screen.getByText("Note: From a Previous Listing")
    ).toBeInTheDocument();
  });

  it("shows no note while the entry is current", () => {
    renderRow(null);
    expect(
      screen.queryByText("Note: From a Previous Listing")
    ).not.toBeInTheDocument();
  });
});
