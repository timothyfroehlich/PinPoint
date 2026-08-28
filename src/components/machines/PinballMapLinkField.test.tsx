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

  it("submits an empty id once the user toggles uncataloged", async () => {
    vi.mocked(resolvePinballMapLinkAction).mockResolvedValue(null);
    const user = userEvent.setup();

    render(<PinballMapLinkField {...STORED} />);
    await waitFor(() => {
      expect(resolvePinballMapLinkAction).toHaveBeenCalled();
    });

    await user.click(screen.getByTestId("pinballmap-source-manual"));

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

/**
 * Hand-entered model identity (PP-3bbr) — the fields for games PinballMap's
 * catalog cannot cover, reached through the Source control (PP-3bbr.3).
 */
describe("PinballMapLinkField — manual model entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([]);
    vi.mocked(resolvePinballMapLinkAction).mockResolvedValue(null);
  });

  async function pickManualEntry(
    user: ReturnType<typeof userEvent.setup>
  ): Promise<void> {
    await user.click(screen.getByTestId("pinballmap-source-manual"));
  }

  function field(name: string): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  }

  it("is absent while the source is Pinball Map", () => {
    render(<PinballMapLinkField machineName="Bordertown" />);
    // The fields must not merely be hidden — a linked machine's save has no
    // business carrying them at all.
    expect(field("modelName")).toBeNull();
    expect(field("manufacturer")).toBeNull();
    expect(field("year")).toBeNull();
  });

  it("opens blank, suggesting the machine's name rather than filling it in", async () => {
    const user = userEvent.setup();
    render(<PinballMapLinkField machineName="Bordertown" />);

    await pickManualEntry(user);

    // Spec 2.4: blank already means "same as the cabinet's name", so
    // pre-filling would only freeze the name as it is today.
    expect(field("modelName")?.value).toBe("");
    expect(field("modelName")?.placeholder).toBe("Bordertown");
  });

  it("shows a stored model name and keeps it across a source round-trip", async () => {
    const user = userEvent.setup();
    render(
      <PinballMapLinkField
        machineName="The Bordertown Cabinet"
        defaultExcluded
        defaultModelName="Bordertown"
      />
    );
    expect(field("modelName")?.value).toBe("Bordertown");

    await user.click(screen.getByTestId("pinballmap-source-catalog"));
    expect(field("modelName")).toBeNull();

    await user.click(screen.getByTestId("pinballmap-source-manual"));
    expect(field("modelName")?.value).toBe("Bordertown");
  });

  it("replaces the catalog picker rather than leaving it live", async () => {
    const user = userEvent.setup();
    render(<PinballMapLinkField machineName="Bordertown" />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    await pickManualEntry(user);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("warns before a catalog title overwrites what was typed", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([
      {
        machineGroupId: null,
        pinballmapMachineId: 77,
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        editionCount: 1,
      },
    ]);
    render(
      <PinballMapLinkField
        defaultExcluded
        defaultModelName="Bordertown"
        defaultManufacturer="homebrew"
      />
    );

    // The picker only exists under the Pinball Map source now, so reaching
    // it means leaving Manual Entry first. What was typed survives that
    // move in state, which is why the pick is still the destructive step.
    await user.click(screen.getByTestId("pinballmap-source-catalog"));
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    // Not applied yet: the DB forbids a linked machine carrying a hand-entered
    // model, so the pick genuinely destroys what was typed. The inputs are
    // already unmounted at this point — leaving Manual Entry took them off
    // screen — so the pending pick is checked on the submitted id instead.
    const confirm = await screen.findByTestId("pinballmap-overwrite-confirm");
    expect(confirm).toHaveTextContent("Medieval Madness");
    expect(submittedLinkId()).toBe("");

    await user.click(
      screen.getByRole("button", { name: /use pinball map's details/i })
    );
    expect(submittedLinkId()).toBe("77");
    expect(field("modelName")).toBeNull();
  });

  it("keeps the entry when the warning is declined", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([
      {
        machineGroupId: null,
        pinballmapMachineId: 77,
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        editionCount: 1,
      },
    ]);
    render(
      <PinballMapLinkField defaultExcluded defaultModelName="Bordertown" />
    );

    // The picker only exists under the Pinball Map source now, so reaching
    // it means leaving Manual Entry first. What was typed survives that
    // move in state, which is why the pick is still the destructive step.
    await user.click(screen.getByTestId("pinballmap-source-catalog"));
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));
    await user.click(
      await screen.findByRole("button", { name: /keep what i entered/i })
    );

    expect(submittedLinkId()).toBe("");
    // Declining leaves the source where the user put it, so the value is proved
    // by going back to Manual Entry and finding it intact.
    await user.click(screen.getByTestId("pinballmap-source-manual"));
    expect(field("modelName")?.value).toBe("Bordertown");
  });

  it("picks a catalog title with no warning when nothing was entered", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([
      {
        machineGroupId: null,
        pinballmapMachineId: 77,
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        editionCount: 1,
      },
    ]);
    render(<PinballMapLinkField defaultExcluded />);

    // The picker only exists under the Pinball Map source now, so reaching
    // it means leaving Manual Entry first. What was typed survives that
    // move in state, which is why the pick is still the destructive step.
    await user.click(screen.getByTestId("pinballmap-source-catalog"));
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    expect(
      screen.queryByTestId("pinballmap-overwrite-confirm")
    ).not.toBeInTheDocument();
    expect(submittedLinkId()).toBe("77");
  });
});

describe("PinballMapLinkField — Source control (PP-3bbr.2 / .3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([]);
    vi.mocked(resolvePinballMapLinkAction).mockResolvedValue(null);
  });

  function field(name: string): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  }

  it("does not inherit catalog manufacturer/year when switching from a linked machine", async () => {
    const user = userEvent.setup();
    render(
      <PinballMapLinkField
        defaultMachineId={42}
        defaultName="Godzilla (Premium)"
        defaultManufacturer="Stern"
        defaultYear={2021}
      />
    );
    await waitFor(() => {
      expect(resolvePinballMapLinkAction).toHaveBeenCalled();
    });

    await user.click(screen.getByTestId("pinballmap-source-manual"));

    // Those two came out of the catalog for the title this machine WAS.
    // Carrying them over would silently relabel Stern's data as the user's.
    expect(field("manufacturer")?.value).toBe("");
    expect(field("year")?.value).toBe("");
  });

  it("fires the confirm once a model name is typed", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([
      {
        machineGroupId: null,
        pinballmapMachineId: 77,
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        editionCount: 1,
      },
    ]);
    render(<PinballMapLinkField machineName="Bordertown" />);

    await user.click(screen.getByTestId("pinballmap-source-manual"));
    const modelInput = field("modelName");
    // Narrowed by a throw rather than `!` or a cast (CORE-TS-007); a missing
    // input here means the source switch did not render, which is the failure.
    if (modelInput === null) throw new Error("model name input did not render");
    await user.type(modelInput, "Custom Game");

    await user.click(screen.getByTestId("pinballmap-source-catalog"));
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    expect(
      screen.getByTestId("pinballmap-overwrite-confirm")
    ).toBeInTheDocument();
  });

  it("picks a catalog title with no confirm when the fields were left blank", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([
      {
        machineGroupId: null,
        pinballmapMachineId: 77,
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        editionCount: 1,
      },
    ]);
    // Blank is a valid Manual Entry save (spec 2.4) — and with nothing typed
    // there is nothing for the confirm to warn about.
    render(<PinballMapLinkField machineName="Bordertown" />);

    await user.click(screen.getByTestId("pinballmap-source-manual"));
    await user.click(screen.getByTestId("pinballmap-source-catalog"));
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    expect(
      screen.queryByTestId("pinballmap-overwrite-confirm")
    ).not.toBeInTheDocument();
    expect(submittedLinkId()).toBe("77");
  });

  it("marks exactly one Source position as chosen, and swaps on click", async () => {
    const user = userEvent.setup();
    render(<PinballMapLinkField />);

    const catalog = screen.getByTestId("pinballmap-source-catalog");
    const manual = screen.getByTestId("pinballmap-source-manual");
    expect(catalog).toHaveAttribute("aria-checked", "true");
    expect(manual).toHaveAttribute("aria-checked", "false");

    await user.click(manual);

    expect(catalog).toHaveAttribute("aria-checked", "false");
    expect(manual).toHaveAttribute("aria-checked", "true");
  });

  it("names the group so both positions read as one choice", () => {
    render(<PinballMapLinkField />);
    expect(
      screen.getByRole("radiogroup", { name: "Source:" })
    ).toBeInTheDocument();
  });
});
