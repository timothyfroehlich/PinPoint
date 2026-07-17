import { randomBytes } from "node:crypto";

/**
 * Mint an opaque view-share token for a collection (Wave 0b, PP-wqit.2).
 *
 * 24 random bytes -> 32-char base64url string: ~192 bits of entropy, far beyond
 * brute-force, and URL-safe (base64url uses `-`/`_`, never `+`/`/`/`=`). The
 * token is the capability — possession of the link grants anonymous read — so
 * it must be unguessable and is regenerated (not reused) to revoke old links.
 *
 * base64url output never matches the uuid format (8-4-4-4-12 hex), so a token
 * handle and an id handle are always unambiguous in the resolver.
 *
 * MUST be called outside any DB transaction (CORE-ARCH-011): it's a pure,
 * non-transactional value, generated before the membership/token write.
 */
export function generateViewToken(): string {
  return randomBytes(24).toString("base64url");
}
