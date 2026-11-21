import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { deleteCollectionAction } from "~/app/(app)/c/collections/actions";
import {
  PageExportProvider,
  RegisterPageExport,
  type PageExport,
} from "~/components/list-view";
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
const SHEETS = "/m/settings-sheets?m=AFM";

function actionNames(): (string | null)[] {
  return [...screen.getAllByRole("button")].map((button) =>
    button.getAttribute("aria-label")
  );
}

async function menuLabels(): Promise<(string | null)[]> {
  await userEvent.click(screen.getByRole("button", { name: "More" }));
  const menu = await screen.findByRole("menu");
  return within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
}

/** collections-and-tags 4.14–4.18 on a Collection's page. */
describe("CollectionPageActions", () => {
  it("shows the owner Share and ⋯ holding editing, Print settings sheets, and Delete last", async () => {
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={share}
        edit={edit}
      />
    );
    expect(actionNames()).toEqual(["Share", "More"]);
    expect(await menuLabels()).toEqual([
      "Edit collection…",
      "Print settings sheets",
      "Delete collection",
    ]);
    expect(
      screen.getByRole("menuitem", { name: "Print settings sheets" })
    ).toHaveAttribute("href", SHEETS);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });

  it("puts the Issues tab's Export between editing and Print settings sheets (4.17)", async () => {
    const pageExport: PageExport = {
      exportCsv: vi.fn(),
      emptyMessage: "No issues to export.",
    };
    function WithExport({
      children,
    }: {
      children: React.ReactNode;
    }): React.JSX.Element {
      return (
        <PageExportProvider>
          <RegisterPageExport value={pageExport} />
          {children}
        </PageExportProvider>
      );
    }
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={share}
        edit={edit}
      />,
      { wrapper: WithExport }
    );
    expect(await menuLabels()).toEqual([
      "Edit collection…",
      "Export to CSV",
      "Print settings sheets",
      "Delete collection",
    ]);
  });

  it("shows an Editor ⋯ alone, with no Share and no Delete", async () => {
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={null}
        edit={{ ...edit, canDelete: false }}
      />
    );
    expect(actionNames()).toEqual(["More"]);
    expect(await menuLabels()).toEqual([
      "Edit collection…",
      "Print settings sheets",
    ]);
  });

  it("shows other viewers Print settings sheets as its own button, with no ⋯ (list-views §3.7)", () => {
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={null}
        edit={null}
      />
    );
    expect(
      screen.getByRole("link", { name: "Print settings sheets" })
    ).toHaveAttribute("href", SHEETS);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("confirms Delete collection from ⋯ before deleting", async () => {
    vi.mocked(deleteCollectionAction).mockResolvedValue({ success: true });
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={share}
        edit={edit}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Delete collection" })
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: "Delete this collection?",
    });
    expect(deleteCollectionAction).not.toHaveBeenCalled();
    await userEvent.click(
      within(confirm).getByTestId("collection-delete-confirm")
    );
    await waitFor(() =>
      expect(deleteCollectionAction).toHaveBeenCalledWith({
        collectionId: "c1",
      })
    );
  });
});

/** Dialogs opened from state have no trigger, so focus returns by hand. */
describe("CollectionPageActions focus return", () => {
  it("returns focus to Share when the Share dialog closes", async () => {
    const user = userEvent.setup();
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={share}
        edit={edit}
      />
    );
    const shareButton = screen.getByRole("button", { name: "Share" });
    shareButton.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("dialog", { name: "Share collection" })
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(shareButton).toHaveFocus();
  });

  it("returns focus to ⋯ when a dialog opened from ⋯ closes", async () => {
    const user = userEvent.setup();
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={share}
        edit={edit}
      />
    );
    const more = screen.getByRole("button", { name: "More" });
    more.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("dialog", { name: "Edit collection" })
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(more).toHaveFocus();
  });

  it("returns focus to ⋯ when the delete confirmation is kept", async () => {
    const user = userEvent.setup();
    render(
      <CollectionPageActions
        collectionId="c1"
        settingsSheetsHref={SHEETS}
        share={share}
        edit={edit}
      />
    );
    const more = screen.getByRole("button", { name: "More" });
    await user.click(more);
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete collection" })
    );
    const confirm = await screen.findByRole("alertdialog");
    await user.click(
      within(confirm).getByRole("button", { name: "Keep collection" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(more).toHaveFocus();
  });
});
