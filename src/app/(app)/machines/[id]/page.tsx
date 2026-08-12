import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

/**
 * Legacy id-addressed machine link → canonical `/m/<INITIALS>`.
 *
 * Counterpart to `/issues/[id]`: Discord's machine-ownership notifications
 * linked to `/machines/<uuid>` until PP-gzq2, and `/machines` is not a route at
 * all. Same reasoning — DMs are immutable, so the URL has to resolve.
 *
 * No permission check (CORE-ARCH-008 is about surfacing data): nothing is
 * rendered, and the redirect target gates the machine page itself.
 */
export default async function LegacyMachineRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, id),
    columns: { initials: true },
  });

  if (!machine) notFound();

  redirect(`/m/${encodeURIComponent(machine.initials)}`);
}
