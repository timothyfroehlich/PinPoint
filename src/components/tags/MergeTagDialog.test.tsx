import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TagMerge } from "~/app/(app)/c/tags/[type]/[slug]/_data";
import { MergeTagDialog } from "./MergeTagDialog";

const mergeTag = vi.fn();
vi.mock("~/app/(app)/c/tags/actions", () => ({
  mergeTagAction: (input: unknown) => mergeTag(input),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const merge: TagMerge = {
  tagId: "arcade",
  tagName: "Arcade wall",
  typeName: null,
  machineCount: 6,
  groups: [
    {
      typeName: "Features",
      exclusive: false,
      targets: [
        {
          id: "topper",
          name: "Topper",
          machineCount: 4,
          alreadyCount: 2,
          conflicts: [],
        },
        {
          id: "shaker",
          name: "Shaker motor",
          machineCount: 1,
          alreadyCount: 0,
          conflicts: [],
        },
      ],
    },
    {
      typeName: "Location",
      exclusive: true,
      targets: [
        {
          id: "front",
          name: "Front room",
          machineCount: 9,
          alreadyCount: 0,
          conflicts: [
            { initials: "HD", name: "Hot Dog", tags: ["Back room"] },
            { initials: "SC", name: "Seawitch", tags: ["Back room"] },
          ],
        },
      ],
    },
    {
      typeName: null,
      exclusive: false,
      targets: [
        {
          id: "kids",
          name: "Kid-friendly",
          machineCount: 3,
          alreadyCount: 1,
          conflicts: [],
        },
      ],
    },
  ],
};

function renderDialog(): HTMLElement {
  render(<MergeTagDialog open onOpenChange={vi.fn()} merge={merge} />);
  return screen.getByRole("dialog");
}

/** Spec collections-and-tags 11.17–11.19: merging one tag into another. */
describe("MergeTagDialog", () => {
  beforeEach(() => {
    mergeTag.mockReset();
    push.mockReset();
  });

  it("offers every other tag by tag type, and waits for a choice", () => {
    const dialog = renderDialog();
    expect(
      within(dialog).getByText("No type · 6 machines")
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Merge into")).toHaveDisplayValue(
      "Choose a tag"
    );
    expect(
      within(dialog)
        .getAllByRole("group")
        .map((group) => group.getAttribute("label"))
    ).toEqual(["Features", "Location · one per machine", "Other tags"]);
    expect(
      within(dialog).getByRole("option", { name: "Shaker motor · 1 machine" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Merge tags" })
    ).toBeDisabled();
  });

  it("says what the merge does once a tag is chosen", async () => {
    const dialog = renderDialog();
    const select = within(dialog).getByLabelText("Merge into");
    await userEvent.selectOptions(select, "Topper · 4 machines");
    expect(
      within(dialog).getByText(
        "All 6 machines will be tagged Topper (2 already are). Arcade wall is deleted, and links to its page open Topper. This cannot be undone."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Merge tags" })
    ).toBeEnabled();

    await userEvent.selectOptions(select, "Shaker motor · 1 machine");
    expect(
      within(dialog).getByText(/^All 6 machines will be tagged Shaker motor\. /)
    ).toBeInTheDocument();
  });

  it("blocks a tag whose exclusive type would double machines up", async () => {
    const dialog = renderDialog();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Merge into"),
      "Front room · 9 machines"
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "2 machines would hold two Location tags"
    );
    expect(
      within(dialog).getByRole("link", { name: "Seawitch" })
    ).toHaveAttribute("href", "/m/SC");
    expect(
      within(dialog).getByText(
        "Remove their Location tags first, or pick another tag."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Merge tags" })
    ).toBeDisabled();
  });

  it("merges the tag and opens the target's page", async () => {
    mergeTag.mockResolvedValue({
      ok: true,
      value: { href: "/c/tags/other/kid-friendly" },
    });
    const dialog = renderDialog();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Merge into"),
      "Kid-friendly · 3 machines"
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Merge tags" })
    );

    expect(mergeTag).toHaveBeenCalledWith({
      tagId: "arcade",
      targetTagId: "kids",
    });
    expect(push).toHaveBeenCalledWith("/c/tags/other/kid-friendly");
  });

  it("shows the action's refusal and clears it on a new pick", async () => {
    mergeTag.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "1 machine would hold two Features tags",
    });
    const dialog = renderDialog();
    const select = within(dialog).getByLabelText("Merge into");
    await userEvent.selectOptions(select, "Topper · 4 machines");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Merge tags" })
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "1 machine would hold two Features tags"
    );
    expect(
      within(dialog).getByRole("button", { name: "Merge tags" })
    ).toBeDisabled();
    expect(push).not.toHaveBeenCalled();

    await userEvent.selectOptions(select, "Kid-friendly · 3 machines");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });
});
