import "server-only";

import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

/**
 * Where a legacy id-addressed machine link points: the machine's initials, or
 * undefined when no machine has this id. The caller validates the id as a
 * uuid first.
 */
export async function getMachineLocation(
  id: string
): Promise<{ initials: string } | undefined> {
  return db.query.machines.findFirst({
    where: eq(machines.id, id),
    columns: { initials: true },
  });
}
