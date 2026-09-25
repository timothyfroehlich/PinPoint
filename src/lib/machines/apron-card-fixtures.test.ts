import { describe, expect, it } from "vitest";
import {
  APRON_CARD_LAYOUTS,
  fitTitleSize,
  type MeasureText,
} from "~/lib/machines/apron-card";
import {
  APRON_STRESS_FIXTURES,
  takeWords,
  withFilledText,
} from "~/lib/machines/apron-card-fixtures";

/**
 * Advance widths of Barlow Condensed ExtraBold (800), the title face, in
 * thousandths of an em — measured with canvas measureText from the same
 * Google Fonts file next/font self-hosts. Kerning is ignored, which
 * overstates a title's width by about 1%, so a fit that passes here also
 * passes in the browser. Characters not listed count as a wide 0.5em.
 */
// prettier-ignore
const TITLE_ADVANCE: Readonly<Record<string, number>> = {
  " ": 200, "!": 289, '"': 385, "#": 626, $: 454, "%": 761, "&": 624,
  "'": 188, "(": 343, ")": 343, "*": 362, "+": 437, ",": 223, "-": 337,
  ".": 235, "/": 444, ":": 298, ";": 246, "?": 462, "@": 760,
  0: 456, 1: 294, 2: 451, 3: 446, 4: 508, 5: 450, 6: 451, 7: 422, 8: 446,
  9: 446, A: 508, B: 477, C: 470, D: 480, E: 441, F: 427, G: 473, H: 483,
  I: 235, J: 462, K: 505, L: 437, M: 558, N: 522, O: 479, P: 474, Q: 467,
  R: 481, S: 454, T: 485, U: 480, V: 506, W: 707, X: 490, Y: 492, Z: 419,
};

const measureTitle: MeasureText = (text, px) =>
  ([...text].reduce((em, ch) => em + (TITLE_ADVANCE[ch] ?? 500), 0) / 1000) *
  px;

describe("apron stress fixtures", () => {
  it("have unique ids", () => {
    const ids = APRON_STRESS_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cover the cases PP-xeki names", () => {
    const fixtures = APRON_STRESS_FIXTURES;
    expect(fixtures.some((f) => f.credits.art.length > 2)).toBe(true);
    expect(
      fixtures.some(
        (f) => f.credits.design.length === 0 && f.credits.art.length === 0
      )
    ).toBe(true);
    expect(
      fixtures.some(
        (f) =>
          f.content.edition !== null &&
          f.content.ownerName !== null &&
          f.credits.design.length > 0 &&
          f.credits.art.length > 0
      )
    ).toBe(true);
    expect(
      fixtures.some(
        (f) =>
          f.content.manufacturer === null &&
          f.content.year === null &&
          f.content.ownerName === null
      )
    ).toBe(true);
    const fills = fixtures.flatMap((f) =>
      f.textFill
        ? [`${f.textFill.field}:${f.textFill.at}:${f.content.tipEnabled}`]
        : []
    );
    expect(fills).toEqual(
      expect.arrayContaining([
        "description:limit:false",
        "description:limit:true",
        "description:over:true",
      ])
    );
  });

  it("fill a text field word by word", () => {
    expect(takeWords("One two  three\nfour", 3)).toBe("One two three");
    const fixture = APRON_STRESS_FIXTURES.find(
      (f) => f.id === "description-tip-at-limit"
    );
    expect(fixture).toBeDefined();
    if (!fixture) return;
    const content = withFilledText(fixture, 4);
    expect(content.description.split(" ")).toHaveLength(4);
    expect(content.tip).toBe(fixture.content.tip);
  });
});

// Every size in APRON_CARD_LAYOUTS (keyed by APRON_CARD_SIZES), so a new size
// is covered without touching this file.
describe.each(Object.entries(APRON_CARD_LAYOUTS))(
  "title fit at the %s size",
  (_size, layout) => {
    for (const fixture of APRON_STRESS_FIXTURES) {
      const test = fixture.knownIssue ? it.fails : it;
      const suffix = fixture.knownIssue
        ? ` (known issue ${fixture.knownIssue})`
        : "";

      test(`${fixture.id}: every word fits the panel at a readable size${suffix}`, () => {
        const title = fixture.content.name.toUpperCase();
        const px = fitTitleSize({
          title,
          maxWidth: layout.titleMaxWidth,
          maxPx: layout.titleMaxPx,
          minPx: layout.titleMinPx,
          measure: measureTitle,
        });

        expect(px).toBeGreaterThanOrEqual(layout.titleMinPx);
        const widest = Math.max(
          ...title.split(/\s+/).map((word) => measureTitle(word, px))
        );
        expect(widest).toBeLessThanOrEqual(layout.titleMaxWidth);
      });
    }
  }
);
