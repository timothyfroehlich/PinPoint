import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemActionsMenu, type ItemMenuSection } from "./ItemActionsMenu";

function labels(menu: HTMLElement): (string | null)[] {
  return within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
}

async function open(name = "Comment actions"): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole("button", { name }));
  return screen.findByRole("menu");
}

/** An item's ⋯ menu (design-bible §26.2, §26.3). */
describe("ItemActionsMenu", () => {
  it("is a borderless ⋯ button named for the item, with a tooltip of the same name", async () => {
    render(
      <ItemActionsMenu
        label="Comment actions"
        description="Sam's comment"
        sections={[[{ key: "edit", label: "Edit", onSelect: vi.fn() }]]}
      />
    );
    const trigger = screen.getByRole("button", {
      name: "Comment actions",
      description: "Sam's comment",
    });
    expect(trigger).toHaveClass(
      "border-transparent",
      "bg-transparent",
      "size-11",
      "md:size-8"
    );
    expect(trigger).not.toHaveAttribute("title");
    await userEvent.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Comment actions"
    );
  });

  it("lists text-only entries, a divider between sections, a destructive section last in red", async () => {
    const sections: ItemMenuSection[] = [
      [
        {
          key: "delete",
          label: "Delete",
          destructive: true,
          onSelect: vi.fn(),
        },
      ],
      [
        { key: "edit", label: "Edit", onSelect: vi.fn() },
        { key: "copy", label: "Duplicate", onSelect: vi.fn() },
      ],
      [],
    ];
    render(<ItemActionsMenu label="Comment actions" sections={sections} />);
    const menu = await open();
    expect(labels(menu)).toEqual(["Edit", "Duplicate", "Delete"]);
    expect(within(menu).getAllByRole("separator")).toHaveLength(1);
    expect(
      within(menu).getByRole("menuitem", { name: "Delete" })
    ).toHaveAttribute("data-variant", "destructive");
    expect(menu.querySelector("svg")).toBeNull();
  });

  it("titles a section and marks the current entry", async () => {
    render(
      <ItemActionsMenu
        label="Issue list actions"
        sections={[
          {
            label: "Show",
            entries: [
              { key: "open", label: "Open issues", href: "/a", current: true },
              { key: "all", label: "All issues", href: "/b" },
            ],
          },
        ]}
      />
    );
    const menu = await open("Issue list actions");
    expect(within(menu).getByText("Show")).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Open issues" })
    ).toHaveAttribute("aria-current", "true");
    expect(
      within(menu).getByRole("menuitem", { name: "All issues" })
    ).not.toHaveAttribute("aria-current");
  });

  it("disables an entry with its reason, and a busy one, without running them", async () => {
    const onSelect = vi.fn();
    render(
      <ItemActionsMenu
        label="Set actions"
        sections={[
          [
            {
              key: "dup",
              label: "Duplicate",
              disabled: true,
              disabledReason: "Save the set first",
              onSelect,
            },
            { key: "export", label: "Export", busy: true, onSelect },
          ],
        ]}
      />
    );
    const menu = await open("Set actions");
    const duplicate = within(menu).getByRole("menuitem", {
      name: /Duplicate/,
      description: "Save the set first",
    });
    expect(duplicate).toHaveAttribute("aria-disabled", "true");
    const busy = within(menu).getByRole("menuitem", { name: "Export" });
    expect(busy).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(duplicate);
    fireEvent.click(busy);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens a submenu of further entries", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ItemActionsMenu
        label="Card actions"
        sections={[
          [
            {
              key: "copy",
              label: "Copy from",
              submenu: [{ key: "a", label: "Card A", onSelect }],
            },
          ],
        ]}
      />
    );
    await user.click(screen.getByRole("button", { name: "Card actions" }));
    const subTrigger = await screen.findByRole("menuitem", {
      name: "Copy from",
    });
    subTrigger.focus();
    await user.keyboard("{ArrowRight}");
    expect(
      await screen.findByRole("menuitem", { name: "Card A" })
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("returns focus to its button on close, unless the entry moved focus itself", async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Editor" />
        <ItemActionsMenu
          label="Comment actions"
          // As the comment menu: non-modal, so focus can leave for the editor.
          modal={false}
          sections={[
            [
              { key: "plain", label: "Plain", onSelect: vi.fn() },
              {
                key: "edit",
                label: "Edit",
                keepsFocus: true,
                onSelect: () => screen.getByRole("textbox").focus(),
              },
            ],
          ]}
        />
      </>
    );
    const trigger = screen.getByRole("button", { name: "Comment actions" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Plain" }));
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Editor" })).toHaveFocus()
    );
  });
});
