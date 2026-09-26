import { describe, expect, it } from "vitest";
import {
  apronCardContent,
  apronCardPixelSize,
  apronCreditRows,
  cardParagraphs,
  fitTitleSize,
  groupedEdition,
  shrinkUntilFits,
} from "~/lib/machines/apron-card";
import { NO_CREDITS } from "~/lib/opdb/credits";
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
    manufacturer: "Old Copy",
    pinballmapMachineId: 3416,
    pinballmapExcluded: false,
    year: 2021,
    description: plainTextToDoc("Main description"),
    apronUseCustomDescription: false,
    apronDescription: "Custom description",
    apronTip: "Aim for the scoop",
    apronTipEnabled: false,
    apronDesignEnabled: true,
    apronArtEnabled: false,
    owner: { name: "Tim" },
    pinballmapTitle: {
      name: "Godzilla (Premium)",
      machineGroupId: 10,
      groupName: "Godzilla",
      manufacturer: "Stern",
    },
  };

  const credits = { design: ["Keith Elwin"], art: ["Jeremy Packer"] };

  it("uses the main description while retaining disabled tip text", () => {
    expect(apronCardContent(machine, credits)).toMatchObject({
      edition: "Premium Edition",
      description: "Main description",
      tip: "Aim for the scoop",
      tipEnabled: false,
    });
  });

  it("prints the current manufacturer rather than the stored copy", () => {
    expect(apronCardContent(machine, credits).manufacturer).toBe("Stern");
  });

  it("uses the custom description only when selected", () => {
    expect(
      apronCardContent({ ...machine, apronUseCustomDescription: true }, credits)
        .description
    ).toBe("Custom description");
  });

  it("carries the credits and each role's display setting", () => {
    expect(apronCardContent(machine, credits)).toMatchObject({
      credits,
      designEnabled: true,
      artEnabled: false,
    });
  });
});

describe("apronCreditRows", () => {
  const both = { designEnabled: true, artEnabled: true };

  it("shows Design then Art", () => {
    expect(
      apronCreditRows({
        ...both,
        credits: {
          design: ["Pat Lawlor", "Larry DeMar"],
          art: ["John Youssi"],
        },
      })
    ).toEqual([
      { label: "Design", text: "Pat Lawlor, Larry DeMar" },
      { label: "Art", text: "John Youssi" },
    ]);
  });

  it("limits a role to two names and counts the rest (spec 10.3)", () => {
    const [, art] = apronCreditRows({
      ...both,
      credits: {
        design: ["Steve Ritchie"],
        art: ["Bob Stevlic", "Kevin O'Connor", "Stephen Alexander"],
      },
    });
    expect(art?.text).toBe("Bob Stevlic, Kevin O'Connor +1 more");
  });

  it("shows Unknown for a role with no credits (spec 10.4)", () => {
    expect(apronCreditRows({ ...both, credits: NO_CREDITS })).toEqual([
      { label: "Design", text: "Unknown" },
      { label: "Art", text: "Unknown" },
    ]);
  });

  it("drops a role whose display setting is off (spec 10.5)", () => {
    expect(
      apronCreditRows({
        designEnabled: false,
        artEnabled: true,
        credits: { design: ["Keith Elwin"], art: ["Jeremy Packer"] },
      })
    ).toEqual([{ label: "Art", text: "Jeremy Packer" }]);
    expect(
      apronCreditRows({
        designEnabled: false,
        artEnabled: false,
        credits: NO_CREDITS,
      })
    ).toEqual([]);
  });
});

describe("shrinkUntilFits", () => {
  it("keeps the starting size when the panel already fits", () => {
    expect(shrinkUntilFits({ startPx: 42, minPx: 24, fits: () => true })).toBe(
      42
    );
  });

  it("shrinks in half-pixel steps until the panel fits", () => {
    expect(
      shrinkUntilFits({ startPx: 42, minPx: 24, fits: (px) => px <= 33.5 })
    ).toBe(33.5);
  });

  it("stops at the floor when nothing fits", () => {
    expect(shrinkUntilFits({ startPx: 42, minPx: 24, fits: () => false })).toBe(
      24
    );
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
