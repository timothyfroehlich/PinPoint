import { describe, expect, it } from "vitest";

import { deriveName } from "./derive-name";

/**
 * These cases are the contract `derive_profile_name()` in
 * drizzle/0064_last_cannonball.sql implements in SQL. If you change one, change
 * both — the trigger and this module write the same row for the same user under
 * different conditions (insert vs. profile auto-heal), so a divergence produces
 * a name that depends on which ran first.
 *
 * The metadata shapes below are real payloads observed on prod, not invented:
 * Discord genuinely puts the handle in `full_name` and the human name in
 * `custom_claims.global_name`, which is the whole reason PP-if48 happened.
 */
describe("deriveName", () => {
  describe("when the user typed the name", () => {
    it("takes an explicit first and last name and marks it not derived", () => {
      expect(
        deriveName(
          { first_name: "Tim", last_name: "Froehlich" },
          "tim@example.com"
        )
      ).toEqual({ firstName: "Tim", lastName: "Froehlich", derived: false });
    });

    it("accepts an explicit first name with no last name", () => {
      expect(
        deriveName({ first_name: "Prince" }, "prince@example.com")
      ).toEqual({ firstName: "Prince", lastName: "", derived: false });
    });

    it("trims, so a whitespace-only first name falls through instead of being stored blank", () => {
      // The exact hole that let blank names in: `min(1)` without `.trim()`
      // accepted " " and the trigger stored it.
      const result = deriveName(
        { first_name: "   ", last_name: "  " },
        "someone@example.com"
      );
      expect(result.firstName).toBe("someone");
      expect(result.derived).toBe(true);
    });
  });

  describe("Discord payloads", () => {
    // This is Paul Muntner's actual prod metadata.
    const discordPaul = {
      full_name: "pmuntner",
      name: "pmuntner#0",
      custom_claims: { global_name: "Paul Muntner" },
    };

    it("prefers global_name over the account handle", () => {
      expect(deriveName(discordPaul, "pmuntner@yahoo.com")).toEqual({
        firstName: "Paul",
        lastName: "Muntner",
        derived: true,
      });
    });

    it("yields a single-token first name when the display name is a handle", () => {
      expect(
        deriveName(
          {
            full_name: "presidentnick",
            name: "presidentnick#0",
            custom_claims: { global_name: "PresidentNick" },
          },
          "nickpereira.np@gmail.com"
        )
      ).toEqual({
        firstName: "PresidentNick",
        lastName: "",
        derived: true,
      });
    });

    it("falls back to full_name when custom_claims has no global_name", () => {
      expect(
        deriveName(
          { full_name: "someuser", custom_claims: {} },
          "someuser@example.com"
        )
      ).toEqual({ firstName: "someuser", lastName: "", derived: true });
    });

    it("strips the legacy discriminator when only `name` is available", () => {
      expect(deriveName({ name: "pmuntner#4821" }, "p@example.com")).toEqual({
        firstName: "pmuntner",
        lastName: "",
        derived: true,
      });
    });

    it("does not treat a non-object custom_claims as a lookup target", () => {
      expect(
        deriveName(
          { custom_claims: "not-an-object", full_name: "Jane Roe" },
          "jane@example.com"
        )
      ).toEqual({ firstName: "Jane", lastName: "Roe", derived: true });
    });
  });

  describe("splitting a display name", () => {
    it("splits on the first whitespace run only, keeping compound surnames whole", () => {
      expect(
        deriveName({ full_name: "Mary Anne van der Berg" }, "mary@example.com")
      ).toEqual({
        firstName: "Mary",
        lastName: "Anne van der Berg",
        derived: true,
      });
    });

    it("collapses runs of whitespace rather than emitting empty segments", () => {
      expect(
        deriveName({ full_name: "  Ada   Lovelace  " }, "ada@example.com")
      ).toEqual({ firstName: "Ada", lastName: "Lovelace", derived: true });
    });
  });

  describe("the floor", () => {
    // This guarantee is what lets the DB enforce btrim(first_name) <> '' — the
    // check can only be safe if derivation cannot return an empty first name.
    it("uses the email local-part when there is no metadata at all", () => {
      expect(deriveName({}, "keyyek123@gmail.com")).toEqual({
        firstName: "keyyek123",
        lastName: "",
        derived: true,
      });
    });

    it("handles null metadata", () => {
      expect(deriveName(null, "someone@example.com").firstName).toBe("someone");
    });

    it("never returns an empty first name, even for degenerate input", () => {
      for (const meta of [
        {},
        { full_name: "   " },
        { name: "#0" },
        { custom_claims: { global_name: "" } },
        { first_name: "", last_name: "" },
      ]) {
        expect(deriveName(meta, "fallback@example.com").firstName).not.toBe("");
      }
    });
  });
});
