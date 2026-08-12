/**
 * Unit: the hand-entered model fields on the machine create/update schemas
 * (PP-3bbr, folded into PP-o355.21).
 *
 * These three are the ONE place model metadata legitimately arrives from a
 * request — for a game PinballMap's catalog cannot cover there is nothing to
 * derive it from. That makes their bounds the only thing standing between the
 * form and the column, which is why they are pinned here rather than left to
 * the browser's `min`/`max`.
 */

import { describe, it, expect } from "vitest";
import { updateMachineSchema } from "./schemas";

const base = { id: "6b1e2f30-4c8a-4b4e-9f2d-1a2b3c4d5e6f" };

function parseYear(year: unknown): { ok: boolean; value?: number | undefined } {
  const result = updateMachineSchema.safeParse({ ...base, year });
  return result.success ? { ok: true, value: result.data.year } : { ok: false };
}

describe("machine schema — hand-entered model fields", () => {
  it("accepts a year anywhere in pinball's actual range", () => {
    // The collection is meant to span every era, so the floor has to clear the
    // 1930s and the ceiling has to allow next season's Stern.
    expect(parseYear("1947")).toEqual({ ok: true, value: 1947 });
    expect(parseYear("1979")).toEqual({ ok: true, value: 1979 });
    expect(parseYear(String(new Date().getFullYear() + 1)).ok).toBe(true);
  });

  it("rejects a year before pinball existed or too far ahead", () => {
    expect(parseYear("1899").ok).toBe(false);
    expect(parseYear(String(new Date().getFullYear() + 2)).ok).toBe(false);
  });

  it("rejects a non-numeric year rather than coercing it to zero", () => {
    expect(parseYear("nineteen ninety four").ok).toBe(false);
  });

  it("trims the strings and caps their length", () => {
    const result = updateMachineSchema.safeParse({
      ...base,
      modelName: "  Bordertown  ",
      manufacturer: "  homebrew  ",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.modelName).toBe("Bordertown");
    expect(result.data.manufacturer).toBe("homebrew");

    expect(
      updateMachineSchema.safeParse({ ...base, modelName: "x".repeat(201) })
        .success
    ).toBe(false);
    expect(
      updateMachineSchema.safeParse({ ...base, manufacturer: "x".repeat(101) })
        .success
    ).toBe(false);
  });

  it("still refuses `pinballmapListed` from a request body", () => {
    // PP-o355.29. Adding three model fields to this schema is exactly the kind
    // of change that could quietly widen it, so the guard is asserted beside
    // them rather than trusted to stay true.
    const result = updateMachineSchema.safeParse({
      ...base,
      pinballmapListed: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("pinballmapListed");
  });
});
