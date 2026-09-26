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

const savedView: MachineViewSavedViewSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Broken machines",
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

function resolve(
  query: string,
  defaultViewId: string | null = null,
  preset: "machines" | "collection" = "machines"
): ReturnType<typeof resolveSavedMachineViewRequest> {
  return resolveSavedMachineViewRequest({
    views: [savedView],
    defaultViewId,
    preset,
    searchParams: new URLSearchParams(query),
    pathname: "/m",
  });
}

describe("saved view request resolution", () => {
  it("opens a default Saved View at its canonical URL for a bare URL", () => {
    expect(resolve("", savedView.id)).toEqual({
      activeViewId: savedView.id,
      redirectTo: `/m?status=needs_service%2Cunplayable&sort=playability&dir=desc&pageSize=50&view=${savedView.id}`,
    });
  });

  it("opens a default Built-in View at its canonical URL", () => {
    expect(resolve("", "service-due")).toEqual({
      activeViewId: "service-due",
      redirectTo: "/m?sort=lastServiced&dir=asc&view=service-due",
    });
  });

  it("needs no redirect when the default is the Page Preset", () => {
    expect(resolve("", "on-the-floor")).toEqual({
      activeViewId: null,
      redirectTo: null,
    });
  });

  it("keeps the page when a URL carries only a page", () => {
    expect(resolve("page=3", savedView.id).redirectTo).toMatch(/&page=3$/);
  });

  it("opens the Page Preset for a bare URL without a default", () => {
    expect(resolve("")).toEqual({ activeViewId: null, redirectTo: null });
  });

  it("opens any configured URL as written, ignoring the default", () => {
    expect(resolve("status=unplayable", savedView.id)).toEqual({
      activeViewId: null,
      redirectTo: null,
    });
  });

  it("names owned Saved Views and this preset's Built-in Views only", () => {
    expect(resolve(`view=${savedView.id}`).activeViewId).toBe(savedView.id);
    expect(resolve("view=needs-attention").activeViewId).toBe(
      "needs-attention"
    );
    expect(
      resolve("view=33333333-3333-4333-8333-333333333333").activeViewId
    ).toBeNull();
    // Service due is a Machines view; Collections do not offer it.
    expect(
      resolve("view=service-due", null, "collection").activeViewId
    ).toBeNull();
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
    const state = { ...savedView.state, page: 2 };
    const plain = serializeMachineViewState(state, "machines").toString();
    expect(
      serializeMachineViewState(state, "machines", "needs-attention").toString()
    ).toBe(`${plain}&view=needs-attention`);
  });

  it("compares configurations without the page", () => {
    const saved = savedView.state;
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
