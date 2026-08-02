import { describe, it, expect } from "vitest";

import {
  isPostgresError,
  getPostgresErrorCode,
  isPgErrorCode,
  getPostgresErrorConstraint,
} from "~/lib/db/postgres-errors";

const makeBareError = (code: string): Error => {
  const e = new Error("postgres error") as Error & { code: string };
  e.code = code;
  return e;
};

/** postgres-js shape (production): the Postgres wire field name, snake_case. */
const makeConstraintError = (code: string, constraint: string): Error => {
  const e = makeBareError(code) as Error & { constraint_name: string };
  e.constraint_name = constraint;
  return e;
};

/** PGlite shape (integration tests): pg-protocol's camelCase naming. */
const makePgliteConstraintError = (code: string, constraint: string): Error => {
  const e = makeBareError(code) as Error & { constraint: string };
  e.constraint = constraint;
  return e;
};

const makeDrizzleWrap = (cause: Error, message = "Failed query"): Error =>
  new Error(message, { cause });

describe("postgres-errors", () => {
  describe("isPostgresError", () => {
    it("matches a bare postgres-js error with code property", () => {
      expect(isPostgresError(makeBareError("23505"))).toBe(true);
    });

    it("matches a Drizzle-wrapped error via cause chain", () => {
      const wrapped = makeDrizzleWrap(makeBareError("23505"));
      expect(isPostgresError(wrapped)).toBe(true);
    });

    it("matches a doubly-wrapped error (e.g. transaction wrapping)", () => {
      const inner = makeBareError("23503");
      const middle = makeDrizzleWrap(inner, "Transaction failed");
      const outer = makeDrizzleWrap(middle, "Outer wrap");
      expect(isPostgresError(outer)).toBe(true);
    });

    it("returns false for a plain Error with no code anywhere in the chain", () => {
      const inner = new Error("plain");
      const outer = makeDrizzleWrap(inner, "wraps a plain error");
      expect(isPostgresError(outer)).toBe(false);
    });

    it("returns false for non-Error values", () => {
      expect(isPostgresError(null)).toBe(false);
      expect(isPostgresError(undefined)).toBe(false);
      expect(isPostgresError("23505")).toBe(false);
      expect(isPostgresError({ code: "23505" })).toBe(false);
      expect(isPostgresError(42)).toBe(false);
    });

    it("stops walking when cause is not an Error", () => {
      const e = new Error("with non-Error cause", { cause: "string cause" });
      expect(isPostgresError(e)).toBe(false);
    });

    it("ignores non-string code values", () => {
      const e = new Error("bad code type") as Error & { code: number };
      e.code = 23505;
      expect(isPostgresError(e)).toBe(false);
    });
  });

  describe("getPostgresErrorCode", () => {
    it("returns the code from a bare error", () => {
      expect(getPostgresErrorCode(makeBareError("23505"))).toBe("23505");
    });

    it("returns the code from a wrapped error", () => {
      const wrapped = makeDrizzleWrap(makeBareError("23503"));
      expect(getPostgresErrorCode(wrapped)).toBe("23503");
    });

    it("returns the first code found when traversing", () => {
      // Outer wrapper has its own code — should win over inner.
      const inner = makeBareError("23503");
      const outer = makeDrizzleWrap(inner) as Error & { code: string };
      outer.code = "23514";
      expect(getPostgresErrorCode(outer)).toBe("23514");
    });

    it("returns undefined when no code exists", () => {
      expect(getPostgresErrorCode(new Error("plain"))).toBeUndefined();
      expect(getPostgresErrorCode(null)).toBeUndefined();
      expect(getPostgresErrorCode(undefined)).toBeUndefined();
    });
  });

  describe("isPgErrorCode", () => {
    it("matches the requested code", () => {
      const wrapped = makeDrizzleWrap(makeBareError("23505"));
      expect(isPgErrorCode(wrapped, "23505")).toBe(true);
    });

    it("does not match a different code", () => {
      const wrapped = makeDrizzleWrap(makeBareError("23505"));
      expect(isPgErrorCode(wrapped, "23503")).toBe(false);
    });

    it("returns false for non-Postgres errors", () => {
      expect(isPgErrorCode(new Error("plain"), "23505")).toBe(false);
      expect(isPgErrorCode(null, "23505")).toBe(false);
    });
  });

  describe("getPostgresErrorConstraint", () => {
    it("reads postgres-js's `constraint_name` (the production driver)", () => {
      expect(
        getPostgresErrorConstraint(
          makeConstraintError("23505", "machines_initials_unique")
        )
      ).toBe("machines_initials_unique");
    });

    it("reads PGlite's `constraint` (every integration test)", () => {
      // The two drivers genuinely disagree — verified 2026-08-01 against
      // postgres/src/connection.js:46 and a live PGlite error dump. Reading only
      // one spelling passes one environment and silently fails the other, which
      // is exactly how the first attempt at this fix went green in unit tests
      // and dead in the integration suite.
      expect(
        getPostgresErrorConstraint(
          makePgliteConstraintError("23505", "machines_initials_unique")
        )
      ).toBe("machines_initials_unique");
    });

    it("finds it through the Drizzle cause chain", () => {
      const wrapped = makeDrizzleWrap(
        makeConstraintError("23505", "machines_pinballmap_listed_unique")
      );
      expect(getPostgresErrorConstraint(wrapped)).toBe(
        "machines_pinballmap_listed_unique"
      );
    });

    it("distinguishes two unique violations that share SQLSTATE 23505", () => {
      // The whole point: one table, several unique constraints, one code. Code
      // that assumes which one fired reports the wrong cause (PP-o355.15).
      const initials = makeConstraintError("23505", "machines_initials_unique");
      const listing = makeConstraintError(
        "23505",
        "machines_pinballmap_listed_unique"
      );

      expect(isPgErrorCode(initials, "23505")).toBe(true);
      expect(isPgErrorCode(listing, "23505")).toBe(true);
      expect(getPostgresErrorConstraint(initials)).not.toBe(
        getPostgresErrorConstraint(listing)
      );
    });

    it("returns undefined when the error carries no constraint name", () => {
      // Callers must keep a general fallback — not every unique violation names
      // its constraint.
      expect(
        getPostgresErrorConstraint(makeBareError("23505"))
      ).toBeUndefined();
    });

    it("returns undefined for non-Postgres errors", () => {
      expect(getPostgresErrorConstraint(new Error("plain"))).toBeUndefined();
      expect(getPostgresErrorConstraint(null)).toBeUndefined();
    });
  });
});
