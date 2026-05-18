import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MachineTimelineSystemRow } from "./MachineTimelineSystemRow";

describe("MachineTimelineSystemRow", () => {
  it("renders formatted event text and tag", () => {
    render(
      <MachineTimelineSystemRow
        row={{
          id: "s1",
          createdAt: new Date("2026-05-17T12:00:00Z"),
          tag: "lifecycle",
          eventData: { kind: "machine_added" },
        }}
      />
    );
    expect(screen.getByText("Machine added")).toBeInTheDocument();
    expect(screen.getByText("lifecycle")).toBeInTheDocument();
  });

  it("renders an issue link when machineInitials is provided and event has issueNumber", () => {
    render(
      <MachineTimelineSystemRow
        row={{
          id: "s1",
          createdAt: new Date(),
          tag: "issue",
          eventData: {
            kind: "issue_opened",
            issueId: "i1",
            issueNumber: 42,
            openedByName: "Maria",
            title: "Flipper",
          },
        }}
        machineInitials="AAA"
      />
    );
    const link = screen.getByRole("link", { name: /#42/ });
    expect(link).toHaveAttribute("href", "/m/AAA/i/42");
  });

  it("renders plain text (no link) when machineInitials is missing", () => {
    render(
      <MachineTimelineSystemRow
        row={{
          id: "s1",
          createdAt: new Date(),
          tag: "issue",
          eventData: {
            kind: "issue_opened",
            issueId: "i1",
            issueNumber: 42,
            openedByName: "Maria",
            title: "Flipper",
          },
        }}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/opened by Maria/)).toBeInTheDocument();
  });
});
