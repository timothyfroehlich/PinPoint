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
          people: {},
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

  it("resolves the owner name live for owner_set (PP-tv9l)", () => {
    render(
      <MachineTimelineSystemRow
        row={{
          id: "s2",
          createdAt: new Date(),
          tag: "lifecycle",
          eventData: { kind: "owner_set" },
          people: { to_owner: { displayName: "Sam Carter", isInvited: false } },
        }}
      />
    );
    expect(screen.getByText("Owner set to Sam Carter")).toBeInTheDocument();
  });

  it("marks an invited owner with an (invited) suffix", () => {
    render(
      <MachineTimelineSystemRow
        row={{
          id: "s3",
          createdAt: new Date(),
          tag: "lifecycle",
          eventData: { kind: "owner_set" },
          people: { to_owner: { displayName: "Bo Newcomer", isInvited: true } },
        }}
      />
    );
    expect(
      screen.getByText("Owner set to Bo Newcomer (invited)")
    ).toBeInTheDocument();
  });
});
