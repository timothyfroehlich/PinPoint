import { describe, it, expect } from "vitest";

import {
  type SettingsSetAuth,
  canDeleteSet,
  canEditSet,
  canMakeCommunity,
} from "./settings";

const OWNER = "owner-1";
const TECH = "tech-1";
const OTHER = "member-2";

const personal = (createdById: string | null): SettingsSetAuth => ({
  isCommunity: false,
  createdById,
});
const community: SettingsSetAuth = { isCommunity: true, createdById: TECH };

describe("canEditSet (machine-settings §2.2–§2.3)", () => {
  it("a personal set is editable by its author only — not the owner, a technician, or an admin", () => {
    const set = personal(TECH);
    expect(canEditSet(set, OWNER, TECH, "technician")).toBe(true);
    expect(canEditSet(set, OWNER, OWNER, "member")).toBe(false);
    expect(canEditSet(set, OWNER, "tech-2", "technician")).toBe(false);
    expect(canEditSet(set, OWNER, "admin-9", "admin")).toBe(false);
  });

  it("a guest or anonymous viewer is never the author, even with a matching id", () => {
    expect(canEditSet(personal(OWNER), OWNER, OWNER, "guest")).toBe(false);
    expect(canEditSet(personal(OWNER), OWNER, OWNER, "unauthenticated")).toBe(
      false
    );
  });

  it("a community set is editable by technicians, the machine owner, and admins — not other members", () => {
    expect(canEditSet(community, OWNER, "tech-2", "technician")).toBe(true);
    expect(canEditSet(community, OWNER, OWNER, "member")).toBe(true);
    expect(canEditSet(community, OWNER, "admin-9", "admin")).toBe(true);
    expect(canEditSet(community, OWNER, OTHER, "member")).toBe(false);
  });
});

describe("canDeleteSet (machine-settings §2.2)", () => {
  it("an admin can delete someone else's personal set they cannot edit", () => {
    expect(canDeleteSet(personal(TECH), OWNER, "admin-9", "admin")).toBe(true);
    expect(canDeleteSet(personal(TECH), OWNER, OWNER, "member")).toBe(false);
  });
});

describe("canMakeCommunity (machine-settings §2.4)", () => {
  it("only the author of a personal set can make it a community set", () => {
    expect(canMakeCommunity(personal(TECH), TECH, "technician")).toBe(true);
    expect(canMakeCommunity(personal(TECH), "admin-9", "admin")).toBe(false);
    expect(canMakeCommunity(community, TECH, "technician")).toBe(false);
  });
});
