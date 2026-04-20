import { describe, expect, it } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";
import { canUnlinkIdentity } from "./identity-guards";

function identity(provider: string): UserIdentity {
  return {
    identity_id: `id-${provider}`,
    id: `row-${provider}`,
    user_id: "u1",
    identity_data: {},
    provider,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as UserIdentity;
}

describe("canUnlinkIdentity", () => {
  it("refuses when user has only one identity (that one is being unlinked)", () => {
    const result = canUnlinkIdentity([identity("discord")], "discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("ONLY_IDENTITY");
  });

  it("refuses when user has zero identities of the target provider", () => {
    const result = canUnlinkIdentity([identity("email")], "discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NOT_LINKED");
  });

  it("allows when user has two identities", () => {
    const result = canUnlinkIdentity(
      [identity("email"), identity("discord")],
      "discord"
    );
    expect(result.ok).toBe(true);
  });

  it("allows when user has three identities", () => {
    const result = canUnlinkIdentity(
      [identity("email"), identity("discord"), identity("google")],
      "discord"
    );
    expect(result.ok).toBe(true);
  });
});
