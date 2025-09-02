/**
 * Create Machine Page - Phase 3B Server Component
 * Server Component with Server Actions integration
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { requireMemberAccess } from "~/lib/organization-context";
import { getLocationsForOrg, getModelsForOrg } from "~/lib/dal/machines";
import { createMachineAction } from "~/lib/actions/machine-actions";
import { CreateMachineFormClient } from "~/components/machines/client/create-machine-form-client";

export const metadata = {
  title: "Add New Machine - Machine Inventory - PinPoint",
  description: "Add a new pinball machine to your inventory",
};

export default async function NewMachinePage(): Promise<React.JSX.Element> {
  await requireMemberAccess();

  // Fetch required data for form
  const [locations, models] = await Promise.all([
    getLocationsForOrg(),
    getModelsForOrg(),
  ]);

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/machines" className="flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Back to Machines
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Machine</h1>
        <p className="text-muted-foreground">
          Add a new pinball machine to your inventory
        </p>
      </div>

      {/* Create Machine Form */}
      <CreateMachineFormClient
        locations={locations}
        models={models}
        action={createMachineAction}
      />
    </div>
  );
}
