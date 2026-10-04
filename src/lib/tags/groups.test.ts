import { describe, expect, it } from "vitest";
import { buildTagGroups } from "./groups";
import type { AutomaticTag, HandTag, HandTagType, TagTypeId } from "./types";

const machine = (
  name: string,
  presenceStatus: "on_the_floor" | "removed" = "on_the_floor"
) => ({
  id: name,
  initials: name.slice(0, 2).toUpperCase(),
  name,
  presenceStatus,
});

function handTag(
  name: string,
  typeId: string | null,
  machines: number,
  removed = 0
): HandTag {
  return {
    kind: "hand",
    id: name,
    typeId,
    slug: name.toLowerCase(),
    name,
    href: `/c/tags/x/${name}`,
    machines: [
      ...Array.from({ length: machines }, (_, n) =>
        machine(`${name}${String(n)}`)
      ),
      ...Array.from({ length: removed }, (_, n) =>
        machine(`${name}-removed${String(n)}`, "removed")
      ),
    ],
    // Removed machines stay members but leave the count (spec 7.9).
    machineCount: machines,
  };
}

function handType(id: string, name: string): HandTagType {
  return { id, slug: id, name, exclusive: false, href: `/c/tags/${id}` };
}

const automatic: Record<TagTypeId, AutomaticTag[]> = {
  manufacturer: [
    // Automatic tags keep the order they arrive in (spec 7.3).
    {
      kind: "automatic",
      type: "manufacturer",
      slug: "williams",
      name: "Williams",
      href: "/w",
      machines: [machine("a")],
      machineCount: 1,
    },
    {
      kind: "automatic",
      type: "manufacturer",
      slug: "bally",
      name: "Bally",
      href: "/b",
      machines: [machine("b")],
      machineCount: 1,
    },
  ],
  type: [],
  display: [],
  "player-count": [],
};

/** Spec collections-and-tags 11.13–11.14: browse and machine-page order. */
describe("buildTagGroups", () => {
  const groups = buildTagGroups(
    automatic,
    [
      handType("t", "tournament"),
      handType("l", "Location"),
      handType("e", "Empty type"),
    ],
    [
      handTag("Storage", "l", 0),
      handTag("front room", "l", 2),
      handTag("Back room", "l", 1),
      handTag("Arcade", "l", 0),
      handTag("Old cabinet", "l", 0, 1),
      handTag("Needs rubbers", null, 0),
      handTag("Kid-friendly", null, 3),
    ]
  );
  const summary = groups.map((group) => ({
    group:
      group.kind === "untyped"
        ? "Other"
        : group.kind === "automatic"
          ? group.type.id
          : group.type.name,
    tags: group.tags.map((tag) => tag.name),
  }));

  it("lists automatic types first, then hand types by name, then untyped tags", () => {
    expect(summary.map((entry) => entry.group)).toEqual([
      "manufacturer",
      "type",
      "display",
      "player-count",
      "Empty type",
      "Location",
      "tournament",
      "Other",
    ]);
  });

  it("keeps automatic order and puts hand tags with no machines to count last, each part by name", () => {
    expect(summary[0]?.tags).toEqual(["Williams", "Bally"]);
    expect(summary.find((entry) => entry.group === "Location")?.tags).toEqual([
      "Back room",
      "front room",
      "Arcade",
      // Only a Removed machine: nothing to count, so it sorts with the empty tags.
      "Old cabinet",
      "Storage",
    ]);
    expect(summary.at(-1)?.tags).toEqual(["Kid-friendly", "Needs rubbers"]);
  });

  it("keeps a hand type with no tags", () => {
    expect(summary.find((entry) => entry.group === "Empty type")?.tags).toEqual(
      []
    );
  });
});
