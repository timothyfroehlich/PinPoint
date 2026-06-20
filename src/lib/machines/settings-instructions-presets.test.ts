import { describe, it, expect } from "vitest";

import { SETTINGS_INSTRUCTIONS_PRESETS } from "./settings-instructions-presets";
import { docToPlainText } from "~/lib/tiptap/types";

describe("SETTINGS_INSTRUCTIONS_PRESETS", () => {
  it("covers the menu-driven platform families with unique keys", () => {
    expect(SETTINGS_INSTRUCTIONS_PRESETS.length).toBe(12);
    const keys = SETTINGS_INSTRUCTIONS_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    // The two named families that prompted the feature must be present.
    expect(keys).toContain("stern-spike");
    expect(keys).toContain("wpc");
    expect(keys).toContain("williams-sys9-11");
  });

  it("each preset is a non-empty ProseMirror doc with a label", () => {
    for (const preset of SETTINGS_INSTRUCTIONS_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.doc.type).toBe("doc");
      expect(preset.doc.content.length).toBeGreaterThan(0);
      const text = docToPlainText(preset.doc);
      expect(text.length).toBeGreaterThan(0);
      // Markdown emphasis would leak as literal characters — guard against it.
      expect(text).not.toContain("**");
    }
  });

  it("points every body at how to apply Adjustments / Installs / Presets", () => {
    for (const preset of SETTINGS_INSTRUCTIONS_PRESETS) {
      const text = docToPlainText(preset.doc).toLowerCase();
      expect(text).toMatch(/preset|install|adjustment|default|restore/);
    }
  });

  it("does NOT include DIP-only or electromechanical families", () => {
    const keys = SETTINGS_INSTRUCTIONS_PRESETS.map((p) => p.key);
    expect(keys).not.toContain("em");
    expect(keys).not.toContain("stern-mpu");
    expect(keys).not.toContain("gottlieb-sys1");
  });
});
