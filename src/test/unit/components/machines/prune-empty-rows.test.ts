import { describe, expect, it } from "vitest";
import { pruneEmptyRows } from "~/components/machines/settings/prune-empty-rows";
import type { SettingsSection } from "~/lib/machines/settings-types";

const software = (
  rows: { _key: string; id: string; name: string; value: string }[]
): SettingsSection => ({
  id: "s1",
  kind: "software",
  baseline: "Factory Install",
  rows,
});

describe("pruneEmptyRows", () => {
  it("drops a fully-empty software row", () => {
    const out = pruneEmptyRows(
      software([
        { _key: "1", id: "", name: "", value: "" },
        { _key: "2", id: "A.1", name: "Balls", value: "3" },
      ])
    );
    expect(out.kind === "software" && out.rows).toHaveLength(1);
    expect(out.kind === "software" && out.rows[0]?._key).toBe("2");
  });

  it("keeps a row that has ANY field filled (id only)", () => {
    const out = pruneEmptyRows(
      software([{ _key: "1", id: "A.1", name: "", value: "" }])
    );
    expect(out.kind === "software" && out.rows).toHaveLength(1);
  });

  it("treats whitespace-only fields as empty", () => {
    const out = pruneEmptyRows(
      software([{ _key: "1", id: "  ", name: "\t", value: " " }])
    );
    expect(out.kind === "software" && out.rows).toHaveLength(0);
  });

  it("drops a dip switch with no switch id and no note (OFF is not content)", () => {
    const dip: SettingsSection = {
      id: "d1",
      kind: "dip",
      name: "Bank 1",
      switches: [
        { _key: "1", switch: "", position: "OFF", note: "" },
        { _key: "2", switch: "SW1", position: "ON", note: "free play" },
      ],
    };
    const out = pruneEmptyRows(dip);
    expect(out.kind === "dip" && out.switches).toHaveLength(1);
  });

  it("returns note sections unchanged", () => {
    const note: SettingsSection = {
      id: "n1",
      kind: "note",
      title: "X",
      customTitle: true,
      body: null,
    };
    expect(pruneEmptyRows(note)).toBe(note);
  });

  it("returns the same reference when nothing is pruned", () => {
    const section = software([
      { _key: "1", id: "A.1", name: "Balls", value: "3" },
    ]);
    expect(pruneEmptyRows(section)).toBe(section);
  });

  it("prunes empty rows from a table section", () => {
    const table: SettingsSection = {
      id: "t1",
      kind: "table",
      title: "Transformer taps",
      rows: [
        { _key: "1", id: "", name: "", value: "" },
        { _key: "2", id: "", name: "Tap A", value: "24V" },
      ],
    };
    const out = pruneEmptyRows(table);
    expect(out.kind === "table" && out.rows).toHaveLength(1);
    expect(out.kind === "table" && out.rows[0]?._key).toBe("2");
  });

  it("keeps a dip switch that has only a note (switch id blank)", () => {
    const dip: SettingsSection = {
      id: "d1",
      kind: "dip",
      name: "Bank 1",
      switches: [
        { _key: "1", switch: "", position: "OFF", note: "see manual" },
      ],
    };
    const out = pruneEmptyRows(dip);
    expect(out.kind === "dip" && out.switches).toHaveLength(1);
  });
});
