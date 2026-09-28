import { describe, expect, it } from "vitest";

import {
  convertedIssueDescription,
  ISSUE_TITLE_MAX,
  pinballmapCommenterName,
  suggestIssueTitle,
} from "./comment-conversion";

describe("suggestIssueTitle", () => {
  it("uses the first non-empty line, whitespace collapsed", () => {
    expect(suggestIssueTitle("\n  Left   flipper weak \nneeds a coil")).toBe(
      "Left flipper weak"
    );
  });

  it("cuts a long line at a word boundary and marks the cut", () => {
    const title = suggestIssueTitle(
      "The right ramp diverter sticks open after multiball and the ball drains down the outlane every time"
    );
    expect(title.length).toBeLessThanOrEqual(ISSUE_TITLE_MAX);
    expect(title.endsWith("…")).toBe(true);
    expect(title).toBe(
      "The right ramp diverter sticks open after multiball and the…"
    );
  });

  it("hard-cuts a line with no usable word boundary", () => {
    const title = suggestIssueTitle("x".repeat(100));
    expect(title).toBe(`${"x".repeat(ISSUE_TITLE_MAX - 1)}…`);
  });

  it("returns an empty suggestion for an empty comment", () => {
    expect(suggestIssueTitle("   \n ")).toBe("");
  });
});

describe("pinballmapCommenterName", () => {
  it("names an operator entry that carries no username", () => {
    expect(pinballmapCommenterName(null)).toBe("Pinball Map user");
    expect(pinballmapCommenterName("flipperfan")).toBe("flipperfan");
  });
});

describe("convertedIssueDescription", () => {
  it("quotes the comment and links the location listing for attribution", () => {
    const doc = convertedIssueDescription({
      comment: "Left flipper weak\nneeds a coil\n\nAlso a bulb out",
      username: "flipperfan",
      commentedAt: new Date("2026-03-04T12:00:00Z"),
      locationId: 26454,
    });

    expect(doc.content[0]).toEqual({
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Left flipper weak" },
            { type: "hardBreak" },
            { type: "text", text: "needs a coil" },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Also a bulb out" }],
        },
      ],
    });
    const attribution = JSON.stringify(doc.content[1]);
    expect(attribution).toContain("flipperfan");
    expect(attribution).toContain(
      "https://pinballmap.com/map/?by_location_id=26454"
    );
  });
});
