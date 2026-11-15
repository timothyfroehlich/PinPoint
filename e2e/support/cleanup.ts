import postgres from "postgres";

interface CleanupRequest {
  issueIds?: string[];
  machineIds?: string[];
  machineInitials?: string[];
  issueTitlePrefix?: string;
  userEmails?: string[];
}

const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/u;

const uniqueNonEmpty = (values: string[] | undefined): string[] =>
  Array.from(new Set(values ?? [])).filter((value) => value.length > 0);

const escapeLikePattern = (value: string): string =>
  value.replace(/[%_\\]/g, "\\$&");

/**
 * Delete test-created rows straight from the database.
 *
 * Runs in the Playwright process over a direct Postgres connection, so it
 * works against any server build (`next dev` or `next start`) and the app
 * needs no cleanup endpoint. Deletes, in order: issues matching any of the
 * ids, machine initials, or title prefix; machines matching any of the ids or
 * initials; then, for `userEmails`, clears machine ownership pointing at those
 * users (the owner FKs have no ON DELETE), deletes their `invited_users` rows,
 * and deletes the `user_profiles` of matching `auth.users`. `auth.users` rows
 * themselves are left alone — this role cannot delete from the auth schema;
 * use the Admin API helpers in `supabase-admin.ts` for those.
 *
 * Every value is a bound parameter whose type Postgres infers from the column
 * it is compared with, so the citext `email` columns still match
 * case-insensitively.
 */
export async function cleanupTestEntities(
  payload: CleanupRequest
): Promise<void> {
  const issueIds = uniqueNonEmpty(payload.issueIds).filter((id) =>
    UUID_PATTERN.test(id)
  );
  const machineIds = uniqueNonEmpty(payload.machineIds).filter((id) =>
    UUID_PATTERN.test(id)
  );
  const machineInitials = uniqueNonEmpty(payload.machineInitials);
  const userEmails = uniqueNonEmpty(payload.userEmails);
  const issueTitlePrefix = payload.issueTitlePrefix?.trim() ?? "";

  if (
    !issueIds.length &&
    !machineIds.length &&
    !machineInitials.length &&
    !userEmails.length &&
    !issueTitlePrefix
  ) {
    return;
  }

  const postgresUrl =
    process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_URL"];
  if (!postgresUrl) {
    throw new Error(
      "POSTGRES_URL_NON_POOLING / POSTGRES_URL not set. Check .env.local."
    );
  }

  const sql = postgres(postgresUrl, {
    connect_timeout: 3,
    max: 1,
    prepare: false,
  });
  const anyOf = (conditions: postgres.Fragment[]): postgres.Fragment =>
    conditions.reduce((all, condition) => sql`${all} OR ${condition}`);

  try {
    const issueConditions: postgres.Fragment[] = [];
    if (issueIds.length) {
      issueConditions.push(sql`id IN ${sql(issueIds)}`);
    }
    if (machineInitials.length) {
      issueConditions.push(sql`machine_initials IN ${sql(machineInitials)}`);
    }
    if (issueTitlePrefix) {
      issueConditions.push(
        sql`title ILIKE ${`${escapeLikePattern(issueTitlePrefix)}%`}`
      );
    }
    if (issueConditions.length) {
      await sql`DELETE FROM issues WHERE ${anyOf(issueConditions)}`;
    }

    const machineConditions: postgres.Fragment[] = [];
    if (machineIds.length) {
      machineConditions.push(sql`id IN ${sql(machineIds)}`);
    }
    if (machineInitials.length) {
      machineConditions.push(sql`initials IN ${sql(machineInitials)}`);
    }
    if (machineConditions.length) {
      await sql`DELETE FROM machines WHERE ${anyOf(machineConditions)}`;
    }

    if (userEmails.length) {
      const userIds = await sql<{ id: string }[]>`
        SELECT id FROM invited_users WHERE email IN ${sql(userEmails)}
        UNION ALL
        SELECT id FROM auth.users WHERE email IN ${sql(userEmails)}
      `;

      // Clear machine ownership before deleting the users (FK constraint).
      if (userIds.length) {
        const ids = userIds.map((row) => row.id);
        await sql`
          UPDATE machines
          SET owner_id = NULL, invited_owner_id = NULL
          WHERE owner_id IN ${sql(ids)} OR invited_owner_id IN ${sql(ids)}
        `;
      }

      await sql`DELETE FROM invited_users WHERE email IN ${sql(userEmails)}`;

      await sql`
        DELETE FROM user_profiles
        WHERE id IN (SELECT id FROM auth.users WHERE email IN ${sql(userEmails)})
      `;
    }
  } catch (error) {
    throw new Error("Failed to cleanup test data", { cause: error });
  } finally {
    await sql.end();
  }
}

export function extractIdFromUrl(url: string): string | null {
  const segments = url.split("/").filter(Boolean);
  const possibleId = segments.at(-1);
  if (!possibleId) {
    return null;
  }
  const uuidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u;
  return uuidPattern.test(possibleId) ? possibleId : null;
}
