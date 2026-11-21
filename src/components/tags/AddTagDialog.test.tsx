import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddTagDialog } from "./AddTagDialog";

const createTag = vi.fn();
vi.mock("~/app/(app)/c/tags/actions", () => ({
  createTagAction: (input: unknown) => createTag(input),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type Target =
  | { types: { id: string; name: string }[] }
  | { type: { id: string; name: string } };

/** Add tag opens the dialog from the page's actions (spec 11.12). */
function Harness({ target }: { target: Target }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {"types" in target ? (
        <AddTagDialog open={open} onOpenChange={setOpen} types={target.types} />
      ) : (
        <AddTagDialog open={open} onOpenChange={setOpen} type={target.type} />
      )}
    </>
  );
}

async function submit(): Promise<void> {
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Add tag" })
  );
}

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
    render(<Harness target={{ types: [{ id: "loc", name: "Location" }] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(
      screen.getByRole("combobox", { name: "Tag type" })
    ).toHaveTextContent("No type");
    await userEvent.type(screen.getByLabelText(/Name/), "Topper");
    await submit();

    await waitFor(() =>
      expect(createTag).toHaveBeenCalledWith({
        name: "Topper",
        tagTypeId: null,
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("creates the tag in the type whose page it was opened from", async () => {
    render(<Harness target={{ type: { id: "loc", name: "Location" } }} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    await userEvent.type(screen.getByLabelText(/Name/), "Storage");
    await submit();

    await waitFor(() =>
      expect(createTag).toHaveBeenCalledWith({
        name: "Storage",
        tagTypeId: "loc",
      })
    );
  });
});
