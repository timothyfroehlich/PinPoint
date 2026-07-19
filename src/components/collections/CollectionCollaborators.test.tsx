import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionCollaborators } from "./CollectionCollaborators";

const add = vi.fn();
const remove = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  addCollectionCollaboratorAction: (i: unknown) => add(i),
  removeCollectionCollaboratorAction: (i: unknown) => remove(i),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

// cmdk + Popover need these jsdom stubs.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);
Element.prototype.scrollIntoView = vi.fn();

const members = [
  { id: "m-1", name: "Alpha" },
  { id: "m-2", name: "Bravo" },
];

describe("CollectionCollaborators", () => {
  beforeEach(() => {
    add.mockReset();
    remove.mockReset();
    refresh.mockReset();
  });

  it("lists the owner and current editors, excludes them from the picker", async () => {
    add.mockResolvedValue({ success: true });
    render(
      <CollectionCollaborators
        collectionId="c1"
        ownerName="Owner"
        editors={[{ id: "m-1", name: "Alpha" }]}
        grantableMembers={members}
      />
    );
    expect(screen.getByText("Owner (owner)")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("collab-add-trigger"));
    // Alpha is already an editor -> not offered; Bravo is.
    expect(screen.queryByTestId("collab-option-m-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("collab-option-m-2"));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ collectionId: "c1", userId: "m-2" })
    );
  });

  it("removes an editor", async () => {
    remove.mockResolvedValue({ success: true });
    render(
      <CollectionCollaborators
        collectionId="c1"
        ownerName="Owner"
        editors={[{ id: "m-1", name: "Alpha" }]}
        grantableMembers={members}
      />
    );
    fireEvent.click(screen.getByTestId("collab-remove-m-1"));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith({ collectionId: "c1", userId: "m-1" })
    );
  });
});
