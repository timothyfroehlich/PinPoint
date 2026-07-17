import type React from "react";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines as machinesTable } from "~/server/db/schema";
import { getLoginUrl } from "~/lib/url";
import { getMyCollections } from "~/lib/collections/list";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { CreateCollectionDialog } from "~/components/collections/CreateCollectionDialog";

export const metadata: Metadata = {
  title: "My Collections | PinPoint",
};

export default async function MyCollectionsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(getLoginUrl("/c/collections"));
  }

  const [collections, allMachines] = await Promise.all([
    getMyCollections(undefined, user.id),
    db.query.machines.findMany({
      columns: { id: true, initials: true, name: true },
      orderBy: [asc(machinesTable.name)],
    }),
  ]);

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        <PageHeader
          title="My Collections"
          actions={<CreateCollectionDialog allMachines={allMachines} />}
        />

        {collections.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            You haven&apos;t created any collections yet. Create one to get
            started.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/c/collection/${collection.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-variant"
                >
                  <span className="font-medium text-foreground">
                    {collection.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {collection.machineCount}{" "}
                    {collection.machineCount === 1 ? "machine" : "machines"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
