import type React from "react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { MapPin } from "lucide-react";
import { SyncTable } from "./sync-table";
import { PbmConfigForm } from "./pbm-config-form";

export const metadata = {
  title: "Pinball Map | PinPoint",
};

export default async function PinballMapPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already ensures user is authenticated + tech/admin
  const profile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;

  const isAdmin = profile?.role === "admin";

  // Load existing config for admin form
  let existingConfig: {
    locationId: number;
    userEmail: string;
    userToken: string;
  } | null = null;

  if (isAdmin) {
    const config = await db.query.pinballMapConfig.findFirst();
    if (config) {
      existingConfig = {
        locationId: config.locationId,
        userEmail: config.userEmail,
        userToken: config.userToken,
      };
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <MapPin className="size-6 text-primary" />
        <h1 className="text-2xl font-bold text-on-surface">Pinball Map</h1>
      </div>

      <p className="text-sm text-on-surface-variant">
        Manage your location&apos;s listing on Pinball Map. Compare which
        machines are listed vs. which are on the floor.
      </p>

      {/* Sync Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncTable />
        </CardContent>
      </Card>

      {/* Admin-only: PBM Credentials */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <PbmConfigForm existingConfig={existingConfig} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
