import { describe, it, expect } from "vitest";

import {
  type SettingsSetAuth,
  canViewSet,
  canEditSet,
  canSetOwnerDefault,
} from "./settings-permissions";

const OWNER = "owner-1";
const TECH = "tech-1";
const OTHER = "member-2";

// Set factory — defaults to a public community set.
function set(overrides: Partial<SettingsSetAuth> = {}): SettingsSetAuth {
  return {
    isOwnerSet: false,
    isPublic: true,
    isPreferred: false,
    createdById: TECH,
    ...overrides,
  };
}

describe("canViewSet", () => {
  it("shows public sets to everyone, including anonymous", () => {
    expect(canViewSet(set({ isPublic: true }), null, "unauthenticated")).toBe(
      true
    );
  });

  it("shows the owner's default to everyone even when not public", () => {
    expect(
      canViewSet(
        set({ isPublic: false, isPreferred: true }),
        null,
        "unauthenticated"
      )
    ).toBe(true);
  });

  it("hides a private draft from everyone but its creator", () => {
    const draft = set({ isPublic: false, createdById: TECH });
    expect(canViewSet(draft, OTHER, "member")).toBe(false);
    expect(canViewSet(draft, TECH, "technician")).toBe(true);
  });

  it("lets admin see a private draft they didn't create", () => {
    expect(
      canViewSet(
        set({ isPublic: false, createdById: TECH }),
        "admin-9",
        "admin"
      )
    ).toBe(true);
  });
});

describe("canEditSet", () => {
  it("owner set: editable by the machine owner and admin, NOT technicians", () => {
    const ownerSet = set({ isOwnerSet: true, createdById: OWNER });
    expect(canEditSet(ownerSet, OWNER, OWNER, "member")).toBe(true); // member-owner
    expect(canEditSet(ownerSet, OWNER, "admin-9", "admin")).toBe(true);
    expect(canEditSet(ownerSet, OWNER, TECH, "technician")).toBe(false);
  });

  it("community set: editable by technicians, the owner, and admin", () => {
    const community = set({ isOwnerSet: false });
    expect(canEditSet(community, OWNER, TECH, "technician")).toBe(true);
    expect(canEditSet(community, OWNER, OWNER, "member")).toBe(true); // owner
    expect(canEditSet(community, OWNER, "admin-9", "admin")).toBe(true);
  });

  it("community set: a plain non-owner member cannot edit", () => {
    expect(canEditSet(set({ isOwnerSet: false }), OWNER, OTHER, "member")).toBe(
      false
    );
  });

  it("private draft: only its creator (a tech) can edit — not other techs", () => {
    const draft = set({ isPublic: false, createdById: TECH });
    expect(canEditSet(draft, OWNER, TECH, "technician")).toBe(true);
    expect(canEditSet(draft, OWNER, "tech-2", "technician")).toBe(false); // can't even see it
  });
});

describe("canSetOwnerDefault", () => {
  it("owner/admin may set an owner set as default", () => {
    const ownerSet = set({ isOwnerSet: true, createdById: OWNER });
    expect(canSetOwnerDefault(ownerSet, OWNER, OWNER, "member")).toBe(true);
    expect(canSetOwnerDefault(ownerSet, OWNER, "admin-9", "admin")).toBe(true);
  });

  it("a community set is never eligible to be the default", () => {
    expect(
      canSetOwnerDefault(set({ isOwnerSet: false }), OWNER, OWNER, "member")
    ).toBe(false);
  });

  it("a technician cannot set the owner's default", () => {
    expect(
      canSetOwnerDefault(
        set({ isOwnerSet: true, createdById: OWNER }),
        OWNER,
        TECH,
        "technician"
      )
    ).toBe(false);
  });
});
