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
const builtInViews = getMachineViewBuiltInViews("machines");
const brokenView: MachineViewSavedViewSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Broken machines",
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
  options: { canSave?: boolean; defaultViewId?: string | null } = {}
): { onApply: ReturnType<typeof vi.fn> } {
  const onApply = vi.fn();
  const canSave = options.canSave ?? true;
  const savedViews: MachineViewSavedViews = {
    surface: { kind: "machines" },
    canSave,
    builtInViews,
    views: canSave ? [brokenView] : [],
    defaultViewId: options.defaultViewId ?? null,
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
      surface: { kind: "machines" },
      target: { kind: "builtIn", id: "service-due" },
    });
  });
});
