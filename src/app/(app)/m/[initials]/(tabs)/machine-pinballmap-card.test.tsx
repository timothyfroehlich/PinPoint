import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MachinePinballmapCard } from "./machine-pinballmap-card";

const LOCATION_URL = "https://pinballmap.com/map/?by_location_id=26454";

describe("MachinePinballmapCard", () => {
  it("renders a public link back to the PBM location (CORE-PBM-001)", () => {
    render(<MachinePinballmapCard locationUrl={LOCATION_URL} />);
    const link = screen.getByTestId("machine-pinballmap-link");
    expect(link).toHaveTextContent(/view on pinballmap/i);
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
      /listed here but not showing on pinballmap/i
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
      /on pinballmap but not marked listed here/i
    );
  });

  it("shows the 'link moved' desync copy", () => {
    render(
      <MachinePinballmapCard
        locationUrl={LOCATION_URL}
        desynced
        desyncReason="lmx_drifted"
      />
    );
    expect(screen.getByTestId("machine-pinballmap-desync")).toHaveTextContent(
      /pinballmap link moved/i
    );
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
