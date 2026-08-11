import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  MachinePinballmapCard,
  type MachinePinballmapCardProps,
} from "./machine-pinballmap-card";

const LOCATION_URL = "https://pinballmap.com/map/?by_location_id=26454";

/**
 * Every case needs the machine's own PBM standing, and almost none of them
 * care what it is — the status line is the subject of exactly one describe
 * block below. Defaulting it here keeps the desync and abandoned cases about
 * their own alert.
 */
function renderCard(overrides: Partial<MachinePinballmapCardProps> = {}): void {
  render(
    <MachinePinballmapCard
      locationUrl={LOCATION_URL}
      linkedTitle="Medieval Madness"
      listed
      {...overrides}
    />
  );
}

describe("MachinePinballmapCard", () => {
  it("renders a public link back to the PBM location (CORE-PBM-001)", () => {
    renderCard();
    const link = screen.getByTestId("machine-pinballmap-link");
    expect(link).toHaveTextContent(/view on pinball map/i);
    expect(link).toHaveAttribute("href", LOCATION_URL);
    expect(link).toHaveAttribute("target", "_blank");
    // noopener noreferrer to match the codebase convention for target="_blank".
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows no desync alert when in sync (default)", () => {
    renderCard();
    expect(
      screen.queryByTestId("machine-pinballmap-desync")
    ).not.toBeInTheDocument();
  });

  it("shows the 'listed here but absent on PBM' desync copy", () => {
    renderCard({
      desynced: true,
      desyncReason: "listed_locally_absent_on_pbm",
    });
    expect(screen.getByTestId("machine-pinballmap-desync")).toHaveTextContent(
      /listed here.*not showing on pinball map/i
    );
  });

  it("shows the 'on PBM but not listed here' desync copy", () => {
    renderCard({ desynced: true, desyncReason: "on_pbm_not_listed_locally" });
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
    renderCard({ desynced: true, desyncReason: "lmx_drifted" });
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
    renderCard({ desynced: true, desyncReason: reason });
    expect(
      screen.getByTestId("machine-pinballmap-desync")
    ).not.toHaveTextContent(/\b(verify|connect|reconnect)\b/i);
  });

  it("renders no alert when desynced but the reason has no copy (ok/unlinked)", () => {
    renderCard({ desynced: true, desyncReason: "ok" });
    expect(
      screen.queryByTestId("machine-pinballmap-desync")
    ).not.toBeInTheDocument();
  });
});

// The machine's own standing, stated before any alert. It exists because the
// abandoned-listing notice necessarily names a DIFFERENT title than this
// machine's — without this line, the Addams Family page talks about Godzilla
// and reads as a bug rather than a task.
describe("current listing status", () => {
  it("states the title a listed machine holds", () => {
    renderCard({ linkedTitle: "Medieval Madness", listed: true });
    expect(screen.getByTestId("machine-pinballmap-status")).toHaveTextContent(
      "Listed as Medieval Madness."
    );
  });

  it("distinguishes linked-but-not-listed from listed", () => {
    renderCard({ linkedTitle: "Godzilla (Premium)", listed: false });
    expect(screen.getByTestId("machine-pinballmap-status")).toHaveTextContent(
      "Linked as Godzilla (Premium) · not listed."
    );
  });

  // Retitling to "no PinballMap link" is one of the ways a machine abandons an
  // entry, so a null title has to coexist with the notice below.
  it("says so when the machine has no PBM link at all", () => {
    renderCard({ linkedTitle: null, listed: false });
    expect(screen.getByTestId("machine-pinballmap-status")).toHaveTextContent(
      "Not linked to a Pinball Map title."
    );
  });
});

describe("abandoned listings", () => {
  it("names what is still on the public map", () => {
    renderCard({ abandoned: [{ lmxId: 4471, title: "Godzilla (Pro)" }] });

    expect(
      screen.getByTestId("machine-pinballmap-abandoned")
    ).toHaveTextContent("Previous listing still live: “Godzilla (Pro)”");
  });

  // The quotes are load-bearing, not decoration: they mark the odd title as a
  // reference to something named elsewhere rather than as this machine's own
  // wrong data. An id is not something a person named, so it stays unquoted.
  it("names the raw entry id, unquoted, when the catalog lost the title", () => {
    renderCard({ abandoned: [{ lmxId: 4471, title: null }] });

    const alert = screen.getByTestId("machine-pinballmap-abandoned");
    expect(alert).toHaveTextContent(
      "Previous listing still live: Pinball Map entry #4471"
    );
    expect(alert).not.toHaveTextContent("“");
  });

  it("names every entry when a machine abandoned more than one", () => {
    renderCard({
      abandoned: [
        { lmxId: 4471, title: "Godzilla (Pro)" },
        { lmxId: 4472, title: "Godzilla (Premium)" },
      ],
    });

    const alert = screen.getByTestId("machine-pinballmap-abandoned");
    expect(alert).toHaveTextContent("“Godzilla (Pro)”");
    expect(alert).toHaveTextContent("“Godzilla (Premium)”");
  });

  // Progressive disclosure, not a tooltip: it has to survive a touch device and
  // stay open while read. Native <details> also means no client component.
  it("explains who can remove the entry, behind a disclosure", () => {
    renderCard({ abandoned: [{ lmxId: 4471, title: "Godzilla (Pro)" }] });

    expect(
      screen.getByText(/why is this here\?/i).closest("details")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/only someone with a pinballmap\.com account/i)
    ).toBeInTheDocument();
  });

  it("says nothing when there are none", () => {
    renderCard({ abandoned: [] });

    expect(
      screen.queryByTestId("machine-pinballmap-abandoned")
    ).not.toBeInTheDocument();
  });
});
