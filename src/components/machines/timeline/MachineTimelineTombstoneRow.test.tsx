import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MachineTimelineTombstoneRow } from "./MachineTimelineTombstoneRow";

describe("MachineTimelineTombstoneRow", () => {
  it("renders deleter name and relative time", () => {
    render(
      <MachineTimelineTombstoneRow
        deletedByName="Sam"
        deletedAt={new Date("2026-05-14T12:00:00Z")}
      />
    );
    expect(screen.getByText(/Comment deleted by Sam/)).toBeInTheDocument();
  });

  it("falls back to 'a user' when deletedByName is null", () => {
    render(
      <MachineTimelineTombstoneRow
        deletedByName={null}
        deletedAt={new Date()}
      />
    );
    expect(screen.getByText(/Comment deleted by a user/)).toBeInTheDocument();
  });
});
