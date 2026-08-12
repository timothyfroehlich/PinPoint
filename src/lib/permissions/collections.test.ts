import { describe, expect, it } from "vitest";
import {
  canEditCollection,
  canManageCollection,
  canViewCollection,
} from "./collections";

const collection = { owner: { id: "owner-1" } };

describe("canViewCollection (Wave 0a: owner, or collections.view.private)", () => {
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
  it("denies a non-owner technician", () => {
    expect(
      canViewCollection(collection, { userId: "someone", role: "technician" })
    ).toBe(false);
  });
  it("denies a non-owner guest", () => {
    expect(
      canViewCollection(collection, { userId: "someone", role: "guest" })
    ).toBe(false);
  });
  it("denies anonymous", () => {
    expect(canViewCollection(collection, {})).toBe(false);
  });
  it("denies a signed-in user with no role row", () => {
    expect(
      canViewCollection(collection, { userId: "someone", role: null })
    ).toBe(false);
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

describe("canEditCollection (owner or editor collaborator)", () => {
  it("allows the owner (regardless of collaborator flag)", () => {
    expect(canEditCollection(collection, { userId: "owner-1" }, false)).toBe(
      true
    );
  });
  it("allows a signed-in editor collaborator", () => {
    expect(canEditCollection(collection, { userId: "u-2" }, true)).toBe(true);
  });
  it("denies a signed-in non-collaborator", () => {
    expect(canEditCollection(collection, { userId: "u-3" }, false)).toBe(false);
  });
  it("denies an admin who is not owner/collaborator (no edit-any)", () => {
    expect(
      canEditCollection(collection, { userId: "a-1", role: "admin" }, false)
    ).toBe(false);
  });
  it("denies anonymous even if the flag is somehow true", () => {
    expect(canEditCollection(collection, {}, true)).toBe(false);
  });
});
