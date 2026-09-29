/**
 * The New Machine page's lineup choice (pinballmap 4.11): what it offers, and
 * what it posts for `createMachineAction` to re-check.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPinballMapTitleIcEligibleAction } from "~/app/(app)/m/pinballmap-actions";
import {
  NewMachinePinballmapFields,
  type NewMachinePinballmapFieldsProps,
} from "./NewMachinePinballmapFields";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  getPinballMapTitleIcEligibleAction: vi.fn(),
}));

const base: NewMachinePinballmapFieldsProps = {
  lineupTitleIds: [],
  pinballmapMachineId: 77,
  presenceStatus: "on_the_floor",
  configured: true,
  locationName: "Austin Pinball Collective",
  canSetIntent: true,
  canAddAfterCreate: true,
};

function posted(name: string): string | null {
  return (
    document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ??
    null
  );
}

describe("NewMachinePinballmapFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPinballMapTitleIcEligibleAction).mockResolvedValue(false);
  });

  it("starts Off, with no add offered", () => {
    render(<NewMachinePinballmapFields {...base} />);

    expect(
      screen.getByRole("radio", { name: "Off the lineup" })
    ).toHaveAttribute("aria-checked", "true");
    expect(posted("pinballmapIntent")).toBe("off");
    expect(
      screen.queryByLabelText("Add to Pinball Map after creating")
    ).not.toBeInTheDocument();
    expect(posted("pbmAddAfterCreate")).toBeNull();
  });

  it("offers the add, ticked, once intent is On", async () => {
    const user = userEvent.setup();
    render(<NewMachinePinballmapFields {...base} />);

    await user.click(screen.getByRole("radio", { name: "On the lineup" }));

    expect(posted("pinballmapIntent")).toBe("on");
    expect(
      screen.getByLabelText("Add to Pinball Map after creating")
    ).toBeChecked();
    expect(posted("pbmAddAfterCreate")).toBe("1");

    // Unticking withdraws the confirmation; the intent still stands.
    await user.click(
      screen.getByLabelText("Add to Pinball Map after creating")
    );
    expect(posted("pbmAddAfterCreate")).toBeNull();
    expect(posted("pinballmapIntent")).toBe("on");
  });

  it("starts On when opened from a lineup entry", () => {
    render(<NewMachinePinballmapFields {...base} initialIntent="on" />);

    expect(
      screen.getByRole("radio", { name: "On the lineup" })
    ).toHaveAttribute("aria-checked", "true");
    expect(posted("pinballmapIntent")).toBe("on");
    expect(
      screen.getByLabelText("Add to Pinball Map after creating")
    ).toBeChecked();
  });

  it("offers no add for a title already on the lineup", () => {
    render(
      <NewMachinePinballmapFields
        {...base}
        initialIntent="on"
        lineupTitleIds={[77]}
      />
    );

    expect(posted("pinballmapIntent")).toBe("on");
    expect(
      screen.queryByLabelText("Add to Pinball Map after creating")
    ).not.toBeInTheDocument();
    expect(posted("pbmAddAfterCreate")).toBeNull();
  });

  it("offers no add to someone who cannot push", async () => {
    const user = userEvent.setup();
    render(<NewMachinePinballmapFields {...base} canAddAfterCreate={false} />);

    await user.click(screen.getByRole("radio", { name: "On the lineup" }));

    expect(
      screen.queryByLabelText("Add to Pinball Map after creating")
    ).not.toBeInTheDocument();
    expect(posted("pbmAddAfterCreate")).toBeNull();
  });

  it("shows Insider Connected only for an eligible title, recording only On", async () => {
    vi.mocked(getPinballMapTitleIcEligibleAction).mockResolvedValue(true);
    const user = userEvent.setup();
    render(<NewMachinePinballmapFields {...base} />);

    const ic = await screen.findByRole("switch", {
      name: "Insider Connected",
    });
    expect(ic).not.toBeChecked();
    // Untouched records no intent at all, not Off.
    expect(posted("pinballmapIcIntent")).toBeNull();

    await user.click(ic);
    expect(posted("pinballmapIcIntent")).toBe("on");
  });

  it("posts no Insider Connected choice for an ineligible title", async () => {
    render(<NewMachinePinballmapFields {...base} />);

    await waitFor(() => {
      expect(getPinballMapTitleIcEligibleAction).toHaveBeenCalledWith(77);
    });
    expect(
      screen.queryByRole("switch", { name: "Insider Connected" })
    ).not.toBeInTheDocument();
    expect(posted("pinballmapIcIntent")).toBeNull();
  });

  it("blocks On while Availability forbids it, and says why", () => {
    render(<NewMachinePinballmapFields {...base} presenceStatus="removed" />);

    expect(screen.getByRole("radio", { name: "On the lineup" })).toBeDisabled();
    expect(screen.getByText(/Blocked by Availability/)).toBeInTheDocument();
    expect(posted("pinballmapIntent")).toBe("off");
  });

  it("asks for a model before offering a lineup choice", () => {
    render(<NewMachinePinballmapFields {...base} pinballmapMachineId={null} />);

    expect(screen.getByText("Lineup choice needs a model")).toBeInTheDocument();
    expect(posted("pinballmapIntent")).toBeNull();
  });
});
