import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MachinePinballmapCard } from "./machine-pinballmap-card";
import type { PbmMachineStatus } from "~/lib/pinballmap/status";

const LOCATION_URL = "https://pinballmap.com/map/?by_location_id=26454";

function status(overrides: Partial<PbmMachineStatus> = {}): PbmMachineStatus {
  return { listed: true, lastCommentIso: null, desynced: false, ...overrides };
}

describe("MachinePinballmapCard", () => {
  it("always renders a public link back to the PBM location (CORE-PBM-001)", () => {
    render(
      <MachinePinballmapCard linkState="unlinked" locationUrl={LOCATION_URL} />
    );
    const link = screen.getByTestId("machine-pinballmap-link");
    expect(link).toHaveTextContent(/view on pinballmap/i);
    expect(link).toHaveAttribute("href", LOCATION_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows a Listed pill when the machine is listed", () => {
    render(
      <MachinePinballmapCard
        linkState="linked"
        status={status({ listed: true })}
        locationUrl={LOCATION_URL}
      />
    );
    expect(
      screen.getByTestId("machine-pinballmap-listed-pill")
    ).toHaveTextContent("Listed");
    expect(
      screen.queryByTestId("machine-pinballmap-desync")
    ).not.toBeInTheDocument();
  });

  it("shows a Not listed pill when the machine is not listed", () => {
    render(
      <MachinePinballmapCard
        linkState="linked"
        status={status({ listed: false })}
        locationUrl={LOCATION_URL}
      />
    );
    expect(
      screen.getByTestId("machine-pinballmap-listed-pill")
    ).toHaveTextContent("Not listed");
  });

  it("warns with precise copy when listed but off the floor", () => {
    render(
      <MachinePinballmapCard
        linkState="linked"
        status={status({ listed: true, desynced: true })}
        locationUrl={LOCATION_URL}
      />
    );
    expect(screen.getByTestId("machine-pinballmap-desync")).toHaveTextContent(
      /listed on pinballmap but off the floor/i
    );
  });

  it("warns with precise copy when on the floor but not listed", () => {
    render(
      <MachinePinballmapCard
        linkState="linked"
        status={status({ listed: false, desynced: true })}
        locationUrl={LOCATION_URL}
      />
    );
    expect(screen.getByTestId("machine-pinballmap-desync")).toHaveTextContent(
      /on the floor but not listed on pinballmap/i
    );
  });

  it("renders the last PBM comment date when present", () => {
    render(
      <MachinePinballmapCard
        linkState="linked"
        status={status({ lastCommentIso: "2026-05-01T12:00:00Z" })}
        locationUrl={LOCATION_URL}
      />
    );
    expect(screen.getByText(/last comment/i)).toBeInTheDocument();
  });

  it("shows a pending state when linked but never synced (null status)", () => {
    render(
      <MachinePinballmapCard
        linkState="linked"
        status={null}
        locationUrl={LOCATION_URL}
      />
    );
    expect(screen.getByText(/pending next sync/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId("machine-pinballmap-listed-pill")
    ).not.toBeInTheDocument();
  });

  it("shows the excluded state with an optional reason", () => {
    render(
      <MachinePinballmapCard
        linkState="excluded"
        excludedReason="Home-use only"
        locationUrl={LOCATION_URL}
      />
    );
    expect(screen.getByText(/marked not on pinballmap/i)).toBeInTheDocument();
    expect(screen.getByText("Home-use only")).toBeInTheDocument();
    expect(
      screen.queryByTestId("machine-pinballmap-listed-pill")
    ).not.toBeInTheDocument();
  });

  it("shows the unlinked state", () => {
    render(
      <MachinePinballmapCard linkState="unlinked" locationUrl={LOCATION_URL} />
    );
    expect(screen.getByText(/not linked to pinballmap/i)).toBeInTheDocument();
  });
});
