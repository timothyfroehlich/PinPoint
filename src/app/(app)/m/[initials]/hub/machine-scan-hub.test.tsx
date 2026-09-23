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
    expect(screen.getAllByText("No open issues")).toHaveLength(2);
  });
});
