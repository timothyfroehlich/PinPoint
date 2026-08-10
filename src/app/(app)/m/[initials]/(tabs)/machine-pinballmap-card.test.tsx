import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MachinePinballmapCard } from "./machine-pinballmap-card";

const LOCATION_URL = "https://pinballmap.com/map/?by_location_id=26454";

describe("MachinePinballmapCard", () => {
  it("renders a public link back to the PBM location (CORE-PBM-001)", () => {
    render(<MachinePinballmapCard locationUrl={LOCATION_URL} />);
    const link = screen.getByTestId("machine-pinballmap-link");
    expect(link).toHaveTextContent(/view on pinball map/i);
    expect(link).toHaveAttribute("href", LOCATION_URL);
    expect(link).toHaveAttribute("target", "_blank");
    // noopener noreferrer to match the codebase convention for target="_blank".
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows no desync alert when in sync (default)", () => {
    render(<MachinePinballmapCard locationUrl={LOCATION_URL} />);
    expect(
      screen.queryByTestId("machine-pinballmap-desync")
    ).not.toBeInTheDocument();
  });

  it("shows the 'listed here but absent on PBM' desync copy", () => {
    render(
      <MachinePinballmapCard
        locationUrl={LOCATION_URL}
        desynced
        desyncReason="listed_locally_absent_on_pbm"
      />
    );
    expect(screen.getByTestId("machine-pinballmap-desync")).toHaveTextContent(
      /listed here.*not showing on pinball map/i
    );
  });

  it("shows the 'on PBM but not listed here' desync copy", () => {
    render(
      <MachinePinballmapCard
        locationUrl={LOCATION_URL}
        desynced
        desyncReason="on_pbm_not_listed_locally"
      />
    );
    expect(screen.getByTestId("machine-pinballmap-desync")).toHaveTextContent(
      /on pinball map.*not marked listed here/i
    );
  });

  // `lmx_drifted` self-heals: `reconcileAfterSync` repairs every drifted
  // machine on each hourly cron, using the same predicate that raises the
  // reason. Surfacing it would report a transient nobody can act on, so it is
  // deliberately absent from DESYNC_COPY. This test is the guard — if someone
  // adds the key back, they should be doing it because PP-o355.21 gave the
  // state a real action, not because the blank looked like an oversight.
  it("shows no alert for lmx_drifted, which the hourly sync heals itself", () => {
    render(
      <MachinePinballmapCard
        locationUrl={LOCATION_URL}
        desynced
        desyncReason="lmx_drifted"
      />
    );
    expect(
      screen.queryByTestId("machine-pinballmap-desync")
    ).not.toBeInTheDocument();
  });

  // The desync alerts are informational only while PP-o355.21 is outstanding:
  // the Manage tab's listing control is a placeholder, so any copy naming a
  // control ("verify", "connect") would send the reader somewhere they cannot
  // act. Assert the absence so restoring a call to action is a deliberate
  // change made alongside .21, not an accident.
  it.each([
    "listed_locally_absent_on_pbm",
    "on_pbm_not_listed_locally",
  ] as const)("names no removed control in the %s copy", (reason) => {
    render(
      <MachinePinballmapCard
        locationUrl={LOCATION_URL}
        desynced
        desyncReason={reason}
      />
    );
    expect(
      screen.getByTestId("machine-pinballmap-desync")
    ).not.toHaveTextContent(/\b(verify|connect|reconnect)\b/i);
  });

  it("renders no alert when desynced but the reason has no copy (ok/unlinked)", () => {
    render(
      <MachinePinballmapCard
        locationUrl={LOCATION_URL}
        desynced
        desyncReason="ok"
      />
    );
    expect(
      screen.queryByTestId("machine-pinballmap-desync")
    ).not.toBeInTheDocument();
  });
});

describe("abandoned listings", () => {
  it("names what is still on the public map", () => {
    render(
      <MachinePinballmapCard
        locationUrl={LOCATION_URL}
        abandoned={[{ lmxId: 4471, title: "Godzilla (Pro)" }]}
      />
    );

    expect(
      screen.getByText(/Godzilla \(Pro\) is still on Pinball Map/i)
    ).toBeInTheDocument();
  });

  it("says nothing when there are none", () => {
    render(<MachinePinballmapCard locationUrl={LOCATION_URL} abandoned={[]} />);

    expect(screen.queryByText(/still on Pinball Map/i)).not.toBeInTheDocument();
  });
});
