import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionShareDialog } from "./CollectionShareDialog";

/** The current value of the read-only share-link input. */
function shareUrlValue(): string {
  return screen.getByTestId<HTMLInputElement>("collection-share-url").value;
}

const setSharing = vi.fn();
const resetLink = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  setCollectionSharingAction: (input: unknown) => setSharing(input),
  resetCollectionViewLinkAction: (input: unknown) => resetLink(input),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("CollectionShareDialog", () => {
  beforeEach(() => {
    setSharing.mockReset();
    resetLink.mockReset();
    refresh.mockReset();
  });

  it("hides the link section when sharing is off, and enabling reveals it", async () => {
    setSharing.mockResolvedValue({
      success: true,
      data: { viewToken: "fresh-token" },
    });
    render(<CollectionShareDialog collectionId="c1" viewToken={null} />);

    await userEvent.click(screen.getByTestId("collection-share-trigger"));
    // Off: toggle unchecked, no link field.
    const toggle = screen.getByTestId("collection-share-toggle");
    expect(toggle).not.toBeChecked();
    expect(
      screen.queryByTestId("collection-share-url")
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);
    await waitFor(() =>
      expect(setSharing).toHaveBeenCalledWith({
        collectionId: "c1",
        enabled: true,
      })
    );
    // The minted token now drives a visible link field ending in the token.
    await screen.findByTestId("collection-share-url");
    expect(shareUrlValue()).toContain("/c/fresh-token");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows the link when already shared and disabling hides it", async () => {
    setSharing.mockResolvedValue({ success: true, data: { viewToken: null } });
    render(<CollectionShareDialog collectionId="c1" viewToken="existing" />);

    await userEvent.click(screen.getByTestId("collection-share-trigger"));
    expect(screen.getByTestId("collection-share-toggle")).toBeChecked();
    expect(shareUrlValue()).toContain("/c/existing");

    await userEvent.click(screen.getByTestId("collection-share-toggle"));
    await waitFor(() =>
      expect(setSharing).toHaveBeenCalledWith({
        collectionId: "c1",
        enabled: false,
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("collection-share-url")
      ).not.toBeInTheDocument()
    );
  });

  it("reset rotates the token and the link reflects the new value", async () => {
    resetLink.mockResolvedValue({
      success: true,
      data: { viewToken: "rotated" },
    });
    render(<CollectionShareDialog collectionId="c1" viewToken="old" />);

    await userEvent.click(screen.getByTestId("collection-share-trigger"));
    await userEvent.click(screen.getByTestId("collection-share-reset"));

    await waitFor(() =>
      expect(resetLink).toHaveBeenCalledWith({ collectionId: "c1" })
    );
    await waitFor(() => expect(shareUrlValue()).toContain("/c/rotated"));
  });

  it("surfaces an error and leaves state unchanged when the action fails", async () => {
    setSharing.mockResolvedValue({ success: false, error: "Forbidden" });
    render(<CollectionShareDialog collectionId="c1" viewToken={null} />);

    await userEvent.click(screen.getByTestId("collection-share-trigger"));
    await userEvent.click(screen.getByTestId("collection-share-toggle"));

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(
      screen.queryByTestId("collection-share-url")
    ).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
