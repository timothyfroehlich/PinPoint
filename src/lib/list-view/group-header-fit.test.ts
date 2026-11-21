import { describe, expect, it } from "vitest";
import { FIT_TOLERANCE, planGroupHeader } from "./overflow";

// A 92px breadcrumb and a 300px title need 92 + 8 + 300 = 400px inline;
// a description column adds 24 + 280 = 304px beside them.
const breadcrumb = 92;
const title = 300;
const inline = breadcrumb + 8 + title;
const column = 24 + 280;

describe("planGroupHeader (list-views §8.9, §8.10)", () => {
  describe("a Tag, with no description", () => {
    it("keeps the breadcrumb inline while it fits with the tolerance", () => {
      expect(
        planGroupHeader({
          available: inline + FIT_TOLERANCE,
          breadcrumb,
          title,
          description: false,
        })
      ).toEqual({ breadcrumbInline: true, descriptionBeside: false });
    });

    it("moves the breadcrumb above the title inside the tolerance", () => {
      expect(
        planGroupHeader({
          available: inline + FIT_TOLERANCE - 1,
          breadcrumb,
          title,
          description: false,
        }).breadcrumbInline
      ).toBe(false);
    });
  });

  describe("a Collection with a description", () => {
    const fit = (available: number): ReturnType<typeof planGroupHeader> =>
      planGroupHeader({ available, breadcrumb, title, description: true });

    it("puts the breadcrumb inline and the description beside", () => {
      expect(fit(inline + column + FIT_TOLERANCE)).toEqual({
        breadcrumbInline: true,
        descriptionBeside: true,
      });
    });

    it("moves the breadcrumb above first, keeping the description beside", () => {
      // Above the title, the title block is only as wide as the title.
      expect(fit(inline + column + FIT_TOLERANCE - 1)).toEqual({
        breadcrumbInline: false,
        descriptionBeside: true,
      });
      expect(fit(title + column + FIT_TOLERANCE)).toEqual({
        breadcrumbInline: false,
        descriptionBeside: true,
      });
    });

    it("then moves the description under the title", () => {
      expect(fit(title + column + FIT_TOLERANCE - 1)).toEqual({
        breadcrumbInline: false,
        descriptionBeside: false,
      });
    });

    it("measures a breadcrumb wider than the title above it", () => {
      expect(
        planGroupHeader({
          available: 200 + column + FIT_TOLERANCE,
          breadcrumb: 200,
          title: 120,
          description: true,
        })
      ).toEqual({ breadcrumbInline: false, descriptionBeside: true });
    });
  });

  it("never puts a missing breadcrumb inline", () => {
    expect(
      planGroupHeader({
        available: 2000,
        breadcrumb: 0,
        title,
        description: true,
      })
    ).toEqual({ breadcrumbInline: false, descriptionBeside: true });
  });
});
