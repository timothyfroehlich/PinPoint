import type React from "react";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

/**
 * Report New Issue Page (Protected Route - Placeholder)
 *
 * Will allow users to report new issues.
 */
export default async function NewIssuePage(): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-outline-variant bg-surface shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <Plus className="size-10 text-primary" strokeWidth={2.5} />
            <CardTitle className="text-3xl font-bold text-on-surface">
              Report Issue
            </CardTitle>
          </div>
          <p className="text-sm text-on-surface-variant">
            Report a new issue with a pinball machine
          </p>
        </CardHeader>

        <CardContent className="text-center py-8">
          <p className="text-lg text-on-surface-variant">
            Coming soon in future tasks!
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
