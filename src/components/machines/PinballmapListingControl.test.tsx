import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import {
  acceptMissingPinballmapListingAction,
  linkPinballmapEntryAction,
  listMachineOnPinballMapAction,
  unlistMachineFromPinballMapAction,
} from "~/app/(app)/m/pinballmap-actions";
import { PinballmapListingControl } from "./PinballmapListingControl";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  acceptMissingPinballmapListingAction: vi.fn(),
  linkPinballmapEntryAction: vi.fn(),
  listMachineOnPinballMapAction: vi.fn(),
  unlistMachineFromPinballMapAction: vi.fn(),
}));

type Props = React.ComponentProps<typeof PinballmapListingControl>;

/** An admin with a provisioned credential — the case with every control armed. */
function renderControl(overrides: Partial<Props> = {}): void {
  render(
    <PinballmapListingControl
      machineId="m-1"
      state="listed"
      listed={true}
      canLink={true}
      canPush={true}
      writeEnabled={true}
      modelName="Medieval Madness"
      {...overrides}
    />
  );
}

function status(): string {
  return screen.getByTestId("pbm-listing-status").textContent ?? "";
}

beforeEach(() => {
  vi.mocked(listMachineOnPinballMapAction).mockResolvedValue({
    ok: true,
    value: { lmxId: 1 },
  });
  vi.mocked(unlistMachineFromPinballMapAction).mockResolvedValue({
    ok: true,
    value: {},
  });
  vi.mocked(acceptMissingPinballmapListingAction).mockResolvedValue({
    ok: true,
    value: {},
  });
  vi.mocked(linkPinballmapEntryAction).mockResolvedValue({
    ok: true,
    value: { lmxId: 1 },
  });
});

describe("PinballmapListingControl", () => {
  describe("derived states", () => {
    it("offers Remove when listed", () => {
      renderControl();
      expect(status()).toContain("Listed on our location's lineup");
      expect(screen.getByTestId("pbm-listing-remove")).toBeInTheDocument();
      expect(screen.queryByTestId("pbm-listing-add")).not.toBeInTheDocument();
    });

    it("offers Add when not listed", () => {
      renderControl({ state: "not_listed", listed: false });
      expect(status()).toContain("Not on our location's lineup");
      expect(screen.getByTestId("pbm-listing-add")).toBeInTheDocument();
    });

    it("offers both Accept and Add back when the listing went missing", () => {
      renderControl({ state: "missing_on_pbm" });
      expect(status()).toContain("someone removed it there");
      expect(screen.getByTestId("pbm-listing-accept")).toBeInTheDocument();
      expect(screen.getByTestId("pbm-listing-add")).toBeInTheDocument();
    });

    it("offers Claim when Pinball Map holds a listing we don't", () => {
      renderControl({ state: "unclaimed_on_pbm", listed: false });
      expect(status()).toContain("isn't holding that listing");
      expect(screen.getByTestId("pbm-listing-claim")).toBeInTheDocument();
    });

    it("explains, and offers nothing, with no model set", () => {
      renderControl({ state: "unmatched", listed: false });
      expect(status()).toContain("No model set yet");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("names the deliberate exclusion rather than reporting 'not listed'", () => {
      // Two different reasons a machine can't be listed, and the reason is the
      // useful half — "not listed" alone reads as something to go fix.
      renderControl({ state: "not_on_pbm", listed: false });
      expect(status()).toContain("Marked as not on Pinball Map");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("admits it has never read the lineup rather than claiming not-listed", () => {
      // The lie the old control told APC's whole fleet (CORE-ARCH-012).
      renderControl({ state: "unsynced", listed: true });
      expect(status()).toContain("hasn't read their lineup yet");
      expect(status()).toContain("Listed on Pinball Map");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("permissions and provisioning", () => {
    it("hides the outbound writes from someone without push", () => {
      renderControl({ canPush: false });
      expect(
        screen.queryByTestId("pbm-listing-remove")
      ).not.toBeInTheDocument();
      // The status still reads — seeing where a machine stands is not the same
      // capability as changing it.
      expect(status()).toContain("Listed on our location's lineup");
    });

    it("hides the outbound writes when no operator credential is provisioned", () => {
      // Absent, not present-and-failing: the write cannot run at all, so a
      // button here could only ever report an error (CORE-ARCH-012).
      renderControl({ writeEnabled: false });
      expect(
        screen.queryByTestId("pbm-listing-remove")
      ).not.toBeInTheDocument();
    });

    it("still offers Accept without a credential, because it writes nothing outward", () => {
      renderControl({ state: "missing_on_pbm", writeEnabled: false });
      expect(screen.getByTestId("pbm-listing-accept")).toBeInTheDocument();
      expect(screen.queryByTestId("pbm-listing-add")).not.toBeInTheDocument();
    });

    it("hides Accept and Claim from someone without link", () => {
      renderControl({ state: "missing_on_pbm", canLink: false });
      expect(
        screen.queryByTestId("pbm-listing-accept")
      ).not.toBeInTheDocument();
    });
  });

  describe("confirms", () => {
    it("does not remove until the confirm is accepted", async () => {
      const user = userEvent.setup();
      renderControl();

      await user.click(screen.getByTestId("pbm-listing-remove"));
      expect(unlistMachineFromPinballMapAction).not.toHaveBeenCalled();

      const dialog = screen.getByTestId("pbm-listing-remove-confirm");
      // The confirm names the game and says what the public sees, so nobody
      // has to remember which machine they were looking at.
      expect(dialog).toHaveTextContent("Medieval Madness");
      expect(dialog).toHaveTextContent("pinballmap.com");

      await user.click(
        within(dialog).getByRole("button", { name: "Remove from Pinball Map" })
      );
      expect(unlistMachineFromPinballMapAction).toHaveBeenCalledOnce();
    });

    it("carries no trailing ellipsis on the button labels", () => {
      // A confirm dialog is not the "more input required" an ellipsis promises
      // (Tim, 2026-08-12).
      renderControl();
      expect(screen.getByTestId("pbm-listing-remove")).toHaveTextContent(
        /Remove from Pinball Map$/
      );
      renderControl({ state: "not_listed", listed: false });
      expect(screen.getAllByTestId("pbm-listing-add")[0]).toHaveTextContent(
        /Add to Pinball Map$/
      );
    });

    it("claims a listing with no confirm, because nothing is sent to them", async () => {
      const user = userEvent.setup();
      renderControl({ state: "unclaimed_on_pbm", listed: false });
      await user.click(screen.getByTestId("pbm-listing-claim"));
      expect(linkPinballmapEntryAction).toHaveBeenCalledOnce();
    });
  });

  it("surfaces a failed action instead of looking like nothing happened", async () => {
    const user = userEvent.setup();
    vi.mocked(unlistMachineFromPinballMapAction).mockResolvedValue({
      ok: false,
      code: "PBM_REJECTED",
      message: "Pinball Map rejected the removal.",
    });
    renderControl();

    await user.click(screen.getByTestId("pbm-listing-remove"));
    await user.click(
      within(screen.getByTestId("pbm-listing-remove-confirm")).getByRole(
        "button",
        { name: "Remove from Pinball Map" }
      )
    );

    expect(await screen.findByTestId("pbm-listing-error")).toHaveTextContent(
      "Pinball Map rejected the removal."
    );
  });
});
