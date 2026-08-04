/**
 * Unit tests: PinballMap operator-credential accessor (PP-o355.30).
 *
 * The Vault decrypt happens in a SECURITY DEFINER RPC, so the only thing worth
 * testing here is the branch logic around it: a half-provisioned row (email but
 * no token, or the reverse) must read as "not provisioned" rather than yielding
 * a credential the PBM client would send with an empty field.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

vi.mock("~/server/db/transaction-context", () => ({
  assertNotInTransaction: vi.fn(),
}));

describe("getPinballMapWriteCredentials", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("returns the decrypted credential when both halves are present", async () => {
    rpc.mockResolvedValue({
      data: [{ outbound_email: "ops@example.com", outbound_token: "tok_123" }],
      error: null,
    });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    expect(await getPinballMapWriteCredentials()).toEqual({
      email: "ops@example.com",
      token: "tok_123",
    });
  });

  it("returns null when no credential has been provisioned", async () => {
    rpc.mockResolvedValue({
      data: [{ outbound_email: null, outbound_token: null }],
      error: null,
    });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    expect(await getPinballMapWriteCredentials()).toBeNull();
  });

  it("returns null when only one half is provisioned", async () => {
    // A half-filled row is a misconfiguration, not a usable credential: PBM
    // would reject the write and we would report the failure as if the operator
    // token were wrong. Refuse before the HTTP call instead.
    rpc.mockResolvedValue({
      data: [{ outbound_email: "ops@example.com", outbound_token: null }],
      error: null,
    });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    expect(await getPinballMapWriteCredentials()).toBeNull();
  });

  it("throws when the RPC itself fails", async () => {
    // Distinct from "not provisioned": a broken Vault round-trip must not be
    // reported to the user as "set up your PinballMap credentials".
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    await expect(getPinballMapWriteCredentials()).rejects.toThrow(/boom/);
  });

  it("refuses to run inside a transaction", async () => {
    const { assertNotInTransaction } =
      await import("~/server/db/transaction-context");
    rpc.mockResolvedValue({ data: [], error: null });
    const { getPinballMapWriteCredentials } = await import("./credentials");

    await getPinballMapWriteCredentials();

    expect(assertNotInTransaction).toHaveBeenCalledWith(
      "getPinballMapWriteCredentials"
    );
  });
});
