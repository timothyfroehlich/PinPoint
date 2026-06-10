import { describe, it, expect } from "vitest";

import { serializeSetForDirtyCheck } from "~/lib/machines/settings-dirty";
import type { SettingsSection } from "~/lib/machines/settings-types";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

/**
 * Unit tests for the client-side dirty-check serializer. It must mirror the
 * server's no-op guard ({ name, description, sections }) while ignoring the
 * client-only `_key` render key — two structurally-equal sets serialize to the
 * same string, any real content change produces a different one.
 */

function sw(
  rows: { id: string; name: string; value: string; _key: string }[]
): SettingsSection {
  return {
    id: "sec-sw",
    kind: "software",
    baseline: "Competition Install",
    baselineNote: "Coin door → A.1",
    rows,
  };
}

function dip(
  switches: {
    switch: string;
    position: "ON" | "OFF";
    note: string;
    _key: string;
  }[]
): SettingsSection {
  return { kind: "dip", id: "sec-dip", name: "Bank A", switches };
}

function set(over: {
  name?: string;
  description?: ProseMirrorDoc | null;
  sections?: SettingsSection[];
}): {
  name: string;
  description: ProseMirrorDoc | null;
  sections: SettingsSection[];
} {
  return {
    name: over.name ?? "Tournament",
    description: over.description ?? null,
    sections: over.sections ?? [
      sw([
        { _key: "k1", id: "A.1 01", name: "Balls Per Game", value: "3" },
        { _key: "k2", id: "A.1 02", name: "Tilt Warnings", value: "2" },
      ]),
      dip([{ _key: "d1", switch: "1", position: "OFF", note: "Free play" }]),
    ],
  };
}

const baseline = serializeSetForDirtyCheck(set({}));

describe("serializeSetForDirtyCheck", () => {
  it("ignores the client-only _key (different keys, same content → equal)", () => {
    const reKeyed = set({
      sections: [
        sw([
          { _key: "X9", id: "A.1 01", name: "Balls Per Game", value: "3" },
          { _key: "X8", id: "A.1 02", name: "Tilt Warnings", value: "2" },
        ]),
        dip([{ _key: "Z0", switch: "1", position: "OFF", note: "Free play" }]),
      ],
    });
    expect(serializeSetForDirtyCheck(reKeyed)).toBe(baseline);
  });

  it("detects a name change", () => {
    expect(serializeSetForDirtyCheck(set({ name: "Home" }))).not.toBe(baseline);
  });

  it("detects a description change", () => {
    const withDesc = set({
      description: {
        type: "doc",
        content: [{ type: "paragraph" }],
      } as unknown as ProseMirrorDoc,
    });
    expect(serializeSetForDirtyCheck(withDesc)).not.toBe(baseline);
  });

  it("detects a software row value change", () => {
    const changed = set({
      sections: [
        sw([
          { _key: "k1", id: "A.1 01", name: "Balls Per Game", value: "5" },
          { _key: "k2", id: "A.1 02", name: "Tilt Warnings", value: "2" },
        ]),
        dip([{ _key: "d1", switch: "1", position: "OFF", note: "Free play" }]),
      ],
    });
    expect(serializeSetForDirtyCheck(changed)).not.toBe(baseline);
  });

  it("detects a DIP switch toggle", () => {
    const toggled = set({
      sections: [
        sw([
          { _key: "k1", id: "A.1 01", name: "Balls Per Game", value: "3" },
          { _key: "k2", id: "A.1 02", name: "Tilt Warnings", value: "2" },
        ]),
        dip([{ _key: "d1", switch: "1", position: "ON", note: "Free play" }]),
      ],
    });
    expect(serializeSetForDirtyCheck(toggled)).not.toBe(baseline);
  });

  it("detects removing a row", () => {
    const removed = set({
      sections: [
        sw([{ _key: "k1", id: "A.1 01", name: "Balls Per Game", value: "3" }]),
        dip([{ _key: "d1", switch: "1", position: "OFF", note: "Free play" }]),
      ],
    });
    expect(serializeSetForDirtyCheck(removed)).not.toBe(baseline);
  });
});
