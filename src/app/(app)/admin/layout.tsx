import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type React from "react";
import { Forbidden } from "~/components/errors/Forbidden";
import { getLoginUrl } from "~/lib/url";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginUrl("/admin"));
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  if (profile?.role !== "admin") {
    return <Forbidden role={profile?.role ?? null} />;
  }

  return <>{children}</>;
}
