import { describe, it, expect } from "vitest";

import { resolvePerson } from "~/lib/timeline/resolve-person";

describe("resolvePerson", () => {
  it("resolves a real user to their current name, not invited", () => {
    expect(
      resolvePerson({
        userId: "u1",
        invitedId: null,
        userName: "Tim Froehlich",
        invitedName: null,
      })
    ).toEqual({ displayName: "Tim Froehlich", isInvited: false });
  });

  it("resolves an invited user with the invited flag set", () => {
    expect(
      resolvePerson({
        userId: null,
        invitedId: "iv1",
        userName: null,
        invitedName: "Bo Newcomer",
      })
    ).toEqual({ displayName: "Bo Newcomer", isInvited: true });
  });

  it("resolves a deleted user (FK nulled, both ids null) to 'Former user'", () => {
    expect(
      resolvePerson({
        userId: null,
        invitedId: null,
        userName: null,
        invitedName: null,
      })
    ).toEqual({ displayName: "Former user", isInvited: false });
  });

  it("falls back safely if a user id is present but the name join missed", () => {
    expect(
      resolvePerson({
        userId: "u1",
        invitedId: null,
        userName: null,
        invitedName: null,
      })
    ).toEqual({ displayName: "Unknown user", isInvited: false });
  });
});
