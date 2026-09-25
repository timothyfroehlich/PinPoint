import { describe, expect, it, vi } from "vitest";
import type { MachineViewSavedViewSummary } from "~/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("~/server/db", () => ({ db: {} }));

const { resolveSavedMachineViewRequest } = await import("./saved-views");
const {
  hasMachineViewConfiguration,
  machineViewSavedStatesEqual,
  serializeMachineViewState,
  toMachineViewSavedState,
} = await import("./state");

const defaultView: MachineViewSavedViewSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Needs attention",
  isDefault: true,
  state: {
    q: "",
    presence: ["on_the_floor"],
    status: ["needs_service", "unplayable"],
    owner: [],
    sort: "playability",
    dir: "desc",
    pageSize: 50,
    columns: ["machine", "playability", "openIssues", "lastServiced"],
  },
};
const otherView: MachineViewSavedViewSummary = {
  ...defaultView,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Other",
  isDefault: false,
};

function resolve(
  query: string,
  views: MachineViewSavedViewSummary[] = [defaultView, otherView]
): ReturnType<typeof resolveSavedMachineViewRequest> {
  return resolveSavedMachineViewRequest({
    views,
    preset: "machines",
    searchParams: new URLSearchParams(query),
    pathname: "/m",
  });
}

describe("saved view request resolution", () => {
  it("opens the Default Saved View at its canonical URL for a bare URL", () => {
    expect(resolve("")).toEqual({
      activeViewId: defaultView.id,
      redirectTo: `/m?status=needs_service%2Cunplayable&sort=playability&dir=desc&pageSize=50&view=${defaultView.id}`,
    });
  });

  it("keeps the page when a URL carries only a page", () => {
    expect(resolve("page=3").redirectTo).toMatch(/&page=3$/);
  });

  it("opens the Page Preset for a bare URL without a default", () => {
    expect(resolve("", [otherView])).toEqual({
      activeViewId: null,
      redirectTo: null,
    });
  });

  it("opens any configured URL as written", () => {
    expect(resolve("status=unplayable")).toEqual({
      activeViewId: null,
      redirectTo: null,
    });
  });

  it("reaches the Page Preset through view=preset despite a default", () => {
    expect(resolve("view=preset")).toEqual({
      activeViewId: "preset",
      redirectTo: null,
    });
  });

  it("names an owned Saved View and ignores one the account does not own", () => {
    expect(resolve(`view=${otherView.id}`).activeViewId).toBe(otherView.id);
    expect(
      resolve("view=33333333-3333-4333-8333-333333333333&status=unplayable")
    ).toEqual({ activeViewId: null, redirectTo: null });
  });
});

describe("saved view URL helpers", () => {
  it("treats every parameter except page as view configuration", () => {
    expect(hasMachineViewConfiguration(new URLSearchParams("page=2"))).toBe(
      false
    );
    for (const name of ["q", "presence", "status", "columns", "view"]) {
      expect(
        hasMachineViewConfiguration(new URLSearchParams(`${name}=x`))
      ).toBe(true);
    }
  });

  it("appends the view reference without changing other parameters", () => {
    const state = { ...defaultView.state, page: 2 };
    const plain = serializeMachineViewState(state, "machines").toString();
    expect(
      serializeMachineViewState(state, "machines", "preset").toString()
    ).toBe(`${plain}&view=preset`);
  });

  it("compares configurations without the page", () => {
    const saved = defaultView.state;
    expect(
      machineViewSavedStatesEqual(
        toMachineViewSavedState({ ...saved, page: 4 }),
        saved,
        "machines"
      )
    ).toBe(true);
    expect(
      machineViewSavedStatesEqual({ ...saved, q: "stern" }, saved, "machines")
    ).toBe(false);
  });
});
