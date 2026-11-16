import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionPageActions } from "./CollectionPageActions";

vi.mock("~/app/(app)/c/collections/actions", () => ({
  setCollectionSharingAction: vi.fn(),
  addCollectionCollaboratorAction: vi.fn(),
  removeCollectionCollaboratorAction: vi.fn(),
  updateCollectionAction: vi.fn(),
  deleteCollectionAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/c/c1",
}));

const share = {
  viewToken: null,
  ownerName: "Tim",
  editors: [],
  grantableMembers: [],
};
const edit = {
  currentName: "Back Room",
  currentDescription: null,
  allMachines: [],
  currentIds: [],
  canDelete: true,
};

function actionNames(): (string | null)[] {
  return [...screen.getAllByRole("button")].map((button) =>
    button.getAttribute("aria-label")
  );
}

/** collections-and-tags 4.14–4.17 on a Collection's page. */
describe("CollectionPageActions", () => {
  it("shows the owner Share, Print, and ⋯ holding Edit collection", async () => {
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref="/m/settings-sheets?m=AFM"
        share={share}
        edit={edit}
      />
    );
    expect(actionNames()).toEqual(["Share", "Print", "Actions"]);

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual(["Edit collection"]);
  });

  it("shows an Editor Print and ⋯, with no Share", () => {
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref="/m/settings-sheets?m=AFM"
        share={null}
        edit={{ ...edit, canDelete: false }}
      />
    );
    expect(actionNames()).toEqual(["Print", "Actions"]);
  });

  it("shows other viewers Print alone while ⋯ has nothing to hold", () => {
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref="/m/settings-sheets?m=AFM"
        share={null}
        edit={null}
      />
    );
    expect(actionNames()).toEqual(["Print"]);
  });
});
