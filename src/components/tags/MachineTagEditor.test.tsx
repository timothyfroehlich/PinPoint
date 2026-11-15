import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TagEditorGroup } from "~/lib/tags/editor";
import { MachineTagEditor } from "./MachineTagEditor";

const setMachineTag = vi.fn();
const createTag = vi.fn();
vi.mock("~/app/(app)/c/tags/actions", () => ({
  setMachineTagAction: (input: unknown) => setMachineTag(input),
  createTagAction: (input: unknown) => createTag(input),
}));

const MACHINE = "11111111-1111-4111-8111-111111111111";

const GROUPS: TagEditorGroup[] = [
  {
    typeId: "features",
    name: "Features",
    exclusive: false,
    tags: [
      { id: "shaker", name: "Shaker motor", machineCount: 4 },
      { id: "topper", name: "Topper", machineCount: 3 },
    ],
  },
  {
    typeId: "location",
    name: "Location",
    exclusive: true,
    tags: [
      { id: "back", name: "Back room", machineCount: 2 },
      { id: "front", name: "Front room", machineCount: 5 },
    ],
  },
  {
    typeId: null,
    name: "Other tags",
    exclusive: false,
    tags: [{ id: "kid", name: "Kid-friendly", machineCount: 2 }],
  },
];

const saved = { ok: true, value: undefined };

async function openEditor({
  canCreate = true,
  groups = GROUPS,
  applied = ["topper", "front"],
}: {
  canCreate?: boolean;
  groups?: TagEditorGroup[];
  applied?: string[];
} = {}): Promise<HTMLElement> {
  render(
    <MachineTagEditor
      machineId={MACHINE}
      groups={groups}
      appliedTagIds={applied}
      canCreate={canCreate}
      countsThisMachine
    />
  );
  // Both the phone (sheet) and desktop (popover) triggers render; CSS shows
  // one. They open the same panel.
  const [trigger] = screen.getAllByRole("button", { name: "Edit tags" });
  if (!trigger) throw new Error("no Edit tags trigger");
  await userEvent.click(trigger);
  return screen.getByRole("dialog", { name: "Edit tags" });
}

/** Spec collections-and-tags 11.4–11.6, 11.10, 11.15: the machine page editor. */
describe("MachineTagEditor", () => {
  beforeEach(() => {
    setMachineTag.mockReset();
    createTag.mockReset();
  });

  it("saves each checkbox click and counts this machine", async () => {
    setMachineTag.mockResolvedValue(saved);
    const panel = await openEditor();

    await userEvent.click(
      within(panel).getByRole("checkbox", { name: /^Shaker motor/ })
    );

    expect(setMachineTag).toHaveBeenCalledWith({
      machineId: MACHINE,
      tagId: "shaker",
      applied: true,
    });
    expect(await within(panel).findByRole("status")).toHaveTextContent("Saved");
    expect(
      within(panel).getByRole("checkbox", { name: "Shaker motor, 5 machines" })
    ).toBeChecked();
  });

  it("puts a failed save back and says why", async () => {
    setMachineTag.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      message: "Not allowed",
    });
    const panel = await openEditor();

    await userEvent.click(
      within(panel).getByRole("checkbox", { name: /^Topper/ })
    );

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "Not allowed"
    );
    // The alert can commit before the transition that undoes the optimistic
    // change, so wait for the rollback itself.
    expect(
      await within(panel).findByRole("checkbox", { name: "Topper, 3 machines" })
    ).toBeChecked();
  });

  it("shows an exclusive type as one choice: picking a tag replaces the other, None clears it", async () => {
    setMachineTag.mockResolvedValue(saved);
    const panel = await openEditor();
    const location = within(panel).getByRole("group", { name: /Location/ });
    expect(within(location).getByText("One per machine")).toBeInTheDocument();

    await userEvent.click(
      within(location).getByRole("radio", { name: /^Back room/ })
    );
    expect(setMachineTag).toHaveBeenLastCalledWith({
      machineId: MACHINE,
      tagId: "back",
      applied: true,
    });
    await waitFor(() =>
      expect(
        within(location).getByRole("radio", { name: /^Front room/ })
      ).not.toBeChecked()
    );
    expect(
      within(location).getByRole("radio", { name: "Front room, 4 machines" })
    ).toBeInTheDocument();

    await userEvent.click(
      within(location).getByRole("radio", { name: "None" })
    );
    expect(setMachineTag).toHaveBeenLastCalledWith({
      machineId: MACHINE,
      tagId: "back",
      applied: false,
    });
    await waitFor(() =>
      expect(
        within(location).getByRole("radio", { name: "None" })
      ).toBeChecked()
    );
  });

  it("replaces an exclusive type's tag even when the search hides it", async () => {
    // Held open so the check reads the optimistic state, then released: an
    // async action left pending holds up later transitions in other tests.
    let release: (value: typeof saved) => void = () => undefined;
    setMachineTag.mockReturnValue(
      new Promise<typeof saved>((resolve) => {
        release = resolve;
      })
    );
    const panel = await openEditor();
    const search = within(panel).getByRole("textbox", {
      name: "Find or create a tag",
    });

    try {
      await userEvent.type(search, "back");
      await userEvent.click(
        within(panel).getByRole("radio", { name: /^Back room/ })
      );
      await userEvent.clear(search);

      const location = within(panel).getByRole("group", { name: /Location/ });
      expect(
        within(location).getByRole("radio", { name: "Front room, 4 machines" })
      ).not.toBeChecked();
    } finally {
      release(saved);
    }
    expect(await within(panel).findByText("Saved")).toBeInTheDocument();
  });

  it("keeps the typed name when creating a tag fails", async () => {
    createTag.mockResolvedValue({ ok: false, message: "Name already used" });
    const panel = await openEditor();
    const search = within(panel).getByRole("textbox", {
      name: "Find or create a tag",
    });

    await userEvent.type(search, "Bay 3");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Create “Bay 3”" })
    );

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "Name already used"
    );
    expect(search).toHaveValue("Bay 3");
    expect(setMachineTag).not.toHaveBeenCalled();
  });

  it("filters by name and hides None while searching", async () => {
    const panel = await openEditor({ canCreate: false });
    const search = within(panel).getByRole("textbox", { name: "Find a tag" });

    await userEvent.type(search, "room");
    expect(
      within(panel).queryByRole("checkbox", { name: /^Topper/ })
    ).not.toBeInTheDocument();
    expect(
      within(panel).getByRole("radio", { name: /^Back room/ })
    ).toBeInTheDocument();
    expect(
      within(panel).queryByRole("radio", { name: "None" })
    ).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "zzz");
    expect(within(panel).getByText("No matching tags")).toBeInTheDocument();
    // An owner cannot create tags.
    expect(
      within(panel).queryByRole("button", { name: /^Create/ })
    ).not.toBeInTheDocument();
  });

  it("offers Create only when no tag has that name, ignoring case", async () => {
    const panel = await openEditor();
    const search = within(panel).getByRole("textbox", {
      name: "Find or create a tag",
    });

    await userEvent.type(search, "  TOPPER ");
    expect(
      within(panel).queryByRole("button", { name: /^Create/ })
    ).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "Topp");
    expect(
      within(panel).getByRole("button", { name: "Create “Topp”" })
    ).toBeInTheDocument();
  });

  it("creates a tag in the chosen type and applies it to this machine", async () => {
    createTag.mockResolvedValue({
      ok: true,
      value: { id: "storage", href: "/c/tags/location/storage" },
    });
    setMachineTag.mockResolvedValue(saved);
    const panel = await openEditor();

    await userEvent.type(
      within(panel).getByRole("textbox", { name: "Find or create a tag" }),
      "Storage"
    );
    await userEvent.selectOptions(
      within(panel).getByRole("combobox", { name: "Tag type for the new tag" }),
      "Location"
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Create “Storage”" })
    );

    await waitFor(() =>
      expect(setMachineTag).toHaveBeenCalledWith({
        machineId: MACHINE,
        tagId: "storage",
        applied: true,
      })
    );
    expect(createTag).toHaveBeenCalledWith({
      name: "Storage",
      tagTypeId: "location",
    });
    const location = within(panel).getByRole("group", { name: /Location/ });
    // Exclusive: the new tag replaces Front room on this machine.
    await waitFor(() =>
      expect(
        within(location).getByRole("radio", { name: "Storage, 1 machine" })
      ).toBeChecked()
    );
    expect(
      within(location).getByRole("radio", { name: /^Front room/ })
    ).not.toBeChecked();
  });

  it("refuses a name over 20 characters", async () => {
    const panel = await openEditor();

    await userEvent.type(
      within(panel).getByRole("textbox", { name: "Find or create a tag" }),
      "A name well past twenty"
    );

    expect(within(panel).getByRole("alert")).toHaveTextContent(
      "Name is over 20 characters"
    );
    expect(within(panel).getByText("23/20")).toBeInTheDocument();
    expect(
      within(panel).queryByRole("button", { name: /^Create/ })
    ).not.toBeInTheDocument();
    expect(createTag).not.toHaveBeenCalled();
  });

  it("says there are no tags when there is nothing to apply", async () => {
    const panel = await openEditor({
      canCreate: false,
      applied: [],
      groups: [
        { typeId: null, name: "Other tags", exclusive: false, tags: [] },
      ],
    });
    expect(within(panel).getByText("No tags")).toBeInTheDocument();
  });
});
