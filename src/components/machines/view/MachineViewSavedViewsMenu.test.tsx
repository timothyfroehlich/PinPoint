import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMachineViewBuiltInViews,
  getMachineViewPreset,
} from "~/lib/machines/view/config";
import type {
  MachineViewSavedViews,
  MachineViewSavedViewSummary,
  MachineViewState,
} from "~/lib/types";
import { toMachineViewSavedState } from "~/lib/machines/view/state";
import { MachineViewSavedViewsMenu } from "./MachineViewSavedViewsMenu";

const actions = vi.hoisted(() => ({
  createSavedMachineViewAction: vi.fn(),
  updateSavedMachineViewAction: vi.fn(),
  renameSavedMachineViewAction: vi.fn(),
  deleteSavedMachineViewAction: vi.fn(),
  setMachineViewDefaultAction: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());

vi.mock("~/app/(app)/m/saved-view-actions", () => actions);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace: vi.fn() }),
}));

const presetState = getMachineViewPreset("machines").defaultState;
const brokenView: MachineViewSavedViewSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Broken machines",
  state: {
    q: "",
    presence: ["on_the_floor"],
    status: ["unplayable"],
    severity: [],
    owner: [],
    sort: "machine",
    dir: "asc",
    pageSize: 25,
    columns: presetState.columns,
  },
};

function renderMenu(
  state: MachineViewState,
  activeViewId: string | null,
  options: {
    canSave?: boolean;
    defaultViewId?: string | null;
    preset?: "machines" | "collection";
    views?: MachineViewSavedViewSummary[];
  } = {}
): { onApply: ReturnType<typeof vi.fn> } {
  const onApply = vi.fn();
  const canSave = options.canSave ?? true;
  const preset = options.preset ?? "machines";
  const savedViews: MachineViewSavedViews = {
    canSave,
    offersDefault: canSave && preset === "machines",
    builtInViews: getMachineViewBuiltInViews(preset),
    views: canSave ? (options.views ?? [brokenView]) : [],
    defaultViewId: options.defaultViewId ?? null,
    activeViewId,
  };
  render(
    <MachineViewSavedViewsMenu
      layout="desktop"
      savedViews={savedViews}
      activeViewId={activeViewId}
      state={state}
      preset={preset}
      onApply={onApply}
      onViewSaved={vi.fn()}
    />
  );
  return { onApply };
}

describe("MachineViewSavedViewsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the Page Preset's Built-in View when no view is named", () => {
    renderMenu(presetState, null);
    expect(
      screen.getByRole("button", { name: "Views: On the floor" })
    ).toBeInTheDocument();
  });

  it("lists Built-in Views before Saved Views and marks the default", async () => {
    const user = userEvent.setup();
    renderMenu(presetState, null, { defaultViewId: "needs-attention" });

    await user.click(screen.getByRole("button", { name: /^Views:/ }));
    const items = screen
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
    expect(items.slice(0, 6)).toEqual([
      "On the floor",
      "Needs attentionDefault",
      "Service due",
      "All machines",
      "Recently added",
      "Broken machines",
    ]);
  });

  it("marks an applied Saved View as edited once the configuration differs", async () => {
    const user = userEvent.setup();
    renderMenu({ ...brokenView.state, q: "stern", page: 1 }, brokenView.id);

    await user.click(
      screen.getByRole("button", { name: "Views: Broken machines, edited" })
    );
    expect(
      screen.getByRole("menuitem", { name: "Save changes" })
    ).toBeInTheDocument();
  });

  it("keeps an owner with nothing on this Surface in the baseline and in Save changes (list-views §10.18)", async () => {
    const user = userEvent.setup();
    actions.updateSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: brokenView.id },
    });
    // The loader keeps Dana selected on a tab with none of her machines.
    const danasView = {
      ...brokenView,
      state: { ...brokenView.state, owner: ["dana-id"] },
    };
    renderMenu({ ...danasView.state, q: "stern", page: 1 }, danasView.id, {
      preset: "collection",
      views: [danasView],
    });

    await user.click(
      screen.getByRole("button", { name: "Views: Broken machines, edited" })
    );
    await user.click(screen.getByRole("menuitem", { name: "Save changes" }));

    expect(actions.updateSavedMachineViewAction).toHaveBeenCalledWith({
      id: danasView.id,
      state: { ...danasView.state, q: "stern" },
    });
  });

  it("reads as edited once an owner with nothing on this Surface is cleared", () => {
    const danasView = {
      ...brokenView,
      state: { ...brokenView.state, owner: ["dana-id"] },
    };
    renderMenu({ ...danasView.state, owner: [], page: 1 }, danasView.id, {
      preset: "collection",
      views: [danasView],
    });

    expect(
      screen.getByRole("button", { name: "Views: Broken machines, edited" })
    ).toBeInTheDocument();
  });

  it("never offers Save changes for an edited Built-in View", async () => {
    const user = userEvent.setup();
    renderMenu({ ...presetState, q: "stern" }, "on-the-floor");

    await user.click(
      screen.getByRole("button", { name: "Views: On the floor, edited" })
    );
    expect(
      screen.queryByRole("menuitem", { name: "Save changes" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Save as new…" })
    ).toBeInTheDocument();
  });

  it("offers only Built-in Views to a viewer who cannot save", async () => {
    const user = userEvent.setup();
    const { onApply } = renderMenu(presetState, null, { canSave: false });

    await user.click(screen.getByRole("button", { name: /^Views:/ }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(5);
    await user.click(screen.getByRole("menuitem", { name: "Service due" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ id: "service-due" })
    );
  });

  it("saves changes to the applied Saved View", async () => {
    const user = userEvent.setup();
    actions.updateSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: brokenView.id },
    });
    renderMenu({ ...brokenView.state, q: "stern", page: 3 }, brokenView.id);

    await user.click(screen.getByRole("button", { name: /Broken machines/ }));
    await user.click(screen.getByRole("menuitem", { name: "Save changes" }));

    expect(actions.updateSavedMachineViewAction).toHaveBeenCalledWith({
      id: brokenView.id,
      state: { ...brokenView.state, q: "stern" },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a name collision without closing the dialog", async () => {
    const user = userEvent.setup();
    actions.createSavedMachineViewAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "A view with this name already exists",
    });
    renderMenu(presetState, null);

    await user.click(screen.getByRole("button", { name: /^Views:/ }));
    await user.click(screen.getByRole("menuitem", { name: "Save as new…" }));
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Broken");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("A view with this name already exists")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Save view" })
    ).toBeInTheDocument();
  });

  it("makes a Built-in View the default from Manage views", async () => {
    const user = userEvent.setup();
    actions.setMachineViewDefaultAction.mockResolvedValue({
      ok: true,
      value: { id: "service-due" },
    });
    renderMenu(presetState, null);

    await user.click(screen.getByRole("button", { name: /^Views:/ }));
    await user.click(screen.getByRole("menuitem", { name: "Manage views…" }));
    await user.click(
      screen.getByRole("button", { name: "Open Service due by default" })
    );

    expect(actions.setMachineViewDefaultAction).toHaveBeenCalledWith({
      target: { kind: "builtIn", id: "service-due" },
    });
  });

  it("offers no Default View controls off the Machines page", async () => {
    const user = userEvent.setup();
    actions.createSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: "22222222-2222-4222-8222-222222222222" },
    });
    const collectionState = getMachineViewPreset("collection").defaultState;
    renderMenu(collectionState, null, {
      preset: "collection",
      defaultViewId: brokenView.id,
    });

    await user.click(screen.getByRole("button", { name: /^Views:/ }));
    // The account's Saved View is listed, but not marked as a default here.
    expect(
      screen.getByRole("menuitem", { name: "Broken machines" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Manage views…" }));
    expect(
      screen.queryByRole("button", { name: /by default$/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Broken machines" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));

    await user.click(screen.getByRole("button", { name: /^Views:/ }));
    await user.click(screen.getByRole("menuitem", { name: "Save as new…" }));
    expect(
      screen.queryByLabelText("Open this view by default")
    ).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Mine");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(actions.createSavedMachineViewAction).toHaveBeenCalledWith({
      name: "Mine",
      state: toMachineViewSavedState(collectionState),
      makeDefault: false,
    });
  });

  it("deletes a Saved View only after confirmation", async () => {
    const user = userEvent.setup();
    actions.deleteSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: brokenView.id },
    });
    renderMenu(presetState, null);

    await user.click(screen.getByRole("button", { name: /^Views:/ }));
    await user.click(screen.getByRole("menuitem", { name: "Manage views…" }));
    await user.click(
      screen.getByRole("button", { name: "Delete Broken machines" })
    );
    expect(actions.deleteSavedMachineViewAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(actions.deleteSavedMachineViewAction).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Delete Broken machines" })
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(actions.deleteSavedMachineViewAction).toHaveBeenCalledWith(
      brokenView.id
    );
  });
});
