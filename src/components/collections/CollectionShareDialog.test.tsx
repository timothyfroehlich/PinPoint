import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionShareDialog } from "./CollectionShareDialog";

/** The current value of the read-only share-link input. */
function shareUrlValue(): string {
  return screen.getByTestId<HTMLInputElement>("collection-share-url").value;
}

const setSharing = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  setCollectionSharingAction: (input: unknown) => setSharing(input),
}));

const refresh = vi.fn();
const replace = vi.fn();
// The dialog reads the current path to decide refresh-in-place vs. redirect to
// the canonical `/c/<id>`. Pin it to the canonical URL so the toggle refreshes.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
  usePathname: () => "/c/c1",
}));

describe("CollectionShareDialog", () => {
  beforeEach(() => {
    setSharing.mockReset();
    refresh.mockReset();
    replace.mockReset();
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
