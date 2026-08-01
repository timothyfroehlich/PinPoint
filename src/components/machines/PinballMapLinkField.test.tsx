/**
 * Regression guards for what {@link PinballMapLinkField} SUBMITS (PP-o355.19).
 *
 * The picker resolves a stored link asynchronously, so there is a window on
 * mount where its internal `family` is still null while the trigger already
 * displays the stored title. Submitting the picker's resolved state during that
 * window silently unlinked a machine that looked linked — wiping the id, the
 * public listing, the lmx and the cached catalog metadata, with no error. These
 * tests pin the submitted hidden input rather than the rendered label, because
 * the label was never the thing that lied.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PinballMapLinkField } from "./PinballMapLinkField";
import {
  resolvePinballMapLinkAction,
  searchPinballMapFamiliesAction,
} from "~/app/(app)/m/pinballmap-actions";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  resolvePinballMapLinkAction: vi.fn(),
  searchPinballMapFamiliesAction: vi.fn(),
  listPinballMapEditionsAction: vi.fn(),
}));

function submittedLinkId(): string | undefined {
  return document.querySelector<HTMLInputElement>(
    'input[name="pinballmapMachineId"]'
  )?.value;
}

const STORED = {
  defaultMachineId: 42,
  defaultName: "Godzilla (Premium)",
};

describe("PinballMapLinkField — what it submits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([]);
  });

  it("submits the stored link while the preselect is still in flight", () => {
    // Never resolves: models the window between mount and the round trip
    // landing, which is where a "Save details" used to wipe the link.
    vi.mocked(resolvePinballMapLinkAction).mockReturnValue(
      new Promise(() => undefined)
    );

    render(<PinballMapLinkField {...STORED} />);

    expect(submittedLinkId()).toBe("42");
  });

  it("still submits the stored link when the preselect resolves to nothing", async () => {
    // The catalog row was dropped by a refresh. The old code left the field
    // permanently submitting an empty id; now the save carries the stored id and
    // the server rejects it with a real message (CORE-ARCH-012 honest failure).
    vi.mocked(resolvePinballMapLinkAction).mockResolvedValue(null);

    render(<PinballMapLinkField {...STORED} />);

    await waitFor(() => {
      expect(resolvePinballMapLinkAction).toHaveBeenCalled();
    });
    expect(submittedLinkId()).toBe("42");
  });

  it("still submits the stored link when the preselect rejects", async () => {
    vi.mocked(resolvePinballMapLinkAction).mockRejectedValue(
      new Error("network")
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<PinballMapLinkField {...STORED} />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });
    expect(submittedLinkId()).toBe("42");
    consoleError.mockRestore();
  });

  it("submits an empty id once the user marks the machine not-on-PinballMap", async () => {
    // The one case where clearing the stored link IS the user's intent.
    vi.mocked(resolvePinballMapLinkAction).mockResolvedValue(null);
    const user = userEvent.setup();

    render(<PinballMapLinkField {...STORED} />);
    await waitFor(() => {
      expect(resolvePinballMapLinkAction).toHaveBeenCalled();
    });

    // The "Not on Pinball Map" choice only surfaces once a search has actually
    // come up empty, so drive it through that path rather than reaching for it.
    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByPlaceholderText(/medieval madness/i),
      "nothing matches"
    );
    const notOnMap = await screen.findByTestId(
      "pinballmap-not-on-map",
      {},
      {
        timeout: 3000,
      }
    );
    await user.click(notOnMap);

    expect(submittedLinkId()).toBe("");
    expect(
      document.querySelector('input[name="pinballmapExcluded"]')
    ).not.toBeNull();
  });

  it("submits nothing for a machine that was never linked", () => {
    render(<PinballMapLinkField />);
    expect(submittedLinkId()).toBe("");
    expect(resolvePinballMapLinkAction).not.toHaveBeenCalled();
  });
});
