import { describe, expect, it } from "vitest";
import {
  getMachineViewBuiltInViews,
  getMachineViewPreset,
  type MachineViewBuiltInViewDefinition,
} from "./config";
import {
  applyMachineBuiltInView,
  nextMachineViewSort,
  normalizeMachineViewSavedState,
  parseMachineViewState,
  serializeMachineViewState,
  toMachineViewSavedState,
} from "./state";

describe("machine view URL state", () => {
  it("uses the Machines preset defaults when parameters are omitted", () => {
    expect(parseMachineViewState(new URLSearchParams(), "machines")).toEqual({
      q: "",
      presence: ["on_the_floor"],
      status: [],
      owner: [],
      sort: "machine",
      dir: "asc",
      page: 1,
      pageSize: 25,
      // Both Page Presets display six fields by default (§4.6).
      columns: [
        "machine",
        "playability",
        "presence",
        "openIssues",
        "lastServiced",
        "lastActivity",
      ],
      severity: [],
    });
  });

  it("uses the Collection preset defaults independently", () => {
    const state = parseMachineViewState(new URLSearchParams(), "collection");
    expect(state.presence).toEqual(["on_the_floor"]);
    expect(state.columns).toEqual(
      parseMachineViewState(new URLSearchParams(), "machines").columns
    );
    expect({ sort: state.sort, dir: state.dir }).toEqual({
      sort: "playability",
      dir: "desc",
    });
  });

  it("puts filter values in canonical order and keeps displayed fields in URL order", () => {
    const params = new URLSearchParams({
      presence: "all",
      status: "unplayable,operational,invalid",
      severity: "major,bogus,cosmetic,major",
      owner: "owner-2,unassigned,owner-1,me,owner-2",
      columns: "machine,year,invalid,owner",
      pageSize: "50",
    });
    const state = parseMachineViewState(params, "machines");

    expect(state.presence).toBe("all");
    expect(state.status).toEqual(["operational", "unplayable"]);
    expect(state.severity).toEqual(["cosmetic", "major"]);
    // Me, then Unassigned, then people by id.
    expect(state.owner).toEqual(["me", "unassigned", "owner-1", "owner-2"]);
    // Displayed fields show in the order the URL lists them.
    expect(state.columns).toEqual(["machine", "year", "owner"]);
    expect(state.pageSize).toBe(50);
    expect(
      parseMachineViewState(
        new URLSearchParams({ presence: "on_loan,on_the_floor" }),
        "machines"
      ).presence
    ).toEqual(["on_the_floor", "on_loan"]);
  });

  it("ignores retired widget parameters and drops them from the canonical URL", () => {
    // issuesWidget belonged to the retired Open Issues Widget; the population
    // parameters to the retired All/Filtered choice (machine-widgets §2.2).
    const params = new URLSearchParams({
      issuesWidget: "filtered",
      presenceWidget: "filtered",
      playabilityWidget: "filtered",
    });
    const state = parseMachineViewState(params, "machines");

    expect(state).toEqual(
      parseMachineViewState(new URLSearchParams(), "machines")
    );
    expect(serializeMachineViewState(state, "machines").toString()).toBe("");
  });

  it("ignores invalid enums, pages, page sizes, sorts, and columns", () => {
    const state = parseMachineViewState(
      new URLSearchParams({
        presence: "invalid",
        status: "invalid",
        sort: "invalid",
        dir: "sideways",
        page: "-4",
        pageSize: "10",
        columns: "invalid",
      }),
      "machines"
    );

    expect(state.presence).toEqual(["on_the_floor"]);
    expect(state.status).toEqual([]);
    expect(state.sort).toBe("machine");
    expect(state.dir).toBe("asc");
    expect(state.page).toBe(1);
    expect(state.pageSize).toBe(25);
    expect(state.columns).toEqual(
      getMachineViewPreset("machines").defaultState.columns
    );
    expect(
      parseMachineViewState(
        new URLSearchParams({ page: "2broken" }),
        "machines"
      ).page
    ).toBe(1);
  });

  it("omits preset defaults and restores explicit non-default state", () => {
    const defaults = parseMachineViewState(new URLSearchParams(), "machines");
    expect(serializeMachineViewState(defaults, "machines").toString()).toBe("");

    const state = {
      ...defaults,
      q: "mars",
      presence: "all" as const,
      status: ["needs_service" as const],
      severity: ["minor" as const, "unplayable" as const],
      owner: ["unassigned"],
      sort: "year" as const,
      dir: "desc" as const,
      page: 3,
      pageSize: 100 as const,
      columns: ["machine" as const, "year" as const],
    };
    const serialized = serializeMachineViewState(state, "machines");
    expect(serialized.toString()).toBe(
      "q=mars&presence=all&status=needs_service&severity=minor%2Cunplayable&owner=unassigned&sort=year&dir=desc&page=3&pageSize=100&columns=machine%2Cyear"
    );
    expect(parseMachineViewState(serialized, "machines")).toEqual(state);
  });
});

describe("stored Saved View configuration (list-views §10.14)", () => {
  it("keeps every value of a valid configuration, whichever Surface saved it", () => {
    // A Collection-tab configuration differs from the Machines preset on
    // presence and sorting; it must survive storage unchanged so it applies
    // the same way on every Surface (list-views §10.5).
    const collection = toMachineViewSavedState(
      parseMachineViewState(
        new URLSearchParams("owner=unassigned&pageSize=50"),
        "collection"
      )
    );
    expect(normalizeMachineViewSavedState(collection)).toEqual(collection);
  });

  it("drops stored values that no longer exist and ignores unknown keys", () => {
    const stored = {
      ...toMachineViewSavedState(
        parseMachineViewState(new URLSearchParams(), "machines")
      ),
      status: ["unplayable", "retired_status"],
      columns: ["machine", "retiredField", "year"],
      sort: "retiredField",
      // Views saved before the All/Filtered choice was retired still carry
      // these keys (machine-widgets §2.2); they load harmlessly and are never
      // written back, because saving stores the normalized configuration.
      presenceWidget: "filtered",
      playabilityWidget: "all",
    };
    const {
      presenceWidget: _presence,
      playabilityWidget: _playability,
      ...expected
    } = {
      ...stored,
      status: ["unplayable"],
      columns: ["machine", "year"],
      sort: "machine",
    };
    expect(normalizeMachineViewSavedState(stored)).toEqual(expected);
  });

  it("fills missing keys from the Machines preset", () => {
    expect(normalizeMachineViewSavedState({ q: "stern" })).toEqual({
      ...toMachineViewSavedState(
        parseMachineViewState(new URLSearchParams(), "machines")
      ),
      q: "stern",
    });
    expect(normalizeMachineViewSavedState(null)).toEqual(
      toMachineViewSavedState(
        parseMachineViewState(new URLSearchParams(), "machines")
      )
    );
  });
});

describe("machine view sort cycling", () => {
  it("cycles preferred, opposite, then preset default", () => {
    const selected = nextMachineViewSort(
      { sort: "machine", dir: "asc" },
      "openIssues",
      "machines"
    );
    expect(selected).toEqual({ sort: "openIssues", dir: "desc" });

    const opposite = nextMachineViewSort(selected, "openIssues", "machines");
    expect(opposite).toEqual({ sort: "openIssues", dir: "asc" });

    expect(nextMachineViewSort(opposite, "openIssues", "machines")).toEqual({
      sort: "machine",
      dir: "asc",
    });
  });
});

describe("applying a Built-in View (list-views §1; machine-views §9.1)", () => {
  const preset = getMachineViewPreset("machines").defaultState;
  const current = toMachineViewSavedState({
    ...preset,
    q: "mars",
    status: ["unplayable"],
    pageSize: 50,
    columns: [...preset.columns, "owner"],
  });
  const view = (id: string): MachineViewBuiltInViewDefinition => {
    const found = getMachineViewBuiltInViews("machines").find(
      (builtIn) => builtIn.id === id
    );
    if (!found) throw new Error(`No Built-in View ${id}`);
    return found;
  };

  it("takes the view's search, filters, and sorting and keeps the fields and page size showing", () => {
    expect(
      applyMachineBuiltInView("machines", view("service-due"), current)
    ).toEqual({
      ...view("service-due").state,
      q: "",
      pageSize: 50,
      columns: [...preset.columns, "owner"],
    });
  });

  it("adds the fields the view names, once", () => {
    const recentlyAdded = view("recently-added");
    expect(
      applyMachineBuiltInView("machines", recentlyAdded, current).columns
    ).toEqual([...preset.columns, "owner", "dateAdded"]);
    expect(
      applyMachineBuiltInView("machines", recentlyAdded, recentlyAdded.state)
        .columns
    ).toEqual([...preset.columns, "dateAdded"]);
  });
});
