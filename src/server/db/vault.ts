import "server-only";
import { sql } from "drizzle-orm";
import { db } from "~/server/db";

/**
 * Store a secret in Supabase Vault and return its id.
 *
 * Callers must not run this inside a transaction (CORE-ARCH-011): Vault writes
 * do not roll back with it.
 *
 * SECURITY: a failed query must not carry the secret into Sentry or the logs.
 * Drizzle wraps driver errors in a DrizzleQueryError whose message embeds every
 * bound parameter, and here the first parameter is the plaintext secret. So the
 * error is replaced with one that keeps only the driver's own message, which
 * names the failure but never echoes parameter values.
 */
export async function createVaultSecret(
  secret: string,
  name: string,
  description: string
): Promise<string> {
  let rows: { id: string }[];
  try {
    rows = (await db.execute(
      sql`SELECT vault.create_secret(${secret}, ${name}, ${description}) AS id`
    )) as { id: string }[];
  } catch (error) {
    // eslint-disable-next-line preserve-caught-error -- the caught error's message holds the plaintext secret; dropping it is the point.
    throw new Error(`Vault create_secret failed: ${driverMessage(error)}`);
  }
  const id = rows[0]?.id;
  if (!id) throw new Error("Vault create_secret returned no id");
  return id;
}

/** The driver error under Drizzle's wrapper, whose own message has no params. */
function driverMessage(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) return cause.message;
  return "query failed";
}
