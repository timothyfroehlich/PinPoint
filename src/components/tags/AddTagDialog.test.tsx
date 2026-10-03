import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddTagDialog } from "./AddTagDialog";

const createTag = vi.fn();
vi.mock("~/app/(app)/c/tags/actions", () => ({
  createTagAction: (input: unknown) => createTag(input),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

/** Spec collections-and-tags 11.3, 11.12: creating a tag. */
describe("AddTagDialog", () => {
  beforeEach(() => {
    createTag.mockReset();
    refresh.mockReset();
    createTag.mockResolvedValue({
      ok: true,
      value: { id: "t1", href: "/c/tags/other/topper" },
    });
  });

  it("defaults a new tag to no tag type", async () => {
    render(<AddTagDialog types={[{ id: "loc", name: "Location" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add tag" }));
    expect(
      screen.getByRole("combobox", { name: "Tag type" })
    ).toHaveTextContent("No type");
    await userEvent.type(screen.getByLabelText(/Name/), "Topper");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add tag",
      })
    );

    await waitFor(() =>
      expect(createTag).toHaveBeenCalledWith({
        name: "Topper",
        tagTypeId: null,
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("creates the tag in the type whose page it was opened from", async () => {
    render(<AddTagDialog type={{ id: "loc", name: "Location" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Add tag" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    await userEvent.type(screen.getByLabelText(/Name/), "Storage");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add tag",
      })
    );

    await waitFor(() =>
      expect(createTag).toHaveBeenCalledWith({
        name: "Storage",
        tagTypeId: "loc",
      })
    );
  });
});
