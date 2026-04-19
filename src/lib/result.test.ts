import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "~/lib/result";

describe("Result Helpers", () => {
  describe("ok()", () => {
    it("should return a success result object", () => {
      const result = ok("success value");
      expect(result.ok).toBe(true);
      expect(result.value).toBe("success value");
    });

    it("should handle object values", () => {
      const data = { id: 1, name: "test" };
      const result = ok(data);
      expect(result.ok).toBe(true);
      expect(result.value).toEqual(data);
    });

    it("should be assignable to Result types for type narrowing in callers", () => {
      type MyResult = Result<{ id: string }, "FAIL">;
      // The success path: ok() is always ok:true
      const result: MyResult = ok({ id: "abc" });
      // ok: true branch can always be accessed directly
      expect(result.ok).toBe(true);
      // Narrowing via a type guard function works for callers who receive MyResult
      const narrowed = [ok({ id: "abc" }), err("FAIL" as const, "oops")];
      const successes = narrowed.filter(
        (r): r is Extract<typeof r, { ok: true }> => r.ok
      );
      expect(successes[0]?.value.id).toBe("abc");
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
