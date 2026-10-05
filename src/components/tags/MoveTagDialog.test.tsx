import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TagMove } from "~/app/(app)/c/tags/[type]/[slug]/_data";
import { MoveTagDialog } from "./MoveTagDialog";

const moveTag = vi.fn();
vi.mock("~/app/(app)/c/tags/actions", () => ({
  moveTagAction: (input: unknown) => moveTag(input),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const open = { exclusive: false, nameTaken: false, conflicts: [] };
const move: TagMove = {
  tagId: "arcade",
  tagName: "Arcade wall",
  typeId: "location",
  typeName: "Location",
  machineCount: 6,
  destinations: [
    { ...open, id: null, name: "" },
    { ...open, id: "features", name: "Features" },
    { ...open, id: "location", name: "Location", exclusive: true },
    {
      ...open,
      id: "tournament",
      name: "Tournament",
      exclusive: true,
      conflicts: [
        { initials: "HD", name: "Hot Dog", tags: ["Casual only"] },
        { initials: "SC", name: "Seawitch", tags: ["Casual only"] },
      ],
    },
    { ...open, id: "zone", name: "Zone", nameTaken: true },
  ],
};

function renderDialog(): HTMLElement {
  render(<MoveTagDialog open onOpenChange={vi.fn()} move={move} />);
  return screen.getByRole("dialog");
}

/** Spec collections-and-tags 11.16: moving a tag between tag types. */
describe("MoveTagDialog", () => {
  beforeEach(() => {
    moveTag.mockReset();
    push.mockReset();
  });

  it("starts at the current type, which cannot be picked", () => {
    const dialog = renderDialog();
    expect(
      within(dialog).getByText("Now in Location · 6 machines")
    ).toBeInTheDocument();
    const select = within(dialog).getByLabelText("Tag type");
    expect(select).toHaveDisplayValue("Location · one per machine (current)");
    expect(
      within(dialog).getByRole("option", {
        name: "Location · one per machine (current)",
      })
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Move tag" })
    ).toBeDisabled();
  });

  it("blocks a type that already has the tag's name", async () => {
    const dialog = renderDialog();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Tag type"),
      "zone"
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Zone already has a tag named Arcade wall"
    );
    expect(
      within(dialog).getByRole("button", { name: "Move tag" })
    ).toBeDisabled();
  });

  it("blocks an exclusive type that would double machines up", async () => {
    const dialog = renderDialog();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Tag type"),
      "Tournament · one per machine"
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "2 machines would hold two Tournament tags"
    );
    expect(
      within(dialog).getByRole("link", { name: "Hot Dog" })
    ).toHaveAttribute("href", "/m/HD");
    expect(
      within(dialog).getByText(
        "Remove their Tournament tags first, or pick another tag type."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Move tag" })
    ).toBeDisabled();
  });

  it("moves the tag and opens its new page", async () => {
    moveTag.mockResolvedValue({
      ok: true,
      value: { href: "/c/tags/other/arcade-wall" },
    });
    const dialog = renderDialog();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Tag type"),
      "No type"
    );
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Move tag" })
    );

    expect(moveTag).toHaveBeenCalledWith({ tagId: "arcade", tagTypeId: null });
    expect(push).toHaveBeenCalledWith("/c/tags/other/arcade-wall");
  });

  it("shows the action's refusal and clears it on a new pick", async () => {
    moveTag.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "Features already has a tag named Arcade wall",
    });
    const dialog = renderDialog();
    const select = within(dialog).getByLabelText("Tag type");
    await userEvent.selectOptions(select, "features");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Move tag" })
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Features already has a tag named Arcade wall"
    );
    expect(
      within(dialog).getByRole("button", { name: "Move tag" })
    ).toBeDisabled();
    expect(push).not.toHaveBeenCalled();

    await userEvent.selectOptions(select, "No type");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });
});
