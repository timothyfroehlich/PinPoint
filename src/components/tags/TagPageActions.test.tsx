import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TagMerge, TagMove } from "~/app/(app)/c/tags/[type]/[slug]/_data";
import { TagPageActions } from "./TagPageActions";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("~/app/(app)/c/tags/actions", () => ({
  deleteTagAction: vi.fn(),
  renameTagAction: vi.fn(),
  setTagMachinesAction: vi.fn(),
  moveTagAction: vi.fn(),
  mergeTagAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const editing = {
  editor: {
    tagId: "t1",
    tagName: "Storage",
    context: null,
    allMachines: [],
    currentIds: [],
    otherTagByMachine: {},
  },
  parentHref: "/c/tags",
  move: {
    tagId: "t1",
    tagName: "Storage",
    typeId: null,
    typeName: null,
    machineCount: 0,
    destinations: [],
  } satisfies TagMove,
  merge: {
    tagId: "t1",
    tagName: "Storage",
    typeName: null,
    machineCount: 0,
    groups: [],
  } satisfies TagMerge,
};

/** collections-and-tags 4.14–4.18 on a tag's page. */
describe("TagPageActions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    toast.success.mockReset();
  });

  it("Share copies the tag page's address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(
      <TagPageActions
        tagHref="/c/tags/location/storage"
        settingsSheetsHref="/m/settings-sheets?m=AFM"
        editing={null}
      />
    );
    await user.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/c/tags/location/storage`
      )
    );
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  it("shows a viewer Share and Print settings sheets as buttons, with no ⋯ (list-views §3.7)", () => {
    render(
      <TagPageActions
        tagHref="/c/tags/location/storage"
        settingsSheetsHref="/m/settings-sheets?m=AFM"
        editing={null}
      />
    );
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Print settings sheets" })
    ).toHaveAttribute("href", "/m/settings-sheets?m=AFM");
    expect(
      screen.queryByRole("button", { name: "More" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Print" })
    ).not.toBeInTheDocument();
  });

  it("holds a hand-applied tag's editing, Print settings sheets, and Delete last in ⋯", async () => {
    render(
      <TagPageActions
        tagHref="/c/tags/location/storage"
        settingsSheetsHref="/m/settings-sheets?m=AFM"
        editing={editing}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual([
      "Edit machines…",
      "Rename…",
      "Move to another tag type…",
      "Merge into another tag…",
      "Print settings sheets",
      "Delete tag",
    ]);
    expect(within(menu).getAllByRole("separator")).toHaveLength(2);
    expect(
      within(menu).getByRole("menuitem", { name: "Delete tag" })
    ).toHaveAttribute("data-variant", "destructive");
  });

  it("returns focus to ⋯ when a dialog opened from ⋯ closes", async () => {
    const user = userEvent.setup();
    render(
      <TagPageActions
        tagHref="/c/tags/location/storage"
        settingsSheetsHref="/m/settings-sheets?m=AFM"
        editing={editing}
      />
    );
    const more = screen.getByRole("button", { name: "More" });
    more.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(
      await screen.findByRole("dialog", { name: "Rename tag" })
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(more).toHaveFocus();
  });
});
