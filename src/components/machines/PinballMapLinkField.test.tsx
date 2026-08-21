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

    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));

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
 * Hand-entered model identity (PP-3bbr, folded into PP-o355.21) — the panel for
 * games PinballMap's catalog cannot cover.
 */
describe("PinballMapLinkField — manual model entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([]);
    vi.mocked(resolvePinballMapLinkAction).mockResolvedValue(null);
  });

  async function toggleUncataloged(
    user: ReturnType<typeof userEvent.setup>
  ): Promise<void> {
    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));
  }

  function field(name: string): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  }

  it("is absent until the uncataloged toggle is on", () => {
    render(<PinballMapLinkField machineName="Bordertown" />);
    expect(
      screen.queryByTestId("pinballmap-manual-model")
    ).not.toBeInTheDocument();
    // The fields must not merely be hidden — a linked machine's save has no
    // business carrying them at all.
    expect(field("modelName")).toBeNull();
  });

  it("opens seeded from the machine's name", async () => {
    const user = userEvent.setup();
    render(<PinballMapLinkField machineName="Bordertown" />);

    await toggleUncataloged(user);

    expect(screen.getByTestId("pinballmap-manual-model")).toBeInTheDocument();
    expect(field("modelName")?.value).toBe("Bordertown");
  });

  it("leaves a stored model name alone rather than re-seeding it", async () => {
    const user = userEvent.setup();
    render(
      <PinballMapLinkField
        machineName="The Bordertown Cabinet"
        defaultExcluded
        defaultModelName="Bordertown"
      />
    );
    expect(field("modelName")?.value).toBe("Bordertown");

    // Toggle off and back on — stored value survives the round-trip,
    // not re-seeded from the (different) machine name.
    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));
    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));
    expect(field("modelName")?.value).toBe("Bordertown");
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

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    // Not applied yet: the DB forbids a linked machine carrying a hand-entered
    // model, so the pick genuinely destroys what is on screen.
    const confirm = await screen.findByTestId("pinballmap-overwrite-confirm");
    expect(confirm).toHaveTextContent("Medieval Madness");
    expect(field("modelName")?.value).toBe("Bordertown");

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

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));
    await user.click(
      await screen.findByRole("button", { name: /keep what i entered/i })
    );

    expect(field("modelName")?.value).toBe("Bordertown");
    expect(submittedLinkId()).toBe("");
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

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    expect(
      screen.queryByTestId("pinballmap-overwrite-confirm")
    ).not.toBeInTheDocument();
    expect(submittedLinkId()).toBe("77");
  });
});

describe("PinballMapLinkField — uncataloged toggle (PP-3bbr.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchPinballMapFamiliesAction).mockResolvedValue([]);
    vi.mocked(resolvePinballMapLinkAction).mockResolvedValue(null);
  });

  function field(name: string): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  }

  it("does not inherit catalog manufacturer/year when toggling from a linked machine", async () => {
    const user = userEvent.setup();
    render(
      <PinballMapLinkField
        defaultMachineId={42}
        defaultName="Godzilla (Premium)"
        defaultManufacturer="Stern"
        defaultYear={2021}
      />
    );

    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));

    expect(field("manufacturer")?.value).toBe("");
    expect(field("year")?.value).toBe("");
  });

  it("preserves stored hand-entered data across an off/on toggle cycle", async () => {
    const user = userEvent.setup();
    render(
      <PinballMapLinkField
        defaultExcluded
        defaultModelName="Bordertown"
        defaultManufacturer="homebrew"
        defaultYear={2019}
      />
    );

    expect(field("manufacturer")?.value).toBe("homebrew");
    expect(field("year")?.value).toBe("2019");

    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));
    expect(
      screen.queryByTestId("pinballmap-manual-model")
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));
    expect(field("manufacturer")?.value).toBe("homebrew");
    expect(field("year")?.value).toBe("2019");
  });

  it("does not fire the confirm when only the seeded model name is present", async () => {
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

    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));
    expect(field("modelName")?.value).toBe("Bordertown");

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    expect(
      screen.queryByTestId("pinballmap-overwrite-confirm")
    ).not.toBeInTheDocument();
    expect(submittedLinkId()).toBe("77");
  });

  it("fires the confirm once the seeded name is edited", async () => {
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

    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));
    const modelInput = field("modelName");
    expect(modelInput).not.toBeNull();
    await user.clear(modelInput!);
    await user.type(modelInput!, "Custom Game");

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/medieval madness/i), "med");
    await user.click(await screen.findByText("Medieval Madness"));

    expect(
      screen.getByTestId("pinballmap-overwrite-confirm")
    ).toBeInTheDocument();
  });

  it("flips the caption from 'source: Pinball Map' to 'Uncataloged game'", async () => {
    const user = userEvent.setup();
    render(<PinballMapLinkField />);

    expect(screen.getByText("source: Pinball Map")).toBeInTheDocument();
    expect(screen.queryByText("Uncataloged game")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("pinballmap-uncataloged-toggle"));

    expect(screen.queryByText("source: Pinball Map")).not.toBeInTheDocument();
    expect(screen.getByText("Uncataloged game")).toBeInTheDocument();
  });
});
