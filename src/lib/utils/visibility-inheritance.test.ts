import { describe, expect, it } from "vitest";

import {
  buildVisibilityChain,
  calculateEffectiveLocationVisibility,
  calculateEffectiveMachineVisibility,
  calculateEffectiveVisibility,
  isVisibleToAnonymous,
  isVisibleToNonMember,
} from "./visibility-inheritance";

describe("calculateEffectiveMachineVisibility", () => {
  it("returns false when organization is private", () => {
    expect(
      calculateEffectiveMachineVisibility(
        { is_public: false },
        { is_public: true },
        { is_public: true },
      ),
    ).toBe(false);
  });

  it("prefers explicit machine visibility when present", () => {
    expect(
      calculateEffectiveMachineVisibility(
        { is_public: true },
        { is_public: true },
        { is_public: false },
      ),
    ).toBe(false);

    expect(
      calculateEffectiveMachineVisibility(
        { is_public: true },
        { is_public: false },
        { is_public: true },
      ),
    ).toBe(true);
  });

  it("falls back to location visibility when machine is inherited", () => {
    expect(
      calculateEffectiveMachineVisibility(
        { is_public: true },
        { is_public: false },
        { is_public: null },
      ),
    ).toBe(false);

    expect(
      calculateEffectiveMachineVisibility(
        { is_public: true },
        { is_public: true },
        { is_public: null },
      ),
    ).toBe(true);
  });

  it("inherits organization visibility when no explicit values provided", () => {
    expect(
      calculateEffectiveMachineVisibility(
        { is_public: true },
        { is_public: null },
        { is_public: null },
      ),
    ).toBe(true);
  });
});

describe("calculateEffectiveLocationVisibility", () => {
  it("returns false when organization is private", () => {
    expect(
      calculateEffectiveLocationVisibility(
        { is_public: false },
        { is_public: true },
      ),
    ).toBe(false);
  });

  it("uses explicit location flag before inheriting from organization", () => {
    expect(
      calculateEffectiveLocationVisibility(
        { is_public: true },
        { is_public: false },
      ),
    ).toBe(false);

    expect(
      calculateEffectiveLocationVisibility(
        { is_public: true },
        { is_public: null },
      ),
    ).toBe(true);
  });
});

describe("calculateEffectiveVisibility", () => {
  const org = { is_public: true, public_issue_default: "public" };

  it("returns false if any explicit level is false", () => {
    expect(
      calculateEffectiveVisibility(
        buildVisibilityChain(org, { is_public: true }, { is_public: false }),
      ),
    ).toBe(false);
  });

  it("returns true if at least one explicit true and no false values", () => {
    expect(
      calculateEffectiveVisibility(
        buildVisibilityChain(org, { is_public: null }, { is_public: true }),
      ),
    ).toBe(true);
  });

  it("falls back to organization default when no explicit visibility set", () => {
    expect(
      calculateEffectiveVisibility(
        buildVisibilityChain(org, { is_public: null }, { is_public: null }),
      ),
    ).toBe(true);

    expect(
      calculateEffectiveVisibility(
        buildVisibilityChain(
          { ...org, public_issue_default: "private" },
          { is_public: null },
          { is_public: null },
        ),
      ),
    ).toBe(false);
  });
});

describe("visibility helpers", () => {
  it("mirror calculated visibility for anonymous and non-member checks", () => {
    expect(isVisibleToAnonymous(true)).toBe(true);
    expect(isVisibleToAnonymous(false)).toBe(false);
    expect(isVisibleToNonMember(true)).toBe(true);
    expect(isVisibleToNonMember(false)).toBe(false);
  });
});
