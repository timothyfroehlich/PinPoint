/**
 * The Pinball Map controls must go inert while Details has unsaved edits
 * (PP-3bbr.3). Details owns the Pinball Map link, so acting on those controls
 * mid-edit sets state for a model the pending save is about to replace.
 */

import type React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { DetailsDirtyProvider, useDetailsDirty } from "./details-dirty";
import { PinballmapDirtyGate } from "./pinballmap-dirty-gate";

/** Stands in for the Details form: the only thing that sets the flag. */
function DirtyTrigger(): React.JSX.Element {
  const { setDirty } = useDetailsDirty();
  return (
    <button
      type="button"
      onClick={() => {
        setDirty(true);
      }}
    >
      Edit something
    </button>
  );
}

function renderGate(): void {
  render(
    <DetailsDirtyProvider>
      <DirtyTrigger />
      <PinballmapDirtyGate>
        <button type="button">On the lineup</button>
      </PinballmapDirtyGate>
    </DetailsDirtyProvider>
  );
}

describe("PinballmapDirtyGate", () => {
  it("passes the controls straight through while Details is clean", () => {
    renderGate();
    expect(
      screen.getByRole("button", { name: "On the lineup" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pbm-listing-gated")).not.toBeInTheDocument();
  });

  it("marks the controls inert once Details is dirty", async () => {
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole("button", { name: "Edit something" }));

    // Asserted as the attribute rather than by querying for a vanished role:
    // jsdom parses `inert` but does not implement its effect on the
    // accessibility tree or the tab order, so `queryByRole` still finds the
    // button here even though a real browser would not expose it. The
    // attribute's presence is the part this component is responsible for.
    const gated = screen.getByTestId("pbm-listing-gated");
    expect(gated).toBeInTheDocument();
    expect(
      gated
        .querySelector("[inert]")
        ?.contains(screen.getByRole("button", { name: "On the lineup" }))
    ).toBe(true);
  });

  it("keeps the explanation readable outside the inert subtree", async () => {
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole("button", { name: "Edit something" }));

    // The note names why everything below it is unavailable, so it has to
    // survive the same treatment it is describing.
    expect(screen.getByRole("status")).toHaveTextContent(
      "Unsaved model selection"
    );
  });

  it("throws rather than silently defaulting to clean outside the provider", () => {
    // A silent false would leave the controls live over unsaved edits — the
    // exact bug this exists to prevent, failing invisibly.
    expect(() =>
      render(
        <PinballmapDirtyGate>
          <button type="button">On the lineup</button>
        </PinballmapDirtyGate>
      )
    ).toThrow(/DetailsDirtyProvider/);
  });
});
