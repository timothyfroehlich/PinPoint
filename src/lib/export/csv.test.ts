import { describe, expect, it } from "vitest";
import { generateCsv } from "./csv";

describe("generateCsv", () => {
  it("generates header row and data rows", () => {
    const result = generateCsv(
      ["Name", "Value"],
      [
        ["Alice", "10"],
        ["Bob", "20"],
      ]
    );
    const lines = result.split("\r\n");
    expect(lines[0]).toBe("\uFEFFName,Value");
    expect(lines[1]).toBe("Alice,10");
    expect(lines[2]).toBe("Bob,20");
    expect(lines[3]).toBe(""); // trailing newline
  });

  it("quotes fields containing commas", () => {
    const result = generateCsv(["Col"], [["hello, world"]]);
    expect(result).toContain('"hello, world"');
  });

  it("escapes double quotes by doubling them", () => {
    const result = generateCsv(["Col"], [['say "hi"']]);
    expect(result).toContain('"say ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    const result = generateCsv(["Col"], [["line1\nline2"]]);
    expect(result).toContain('"line1\nline2"');
  });

  it("handles empty data", () => {
    const result = generateCsv(["A", "B"], []);
    const lines = result.split("\r\n");
    expect(lines[0]).toBe("\uFEFFA,B");
    expect(lines[1]).toBe("");
  });

  it("handles empty string fields", () => {
    const result = generateCsv(["A", "B"], [["", "val"]]);
    expect(result).toContain(",val");
  });
});
