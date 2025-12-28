import type React from "react";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CreateMachineForm } from "./create-machine-form";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";

import { getUnifiedUsers } from "~/lib/users/queries";
import type { UnifiedUser } from "~/lib/types";

/**
 * Create Machine Page (Protected Route)
 *
 * Form to create a new pinball machine.
 * Uses Server Actions with progressive enhancement (works without JS).
 */
export default async function NewMachinePage(): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Fetch all users for owner selection (Admin only)
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  const isAdmin = currentUserProfile?.role === "admin";

  let allUsers: UnifiedUser[] = [];
  if (isAdmin) {
    allUsers = await getUnifiedUsers();
  }

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/machines">
              <Button
                variant="outline"
                size="sm"
                className="border-outline text-on-surface hover:bg-surface-variant"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-on-surface">
                Add New Machine
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Create a new pinball machine entry
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl border-outline-variant">
          <CardHeader>
            <CardTitle className="text-2xl text-on-surface">
              Machine Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateMachineForm allUsers={allUsers} isAdmin={isAdmin} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
