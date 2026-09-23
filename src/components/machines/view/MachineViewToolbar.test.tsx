import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import type { MachineViewState } from "~/lib/types";
import { MachineViewToolbar } from "./MachineViewToolbar";

window.matchMedia = vi.fn().mockImplementation(() => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const onSearchChange = vi.fn();
const onStateChange = vi.fn();
const onMobileModeChange = vi.fn();

function renderToolbar(state: MachineViewState): void {
  render(
    <MachineViewToolbar
      state={state}
      preset="machines"
      ownerOptions={[
        { id: "owner-1", name: "Alex" },
        { id: "unassigned", name: "Unassigned" },
      ]}
      permittedFields={getMachineViewPreset("machines").permittedFields}
      totalCount={75}
      searchValue={state.q}
      mobileMode="compact"
      onSearchChange={onSearchChange}
      onStateChange={onStateChange}
      onMobileModeChange={onMobileModeChange}
    />
  );
}

describe("MachineViewToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates search and can clear search plus active filters", async () => {
    const user = userEvent.setup();
    const state: MachineViewState = {
      ...getMachineViewPreset("machines").defaultState,
      q: "mars",
      status: ["needs_service"],
      owner: ["owner-1"],
      page: 3,
    };
    renderToolbar(state);

    fireEvent.change(
      screen.getByRole("searchbox", { name: /search machines/i }),
      {
        target: { value: "medieval" },
      }
    );
    expect(onSearchChange).toHaveBeenLastCalledWith("medieval");

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onSearchChange).toHaveBeenLastCalledWith("");
    expect(onStateChange).toHaveBeenLastCalledWith({
      ...state,
      q: "",
      presence: ["on_the_floor"],
      status: [],
      owner: [],
      page: 1,
    });
  });

  it("removes one active chip without clearing the others", async () => {
    const user = userEvent.setup();
    const state: MachineViewState = {
      ...getMachineViewPreset("machines").defaultState,
      status: ["needs_service"],
      owner: ["owner-1"],
      page: 2,
    };
    renderToolbar(state);

    await user.click(
      screen.getByRole("button", { name: "Remove Needs Service filter" })
    );
    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      status: [],
      page: 1,
    });
  });

  it("selects multi-value filters and resets the page", async () => {
    const user = userEvent.setup();
    const state: MachineViewState = {
      ...getMachineViewPreset("machines").defaultState,
      page: 4,
    };
    renderToolbar(state);

    await user.click(screen.getByRole("combobox", { name: "Presence" }));
    await user.click(screen.getByText("Removed"));
    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      presence: ["on_the_floor", "removed"],
      page: 1,
    });
  });

  it("retains the page for columns and resets it for page size", async () => {
    const user = userEvent.setup();
    const state: MachineViewState = {
      ...getMachineViewPreset("machines").defaultState,
      page: 3,
    };
    renderToolbar(state);

    await user.click(
      screen.getByTestId("machine-view-desktop-options-trigger")
    );
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Last Serviced" })
    );
    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      columns: ["machine", "playability", "openIssues"],
      page: 3,
    });

    await user.click(screen.getByRole("menuitemradio", { name: "50" }));
    expect(onStateChange).toHaveBeenLastCalledWith({
      ...state,
      pageSize: 50,
      page: 1,
    });
  });

  it("paginates and offers the layout preference", async () => {
    const user = userEvent.setup();
    const state: MachineViewState = {
      ...getMachineViewPreset("machines").defaultState,
      page: 2,
    };
    renderToolbar(state);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onStateChange).toHaveBeenCalledWith({ ...state, page: 3 });

    await user.click(screen.getByTestId("machine-view-mobile-options-trigger"));
    expect(screen.getByText("Layout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(onMobileModeChange).toHaveBeenCalledWith("table");
  });

  it("changes fields and page size from the phone drawer", async () => {
    const user = userEvent.setup();
    const state: MachineViewState = {
      ...getMachineViewPreset("machines").defaultState,
      page: 3,
    };
    renderToolbar(state);

    await user.click(screen.getByTestId("machine-view-mobile-options-trigger"));
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    await user.click(screen.getByText("Fields"));
    await user.click(screen.getByRole("checkbox", { name: "Last Activity" }));
    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      columns: [
        "machine",
        "playability",
        "openIssues",
        "lastServiced",
        "lastActivity",
      ],
      page: 3,
    });

    await user.click(screen.getByRole("button", { name: "50" }));
    expect(onStateChange).toHaveBeenLastCalledWith({
      ...state,
      pageSize: 50,
      page: 1,
    });
  });
});
