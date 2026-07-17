import { describe, expect, it } from "vitest";
import { canManageCollection, canViewCollection } from "./access";

const collection = { owner: { id: "owner-1" } };

describe("canViewCollection (Wave 0a: owner or admin)", () => {
  it("allows the owner", () => {
    expect(
      canViewCollection(collection, { userId: "owner-1", role: "member" })
    ).toBe(true);
  });
  it("allows an admin who is not the owner", () => {
    expect(
      canViewCollection(collection, { userId: "someone", role: "admin" })
    ).toBe(true);
  });
  it("denies a non-owner non-admin", () => {
    expect(
      canViewCollection(collection, { userId: "someone", role: "member" })
    ).toBe(false);
  });
  it("denies anonymous", () => {
    expect(canViewCollection(collection, {})).toBe(false);
  });
});

describe("canManageCollection (owner only)", () => {
  it("allows the owner", () => {
    expect(
      canManageCollection(collection, { userId: "owner-1", role: "member" })
    ).toBe(true);
  });
  it("denies an admin who is not the owner", () => {
    expect(
      canManageCollection(collection, { userId: "someone", role: "admin" })
    ).toBe(false);
  });
  it("denies anonymous", () => {
    expect(canManageCollection(collection, {})).toBe(false);
  });
});
