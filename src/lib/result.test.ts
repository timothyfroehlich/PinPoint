import { describe, it, expect } from "vitest";
import { ok, err } from "~/lib/result";

describe("Result Helpers", () => {
  describe("ok()", () => {
    it("should return a success result object", () => {
      const result = ok("success value");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("success value");
      }
    });

    it("should handle object values", () => {
      const data = { id: 1, name: "test" };
      const result = ok(data);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(data);
      }
    });
  });

  describe("err()", () => {
    it("should return an error result object", () => {
      const result = err("ERROR_CODE", "Error message");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ERROR_CODE");
        expect(result.message).toBe("Error message");
      }
    });
  });
});
