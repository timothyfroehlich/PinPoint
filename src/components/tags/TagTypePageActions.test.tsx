import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagTypePageActions } from "./TagTypePageActions";

vi.mock("~/app/(app)/c/tags/actions", () => ({
  createTagAction: vi.fn(),
  renameTagTypeAction: vi.fn(),
  deleteTagTypeAction: vi.fn(),
  setTagTypeExclusiveAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

function renderActions(exclusive = false): void {
  render(
    <TagTypePageActions
      tagTypeId="loc"
      name="Location"
      tagCount={2}
      exclusive={exclusive}
      exclusiveConflicts={[]}
    />
  );
}

/** A hand-applied tag type's page actions (spec 11.7–11.9, 11.12). */
describe("TagTypePageActions", () => {
  it("shows Add tag, filled, then ⋯ holding Rename, one per machine, and Delete last", async () => {
    renderActions();
    const addTag = screen.getByRole("button", { name: "Add tag" });
    expect(addTag).toHaveClass("bg-primary");
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual(["Rename…", "Make one per machine", "Delete tag type"]);
    expect(within(menu).getAllByRole("separator")).toHaveLength(1);
    expect(
      within(menu).getByRole("menuitem", { name: "Delete tag type" })
    ).toHaveAttribute("data-variant", "destructive");
  });

  it("offers allowing more than one per machine on a one-per-machine type", async () => {
    renderActions(true);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(
      await screen.findByRole("menuitem", {
        name: "Allow more than one per machine",
      })
    ).toBeInTheDocument();
  });

  it("opens Add tag for this type and returns focus to it", async () => {
    const user = userEvent.setup();
    renderActions();
    const addTag = screen.getByRole("button", { name: "Add tag" });
    await user.click(addTag);
    expect(
      await screen.findByRole("dialog", { name: "Add tag to Location" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(addTag).toHaveFocus();
  });

  it("returns focus to ⋯ when a dialog opened from it closes", async () => {
    const user = userEvent.setup();
    renderActions();
    const more = screen.getByRole("button", { name: "More" });
    await user.click(more);
    await user.click(await screen.findByRole("menuitem", { name: "Rename…" }));
    expect(
      await screen.findByRole("dialog", { name: "Rename tag type" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(more).toHaveFocus();
  });
});
