import { describe, it, expect } from "vitest";
import { buildResourceUrl } from "./resource-url";

const siteUrl = "https://app.example.com";

describe("buildResourceUrl", () => {
  describe("issues", () => {
    it("builds the canonical /m/<INITIALS>/i/<number> URL", () => {
      expect(
        buildResourceUrl({
          siteUrl,
          resourceType: "issue",
          formattedIssueId: "RUSH-01",
        })
      ).toBe("https://app.example.com/m/RUSH/i/1");
    });

    it("strips leading zeros from the issue number", () => {
      expect(
        buildResourceUrl({
          siteUrl,
          resourceType: "issue",
          formattedIssueId: "AFM-007",
        })
      ).toBe("https://app.example.com/m/AFM/i/7");
    });

    it("handles multi-digit issue numbers", () => {
      expect(
        buildResourceUrl({
          siteUrl,
          resourceType: "issue",
          formattedIssueId: "TWD-1234",
        })
      ).toBe("https://app.example.com/m/TWD/i/1234");
    });

    it("accepts digits in the initials", () => {
      expect(
        buildResourceUrl({
          siteUrl,
          resourceType: "issue",
          formattedIssueId: "T2-05",
        })
      ).toBe("https://app.example.com/m/T2/i/5");
    });

    it.each([
      ["absent", undefined],
      ["no separator", "RUSH01"],
      ["non-numeric suffix", "RUSH-XX"],
      ["initials too short", "R-01"],
      ["initials too long", "ABCDEFG-01"],
      ["lowercase initials", "rush-01"],
      ["empty", ""],
    ])(
      "falls back to /issues when the id is %s",
      (_label, formattedIssueId) => {
        expect(
          buildResourceUrl({ siteUrl, resourceType: "issue", formattedIssueId })
        ).toBe("https://app.example.com/issues");
      }
    );

    it("never emits the id-addressed shape that 404'd (PP-gzq2)", () => {
      const url = buildResourceUrl({
        siteUrl,
        resourceType: "issue",
        formattedIssueId: "RUSH-01",
      });
      expect(url).not.toMatch(/\/issues\//);
    });
  });

  describe("machines", () => {
    it("builds the canonical /m/<INITIALS> URL", () => {
      expect(
        buildResourceUrl({
          siteUrl,
          resourceType: "machine",
          machineInitials: "MM",
        })
      ).toBe("https://app.example.com/m/MM");
    });

    it.each([
      ["absent", undefined],
      ["too short", "M"],
      ["too long", "ABCDEFG"],
      ["lowercase", "mm"],
      ["containing a slash", "M/M"],
    ])(
      "falls back to /m when the initials are %s",
      (_label, machineInitials) => {
        expect(
          buildResourceUrl({
            siteUrl,
            resourceType: "machine",
            machineInitials,
          })
        ).toBe("https://app.example.com/m");
      }
    );

    it("ignores formattedIssueId for machine resources", () => {
      expect(
        buildResourceUrl({
          siteUrl,
          resourceType: "machine",
          machineInitials: "WW",
          formattedIssueId: "AFM-07",
        })
      ).toBe("https://app.example.com/m/WW");
    });
  });
});
