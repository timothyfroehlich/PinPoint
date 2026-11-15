import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TagTypeExclusiveDialog } from "./TagTypeExclusiveDialog";

const setExclusive = vi.fn();
vi.mock("~/app/(app)/c/tags/actions", () => ({
  setTagTypeExclusiveAction: (input: unknown) => setExclusive(input),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const onOpenChange = vi.fn();

const twoMachines = [
  { initials: "GDZ", name: "Godzilla", tags: ["Color DMD", "Shaker motor"] },
  {
    initials: "MM",
    name: "Medieval Madness",
    tags: ["Shaker motor", "Topper"],
  },
];

function renderDialog(
  props: Partial<React.ComponentProps<typeof TagTypeExclusiveDialog>> = {}
): HTMLElement {
  render(
    <TagTypeExclusiveDialog
      open
      onOpenChange={onOpenChange}
      tagTypeId="features"
      name="Features"
      exclusive={false}
      conflicts={[]}
      {...props}
    />
  );
  return screen.getByRole("alertdialog");
}

/** Spec collections-and-tags 11.7: a tag type's one-per-machine setting. */
describe("TagTypeExclusiveDialog", () => {
  beforeEach(() => {
    setExclusive.mockReset();
    refresh.mockReset();
    onOpenChange.mockReset();
  });

  it("makes a type one per machine and refreshes the page", async () => {
    setExclusive.mockResolvedValue({ ok: true, value: undefined });
    const dialog = renderDialog();

    expect(
      within(dialog).getByText("Make Features one per machine?")
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Make one per machine" })
    );

    expect(setExclusive).toHaveBeenCalledWith({
      tagTypeId: "features",
      exclusive: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(refresh).toHaveBeenCalled();
  });

  it("opens blocked, listing the machines, with only Close", () => {
    const dialog = renderDialog({ conflicts: twoMachines });

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "2 machines have more than one Features tag"
    );
    expect(
      within(dialog).getByRole("link", { name: "Godzilla" })
    ).toHaveAttribute("href", "/m/GDZ");
    expect(
      within(dialog).getByText("Shaker motor, Topper")
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: "Make one per machine" })
    ).not.toBeInTheDocument();
  });

  it("switches to blocked when the action finds a machine in the way", async () => {
    setExclusive.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "1 machine has more than one Features tag",
      meta: { machines: twoMachines.slice(0, 1) },
    });
    const dialog = renderDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Make one per machine" })
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "1 machine has more than one Features tag"
    );
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("always allows more than one on an exclusive type", async () => {
    setExclusive.mockResolvedValue({ ok: true, value: undefined });
    const dialog = renderDialog({
      name: "Location",
      exclusive: true,
      conflicts: twoMachines,
    });

    expect(
      within(dialog).getByText("Allow more than one Location tag per machine?")
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Allow more than one" })
    );
    expect(setExclusive).toHaveBeenCalledWith({
      tagTypeId: "features",
      exclusive: false,
    });
  });
});
