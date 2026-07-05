// Presets for the machine-level "How to change settings" field.
//
// These are starting templates an owner can apply and then edit per machine —
// the instructions for reaching a game's adjustments menu are essentially
// identical across all games sharing a control/menu platform, so no one should
// have to retype them. Researched menu paths (operator manuals / Stern service
// bulletins / IPDB / PinWiki); see PP-5r0p.
//
// Scope: ONLY platforms that have an actual coin-door or on-screen adjustment
// MENU. Electromechanical games and DIP-switch-only systems (Gottlieb System 1,
// Stern MPU-100/200, Williams System 3-7) are deliberately omitted — for them a
// preset could only say "there's no menu, read the manual," which is useless.
//
// Every body points operators at the constructive path — how to apply factory
// Adjustments / Installs / Presets to restore defaults. They are deliberately
// terse: obvious modern coin-door button legends (select/up/down/back) are left
// out; only the non-obvious entry quirks are spelled out.

import { type ProseMirrorDoc, plainTextToDoc } from "~/lib/tiptap/types";

export interface SettingsInstructionsPreset {
  /** Stable slug, used as React key and in tests. */
  key: string;
  /** Short platform/era name shown in the picker. */
  label: string;
  /** The instructions, as a ProseMirror document ready to drop into the field. */
  doc: ProseMirrorDoc;
}

interface PresetSource {
  key: string;
  label: string;
  body: string;
}

// Ordered roughly modern -> classic, since modern games dominate tournament use.
const PRESET_SOURCES: readonly PresetSource[] = [
  {
    key: "stern-spike",
    label: "Stern SPIKE / SPIKE 2 / SPIKE 3 (LCD)",
    body:
      "Open the coin door and enter the Service Menu.\n" +
      "For tournament play, turn on Standard Adjustments → Competition Mode — a single no-random toggle, not the Competition install (which overwrites other settings).\n" +
      "Restore defaults via Utilities → Presets → Default.",
  },
  {
    key: "stern-sam",
    label: "Stern Whitestar / S.A.M. (DMD)",
    body:
      "Open the coin door and enter the menu.\n" +
      "For tournament play, turn on Standard Adjustments → Competition Mode — a single no-random toggle, not the Install Competition bundle (which overwrites other settings).\n" +
      "Restore factory adjustments via Utilities → Installs → Factory (the manufacturing-plant icon).",
  },
  {
    key: "jjp",
    label: "Jersey Jack (JJP, LCD)",
    body:
      "Open the coin door and enter the menu.\n" +
      "Settings are grouped (System / Pricing / Game / Coil / High Score). For tournament play, turn on System Settings → General → Competition Mode — a single toggle that disables random awards and carry-over. Changed settings show red, defaults green.\n\n" +
      "Use Install Presets / Restore Factory Defaults to reset adjustments cleanly.",
  },
  {
    key: "multimorphic-p3",
    label: "Multimorphic P3",
    body:
      "Open the coin door and enter the operator menu on the LCD.\n" +
      "Tournament settings are per-game — set them in the active module's operator settings. The P3 has no single platform-wide competition toggle and no bundled install.\n\n" +
      "Change settings and exit to save; use the menu's defaults/restore option to reset settings.",
  },
  {
    key: "spooky",
    label: "Spooky Pinball (LCD)",
    body:
      "Open the coin door and enter the on-screen menu; top level is Settings / Tests / Statistics / Utilities.\n" +
      'Restore defaults via Utilities → Factory Settings. For tournament play, flip the per-game Tournament toggle under Settings (e.g. "Tournament Rules" → Enabled) — Spooky has no competition install to apply.',
  },
  {
    key: "american-pinball",
    label: "American Pinball (LCD)",
    body:
      "Open the coin door and press MENU SELECT to enter service mode; highlight the Settings icon, then page through the categories with the flipper buttons (Standard / Features / Pricing / Replay / Sound / Coil).\n" +
      "For tournament play, turn on Standard Adjustments → Tournament Mode — a single no-random toggle that doesn't overwrite your other settings. Restore defaults via the menu's factory-default option.",
  },
  {
    key: "wpc",
    label: "Bally / Williams WPC (alphanumeric + DMD)",
    body:
      "Open the coin door and enter the menu with the service button.\n" +
      "Adjustments are under A. Adjustments; the difficulty presets (Extra Easy → Extra Hard) and factory-default restore are under U. Utilities.\n\n" +
      "Use the Utilities preset / Factory Adjustments option to restore defaults.",
  },
  {
    key: "data-east-ease-a-just",
    label: "Data East / early Sega — Ease-A-Just (1987–1994)",
    body:
      "Open the coin door and hold the green button UP to enter Audits/Adjustments (green DOWN = Diagnostics).\n" +
      "Settings save on exit. Restore defaults with the menu's factory-adjustment option.",
  },
  {
    key: "sega-portals",
    label: "Sega — Portals icon menu (1995–1998)",
    body:
      "Open the coin door and press the black button to open the Portals icon menu; navigate with the flippers.\n" +
      "Settings save on exit. Restore defaults with the menu's factory-adjustment option.",
  },
  {
    key: "williams-sys9-11",
    label: "Williams System 9 / 11 (1984–1990)",
    body:
      "Open the coin door. Set the Auto-Up/Manual-Down switch UP, then press Advance to enter Audits & Adjustments (switch DOWN + Advance enters Diagnostics instead).\n" +
      "Step through with Advance; the credit button changes or zeroes the selected value. Settings are battery-backed and save on exit.\n\n" +
      "To restore defaults, use the game's factory-adjustment (set-all-defaults) number from the manual.",
  },
  {
    key: "bally-as2518",
    label: "Bally solid state (AS-2518, feature adjust)",
    body:
      "Open the coin door and press the self-test button to step through the test sequence into the numbered feature adjustments — the setting number shows in one display, its value in another.\n" +
      "Advance with the self-test button; change the highlighted value with the credit button. Settings are battery-backed and save when you exit.\n\n" +
      "These games have no on-screen factory-default install — set features individually per the game's manual.",
  },
  {
    key: "gottlieb-sys3",
    label: "Gottlieb / Premier System 3 (DMD)",
    body:
      "Press the menu button on the CPU board to bring the operator menu up on the DMD.\n" +
      "Navigate with the cabinet flipper buttons; exit to save.\n\n" +
      "Use the factory/default install option to reset settings. (Free play is set via the tournament/free-play adjustment.)",
  },
];

export const SETTINGS_INSTRUCTIONS_PRESETS: readonly SettingsInstructionsPreset[] =
  PRESET_SOURCES.map((p) => ({
    key: p.key,
    label: p.label,
    doc: plainTextToDoc(p.body),
  }));
