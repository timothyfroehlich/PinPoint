import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionDeleteDialog } from "./CollectionDeleteDialog";

/** Delete collection in ⋯ opens the dialog (collections-and-tags 4.17). */
function DeleteHarness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="collection-delete-trigger"
        onClick={() => setOpen(true)}
      >
        Delete collection
      </button>
      <CollectionDeleteDialog
        open={open}
        onOpenChange={setOpen}
        collectionId="c1"
      />
    </>
  );
}

const deleteAction = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  deleteCollectionAction: (input: unknown) => deleteAction(input),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

async function openAndConfirm(): Promise<void> {
  await userEvent.click(screen.getByTestId("collection-delete-trigger"));
  await userEvent.click(screen.getByTestId("collection-delete-confirm"));
}

describe("CollectionDeleteDialog", () => {
  beforeEach(() => {
    deleteAction.mockReset();
    push.mockReset();
  });

  it("deletes only once confirmed, then navigates to the list", async () => {
    deleteAction.mockResolvedValue({ success: true });
    render(<DeleteHarness />);

    await userEvent.click(screen.getByTestId("collection-delete-trigger"));
    expect(
      screen.getByRole("alertdialog", { name: "Delete this collection?" })
    ).toBeInTheDocument();
    expect(deleteAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("collection-delete-confirm"));
    await waitFor(() =>
      expect(deleteAction).toHaveBeenCalledWith({ collectionId: "c1" })
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/c/collections"));
  });

  it("shows the error message inside the dialog when delete fails", async () => {
    deleteAction.mockResolvedValue({
      success: false,
      error: "Cannot delete this collection",
    });
    render(<DeleteHarness />);
    await openAndConfirm();

    const alertDialog = screen.getByRole("alertdialog");
    expect(await within(alertDialog).findByRole("alert")).toHaveTextContent(
      "Cannot delete this collection"
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("opens again without the last attempt's error", async () => {
    deleteAction.mockResolvedValue({
      success: false,
      error: "Cannot delete this collection",
    });
    render(<DeleteHarness />);
    await openAndConfirm();
    expect(
      await within(screen.getByRole("alertdialog")).findByRole("alert")
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Keep collection" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId("collection-delete-trigger"));
    expect(
      within(screen.getByRole("alertdialog")).queryByRole("alert")
    ).not.toBeInTheDocument();
  });

  it("offers a route back when the collection is already gone", async () => {
    deleteAction.mockResolvedValue({
      success: false,
      error:
        "This collection is no longer available. It may already have been deleted.",
      code: "not_found",
    });
    render(<DeleteHarness />);
    await openAndConfirm();

    const alertDialog = screen.getByRole("alertdialog");
    expect(await within(alertDialog).findByRole("alert")).toHaveTextContent(
      "This collection is no longer available. It may already have been deleted."
    );
    expect(
      within(alertDialog).getByRole("heading", {
        name: "Collection unavailable",
      })
    ).toBeInTheDocument();
    expect(
      within(alertDialog).queryByText("Delete this collection?")
    ).not.toBeInTheDocument();
    const backLink = within(alertDialog).getByRole("link", {
      name: "Back to collections",
    });
    expect(backLink).toHaveAttribute("href", "/c/collections");
    expect(
      within(alertDialog).queryByTestId("collection-delete-confirm")
    ).not.toBeInTheDocument();
    await userEvent.click(backLink);
  });

  it("keeps the confirmation open while deletion is pending so a failure stays visible", async () => {
    let settleDelete: (result: {
      success: false;
      error: string;
    }) => void = () => {
      throw new Error("Delete request was not started");
    };
    deleteAction.mockReturnValue(
      new Promise<{ success: false; error: string }>((resolve) => {
        settleDelete = resolve;
      })
    );
    render(<DeleteHarness />);
    await openAndConfirm();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Keep collection" })
      ).toBeDisabled()
    );

    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    settleDelete({ success: false, error: "Cannot delete this collection" });
    expect(
      await within(screen.getByRole("alertdialog")).findByRole("alert")
    ).toHaveTextContent("Cannot delete this collection");
  });
});
