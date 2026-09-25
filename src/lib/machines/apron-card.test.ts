import { describe, expect, it } from "vitest";
import {
  apronCardContent,
  apronCardPixelSize,
  cardParagraphs,
  fitTitleSize,
  groupedEdition,
} from "~/lib/machines/apron-card";
import { qrSvgPath } from "~/lib/machines/apron-qr";
import { plainTextToDoc } from "~/lib/tiptap/types";

describe("groupedEdition", () => {
  it("maps edition suffixes only within Pinball Map groups", () => {
    expect(
      groupedEdition({
        name: "Godzilla (Premium)",
        machineGroupId: 10,
        groupName: "Godzilla",
      })
    ).toBe("Premium Edition");
    expect(
      groupedEdition({
        name: "Godzilla (LE)",
        machineGroupId: 10,
        groupName: "Godzilla",
      })
    ).toBe("Limited Edition");
    expect(
      groupedEdition({
        name: "Attack From Mars (Remake) (Special Edition)",
        machineGroupId: 11,
        groupName: "Attack From Mars",
      })
    ).toBe("Remake Special Edition");
  });

  it("never parses parentheticals from ungrouped titles", () => {
    expect(
      groupedEdition({
        name: "Eight Ball Deluxe (EM)",
        machineGroupId: null,
        groupName: null,
      })
    ).toBeNull();
    expect(
      groupedEdition({
        name: "Godzilla",
        machineGroupId: 10,
        groupName: "Godzilla",
      })
    ).toBeNull();
  });
});

describe("apronCardContent", () => {
  const machine = {
    name: "Godzilla",
    manufacturer: "Stern",
    year: 2021,
    description: plainTextToDoc("Main description"),
    apronUseCustomDescription: false,
    apronDescription: "Custom description",
    apronTip: "Aim for the scoop",
    apronTipEnabled: false,
    owner: { name: "Tim" },
    pinballmapTitle: {
      name: "Godzilla (Premium)",
      machineGroupId: 10,
      groupName: "Godzilla",
    },
  };

  it("uses the main description while retaining disabled tip text", () => {
    expect(apronCardContent(machine)).toMatchObject({
      edition: "Premium Edition",
      description: "Main description",
      tip: "Aim for the scoop",
      tipEnabled: false,
    });
  });

  it("uses the custom description only when selected", () => {
    expect(
      apronCardContent({ ...machine, apronUseCustomDescription: true })
        .description
    ).toBe("Custom description");
  });
});

describe("fitTitleSize", () => {
  // Monospace stand-in: every glyph is 0.5em wide.
  const measure = (text: string, px: number): number => text.length * px * 0.5;
  const base = { maxWidth: 174, maxPx: 42, minPx: 24, measure };

  it("keeps the maximum size when the title already fits", () => {
    expect(fitTitleSize({ ...base, title: "GODZILLA" })).toBe(42);
  });

  it("shrinks until the longest word fits on one line", () => {
    // 12 glyphs × 0.5em must be ≤ 174px → ≤ 29px.
    expect(fitTitleSize({ ...base, title: "TRANSFORMERS" })).toBe(29);
  });

  it("shrinks until the whole title wraps to three lines or fewer", () => {
    const size = fitTitleSize({
      ...base,
      title: "INDIANA JONES: THE PINBALL ADVENTURE",
    });
    expect(size).toBeLessThan(42);
    expect(size).toBeGreaterThanOrEqual(24);
  });

  it("stops at the floor rather than breaking a word", () => {
    expect(
      fitTitleSize({ ...base, title: "SUPERCALIFRAGILISTICEXPIALIDOCIOUS" })
    ).toBe(24);
  });
});

describe("card helpers", () => {
  it("splits card text into trimmed paragraphs", () => {
    expect(cardParagraphs("One.\n\n  Two.  \n")).toEqual(["One.", "Two."]);
  });

  it("gives each size its physical dimensions at 96px per inch", () => {
    const wpc = apronCardPixelSize("wpc");
    expect(wpc.width).toBeCloseTo(576, 6);
    expect(wpc.height).toBeCloseTo(312, 6);
    expect(apronCardPixelSize("stern").width).toBeCloseTo(529.13, 2);
  });

  it("renders a QR code as a single path over a square grid", () => {
    const { size, path } = qrSvgPath(
      "https://pinpoint.austinpinballcollective.org/m/GDZ/hub?source=apron"
    );
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith("M")).toBe(true);
  });
});
