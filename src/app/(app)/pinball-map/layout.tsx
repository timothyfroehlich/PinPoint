import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type React from "react";
import { Forbidden } from "~/components/errors/Forbidden";
import { getLoginUrl } from "~/lib/url";

/**
 * Pinball Map Layout
 *
 * Gates access to technician + admin roles.
 * Technicians can view sync status; only admins can edit credentials.
 */
export default async function PinballMapLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginUrl("/pinball-map"));
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  if (profile?.role !== "admin" && profile?.role !== "technician") {
    return <Forbidden role={profile?.role ?? null} />;
  }

  return <>{children}</>;
}
