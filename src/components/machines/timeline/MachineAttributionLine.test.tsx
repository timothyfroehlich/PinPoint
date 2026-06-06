import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MachineTimelineSystemRow } from "./MachineTimelineSystemRow";
import type { MachineSystemRowData } from "./MachineTimelineSystemRow";

const FIXTURE_ROW: MachineSystemRowData = {
  id: "s1",
  createdAt: new Date("2026-05-17T12:00:00Z"),
  tag: "lifecycle",
  eventData: { kind: "machine_added" },
  people: {},
};

describe("machine attribution line (PP-slrd.1)", () => {
  it("renders no machine line by default (per-machine pages unchanged)", () => {
    render(<MachineTimelineSystemRow row={FIXTURE_ROW} />);
    expect(screen.queryByTestId("machine-attribution")).not.toBeInTheDocument();
  });

  it("renders a linked machine name when machineLabel is provided", () => {
    render(
      <MachineTimelineSystemRow
        row={FIXTURE_ROW}
        machineLabel={{ name: "Godzilla", href: "/m/GZ" }}
      />
    );
    const line = screen.getByTestId("machine-attribution");
    expect(line).toHaveTextContent("Godzilla");
    expect(line.querySelector("a")).toHaveAttribute("href", "/m/GZ");
  });
});
