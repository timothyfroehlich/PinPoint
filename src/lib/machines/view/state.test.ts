import { describe, expect, it } from "vitest";
import {
  nextMachineViewSort,
  parseMachineViewState,
  serializeMachineViewState,
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
      columns: ["machine", "playability", "openIssues", "lastServiced"],
    });
  });

  it("uses the Collection preset defaults independently", () => {
    const state = parseMachineViewState(new URLSearchParams(), "collection");
    expect(state.presence).toBe("all");
    expect({ sort: state.sort, dir: state.dir }).toEqual({
      sort: "playability",
      dir: "desc",
    });
  });

  it("accepts explicit all presence and canonical comma-separated values", () => {
    const params = new URLSearchParams({
      presence: "all",
      status: "unplayable,operational,invalid",
      owner: "owner-2,unassigned,owner-2",
      columns: "machine,year,invalid,owner",
      pageSize: "50",
    });
    const state = parseMachineViewState(params, "machines");

    expect(state.presence).toBe("all");
    expect(state.status).toEqual(["unplayable", "operational"]);
    expect(state.owner).toEqual(["owner-2", "unassigned"]);
    expect(state.columns).toEqual(["machine", "year", "owner"]);
    expect(state.pageSize).toBe(50);
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
    expect(state.columns).toEqual([
      "machine",
      "playability",
      "openIssues",
      "lastServiced",
    ]);
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
      owner: ["unassigned"],
      sort: "year" as const,
      dir: "desc" as const,
      page: 3,
      pageSize: 100 as const,
      columns: ["machine" as const, "year" as const],
    };
    const serialized = serializeMachineViewState(state, "machines");
    expect(serialized.toString()).toBe(
      "q=mars&presence=all&status=needs_service&owner=unassigned&sort=year&dir=desc&page=3&pageSize=100&columns=machine%2Cyear"
    );
    expect(parseMachineViewState(serialized, "machines")).toEqual(state);
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
