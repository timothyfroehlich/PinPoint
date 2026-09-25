import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MachineScanHub } from "./machine-scan-hub";

const machine = {
  initials: "AFM",
  name: "Attack from Mars",
  manufacturer: "Bally",
  year: 1995,
  owner: { name: "Tim F." },
  invitedOwner: null,
  iscoredGameId: "73",
  issues: [
    {
      id: "one",
      severity: "major" as const,
      title: "Right flipper weak",
      createdAt: new Date("2026-09-20T00:00:00Z"),
    },
  ],
  artwork: null,
};

describe("MachineScanHub", () => {
  it("links both player actions and carries the apron source to reporting", () => {
    render(
      <MachineScanHub
        machine={machine}
        scores={[]}
        scoreHref="https://www.iscored.info/?mode=public&user=apc&game=73"
        gameHref="https://www.iscored.info/apc?scrollTo=73"
        fromApron
      />
    );

    expect(screen.getByRole("link", { name: /details/i })).toHaveAttribute(
      "href",
      "/m/AFM"
    );
    expect(
      screen.getByRole("link", { name: /report a problem/i })
    ).toHaveAttribute("href", "/report?machine=AFM&source=apron");
    expect(screen.getByRole("link", { name: /post a score/i })).toHaveAttribute(
      "href",
      expect.stringContaining("game=73")
    );
    expect(screen.getByRole("link", { name: /post a score/i })).toHaveAttribute(
      "target",
      "_blank"
    );
    expect(
      within(screen.getByRole("region", { name: "Top scores" })).queryByText(
        "Add score"
      )
    ).not.toBeInTheDocument();
  });

  it("shows the unlinked and no-issue states without a score action", () => {
    render(
      <MachineScanHub
        machine={{ ...machine, iscoredGameId: null, issues: [] }}
        scores={[]}
        scoreHref={null}
        gameHref={null}
        fromApron={false}
      />
    );

    expect(
      screen.getByText("No iScored game is linked to this machine.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /post a score/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /report a problem/i })
    ).toHaveAttribute("href", "/report?machine=AFM");
    expect(screen.getByText("No open issues")).toBeInTheDocument();
  });

  it("lists every open issue instead of collapsing on short screens", () => {
    render(
      <MachineScanHub
        machine={{
          ...machine,
          issues: [1, 2, 3].map((n) => ({
            id: `i${String(n)}`,
            severity: "minor" as const,
            title: `Issue ${String(n)}`,
            createdAt: new Date("2026-09-20T00:00:00Z"),
          })),
        }}
        scores={[]}
        scoreHref={null}
        gameHref={null}
        fromApron={false}
      />
    );
    const issues = screen.getByRole("region", { name: /open issues/i });
    expect(within(issues).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });

  it("puts the identity over the artwork band with an OPDB credit", () => {
    render(
      <MachineScanHub
        machine={{
          ...machine,
          artwork: {
            url: "https://img.opdb.org/afm.jpg",
            width: 640,
            height: 444,
          },
        }}
        scores={[]}
        scoreHref={null}
        gameHref={null}
        fromApron={false}
      />
    );
    const band = screen.getByTestId("hub-artwork-band");
    expect(
      within(band).getByRole("link", { name: /attack from mars details/i })
    ).toHaveAttribute("href", "/m/AFM");
    expect(within(band).getByRole("link", { name: "OPDB" })).toHaveAttribute(
      "href",
      "https://img.opdb.org/afm.jpg"
    );
  });

  it("has no artwork band without artwork", () => {
    render(
      <MachineScanHub
        machine={machine}
        scores={[]}
        scoreHref={null}
        gameHref={null}
        fromApron={false}
      />
    );
    expect(screen.queryByTestId("hub-artwork-band")).not.toBeInTheDocument();
  });
});
