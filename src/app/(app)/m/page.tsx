import type React from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { MachineView } from "~/components/machines/view";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { loadMachineView } from "~/lib/machines/view/queries";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

interface MachinesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Public machine directory. The view itself remains public; only the Add
 * Machine action is permission-gated.
 */
export default async function MachinesPage({
  searchParams,
}: MachinesPageProps): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const [{ data }, rawSearchParams] = await Promise.all([
    supabase.auth.getUser(),
    searchParams,
  ]);
  const userProfile = data.user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, data.user.id),
        columns: { role: true },
      })
    : null;
  const accessLevel = getAccessLevel(userProfile?.role);
  const canCreateMachine = checkPermission("machines.create", accessLevel);
  const result = await loadMachineView({
    scope: { kind: "all" },
    preset: "machines",
    searchParams: toMachineViewSearchParams(rawSearchParams),
  });
  const addMachineButton = canCreateMachine ? (
    <Button
      asChild
      className="bg-primary text-on-primary hover:bg-primary/90"
      data-testid="add-machine-button"
    >
      <Link href="/m/new">
        <Plus className="mr-2 size-4" />
        Add Machine
      </Link>
    </Button>
  ) : undefined;

  return (
    <PageContainer size="wide">
      <PageHeader title="Machines" actions={addMachineButton} />
      {result.scopeCount === 0 ? (
        <EmptyState
          icon={Plus}
          title="No machines yet"
          description={
            canCreateMachine
              ? "Get started by adding your first machine to the collection."
              : "No machines have been added to the collection yet."
          }
          action={
            canCreateMachine ? (
              <Button
                asChild
                className="bg-primary text-on-primary hover:bg-primary/90"
              >
                <Link href="/m/new">
                  <Plus className="mr-2 size-4" />
                  Add Your First Machine
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <MachineView result={result} preset="machines" />
      )}
    </PageContainer>
  );
}
