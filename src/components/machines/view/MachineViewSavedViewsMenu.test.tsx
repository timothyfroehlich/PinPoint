import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import type {
  MachineViewSavedViews,
  MachineViewSavedViewSummary,
  MachineViewState,
} from "~/lib/types";
import { MachineViewSavedViewsMenu } from "./MachineViewSavedViewsMenu";

const actions = vi.hoisted(() => ({
  createSavedMachineViewAction: vi.fn(),
  updateSavedMachineViewAction: vi.fn(),
  renameSavedMachineViewAction: vi.fn(),
  deleteSavedMachineViewAction: vi.fn(),
  setSavedMachineViewDefaultAction: vi.fn(),
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
  isDefault: true,
  state: {
    q: "",
    presence: ["on_the_floor"],
    status: ["unplayable"],
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
  onApply = vi.fn()
): { onApply: ReturnType<typeof vi.fn> } {
  const savedViews: MachineViewSavedViews = {
    surface: { kind: "machines" },
    views: [brokenView],
    activeViewId,
  };
  render(
    <MachineViewSavedViewsMenu
      layout="desktop"
      savedViews={savedViews}
      activeViewId={activeViewId}
      state={state}
      ownerIds={[]}
      preset="machines"
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

  it("names the Page Preset when no Saved View is active", () => {
    renderMenu(presetState, null);
    expect(
      screen.getByRole("button", { name: "Saved views: Built-in view" })
    ).toBeInTheDocument();
  });

  it("marks an applied Saved View as edited once the configuration differs", async () => {
    const user = userEvent.setup();
    renderMenu({ ...brokenView.state, q: "stern", page: 1 }, brokenView.id);

    await user.click(
      screen.getByRole("button", {
        name: "Saved views: Broken machines, edited",
      })
    );
    expect(
      screen.getByRole("menuitem", { name: "Save changes" })
    ).toBeInTheDocument();
  });

  it("offers only Save as new while the Page Preset is applied", async () => {
    const user = userEvent.setup();
    renderMenu({ ...presetState, q: "stern" }, "preset");

    await user.click(screen.getByRole("button", { name: /Built-in view/ }));
    expect(
      screen.queryByRole("menuitem", { name: "Save changes" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Save as new…" })
    ).toBeInTheDocument();
  });

  it("saves changes to the applied Saved View", async () => {
    const user = userEvent.setup();
    actions.updateSavedMachineViewAction.mockResolvedValue({
      ok: true,
      value: { id: brokenView.id },
    });
    const state = { ...brokenView.state, q: "stern", page: 3 };
    renderMenu(state, brokenView.id);

    await user.click(screen.getByRole("button", { name: /Broken machines/ }));
    await user.click(screen.getByRole("menuitem", { name: "Save changes" }));

    expect(actions.updateSavedMachineViewAction).toHaveBeenCalledWith({
      id: brokenView.id,
      state: { ...brokenView.state, q: "stern" },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("applies the Page Preset from the menu", async () => {
    const user = userEvent.setup();
    const { onApply } = renderMenu(
      { ...brokenView.state, page: 1 },
      brokenView.id
    );

    await user.click(screen.getByRole("button", { name: /Broken machines/ }));
    await user.click(screen.getByRole("menuitem", { name: "Built-in view" }));
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it("shows a name collision without closing the dialog", async () => {
    const user = userEvent.setup();
    actions.createSavedMachineViewAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "A view with this name already exists",
    });
    renderMenu(presetState, null);

    await user.click(screen.getByRole("button", { name: /Built-in view/ }));
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
});
