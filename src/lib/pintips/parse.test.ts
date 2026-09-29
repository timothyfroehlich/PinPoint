import { describe, expect, it } from "vitest";
import {
  opdbGroupId,
  parsePinTip,
  parsePinTipsExport,
  pinTipsPageUrl,
} from "./parse";

const raw = {
  tipId: 7,
  opdbId: "GweeP",
  category: "multiball",
  voteTotal: 9,
  text: "  Spin the right spinner 30 times for the add-a-ball.  ",
  createdAt: "2015-08-05 20:28:10",
  updatedAt: "2026-09-28 05:00:54",
};

describe("parsePinTip", () => {
  it("keeps the fields the card needs and trims the text", () => {
    expect(parsePinTip(raw)).toEqual({
      tipId: 7,
      opdbGroupId: "GweeP",
      category: "multiball",
      voteTotal: 9,
      text: "Spin the right spinner 30 times for the add-a-ball.",
    });
  });

  it("never keeps an illegal-category tip (spec 2.6)", () => {
    expect(parsePinTip({ ...raw, category: "illegal" })).toBeNull();
  });

  it.each([
    ["an unknown category", { category: "strategy" }],
    ["a machine-level OPDB id", { opdbId: "GweeP-Ml9pZ" }],
    ["a non-integer vote total", { voteTotal: "9" }],
    ["blank text", { text: "   " }],
    ["a missing tip id", { tipId: undefined }],
  ])("skips an entry with %s", (_label, override) => {
    expect(parsePinTip({ ...raw, ...override })).toBeNull();
  });
});

describe("parsePinTipsExport", () => {
  it("parses an array, dropping bad and duplicate entries", () => {
    const tips = parsePinTipsExport([
      raw,
      { ...raw, tipId: 8, category: "illegal" },
      raw,
      "junk",
    ]);
    expect(tips.map((t) => t.tipId)).toEqual([7]);
  });

  it("reads anything but an array as no tips", () => {
    expect(parsePinTipsExport({ tips: [raw] })).toEqual([]);
  });
});

describe("opdbGroupId", () => {
  it("reduces machine and alias ids to their game", () => {
    expect(opdbGroupId("GweeP")).toBe("GweeP");
    expect(opdbGroupId("GweeP-Ml9pZ")).toBe("GweeP");
    expect(opdbGroupId("GweeP-Ml9pZ-ARZoY")).toBe("GweeP");
    expect(opdbGroupId("not-an-id")).toBeNull();
  });
});

describe("pinTipsPageUrl", () => {
  it("links the game's tips on Match Play", () => {
    expect(pinTipsPageUrl("GweeP")).toBe(
      "https://app.matchplay.events/opdb/entries/GweeP/pintips"
    );
  });
});
