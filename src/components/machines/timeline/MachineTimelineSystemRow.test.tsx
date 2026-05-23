import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MachineTimelineSystemRow } from "./MachineTimelineSystemRow";

describe("MachineTimelineSystemRow", () => {
  it("renders formatted event text with a per-kind icon and no tag pill", () => {
    const { container } = render(
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
    // No tag pill: the icon + verb carry the kind redundantly.
    expect(screen.queryByText("lifecycle")).not.toBeInTheDocument();
    // Icon is rendered as an aria-hidden lucide SVG; the row wrapper exposes
    // the kind via data-event-kind so tests can target the row deterministically.
    const wrapper = container.querySelector(
      '[data-event-kind="machine_added"]'
    );
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector("svg")).not.toBeNull();
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
