import { describe, expect, it } from "vitest";
import { formatPageSpan, getPageRange, getPagerItems } from "./pagination";

describe("getPageRange (list-views §6.3, §7.8)", () => {
  it("describes the visible records", () => {
    expect(getPageRange(2, 25, 84)).toEqual({
      page: 2,
      pageCount: 4,
      start: 26,
      end: 50,
      total: 84,
    });
    expect(formatPageSpan(getPageRange(4, 25, 84))).toBe("76–84");
  });

  it("shows the last page for a page past the end", () => {
    expect(getPageRange(9, 25, 84)).toMatchObject({
      page: 4,
      start: 76,
      end: 84,
    });
  });

  it("reads an empty list as page 1 of 1 with no records", () => {
    const range = getPageRange(3, 25, 0);
    expect(range).toEqual({
      page: 1,
      pageCount: 1,
      start: 0,
      end: 0,
      total: 0,
    });
    expect(formatPageSpan(range)).toBe("0");
  });
});

describe("getPagerItems (list-views §6.1)", () => {
  const pages = (page: number, count: number): (number | string)[] =>
    getPagerItems(page, count).map((item) =>
      item.kind === "page" ? item.page : "…"
    );

  it("lists every page when there are few", () => {
    expect(pages(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the ends and the current page's neighbors", () => {
    expect(pages(1, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(pages(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(pages(20, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
  });

  it("never hides a single page behind a gap", () => {
    expect(pages(4, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(pages(17, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
  });
});
