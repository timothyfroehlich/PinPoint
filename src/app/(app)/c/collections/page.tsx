import type React from "react";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines as machinesTable } from "~/server/db/schema";
import { getLoginUrl } from "~/lib/url";
import { getMyCollections, getSharedWithMe } from "~/lib/collections/list";
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

  const [owned, shared, allMachines] = await Promise.all([
    getMyCollections(undefined, user.id),
    getSharedWithMe(undefined, user.id),
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

        {owned.length === 0 && shared.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            You haven&apos;t created any collections yet. Create one to get
            started.
          </p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your collections
              </h2>
              {owned.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted-foreground">
                  You haven&apos;t created any collections yet.
                </p>
              ) : (
                <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
                  {owned.map((collection) => (
                    <li key={collection.id}>
                      <Link
                        href={`/c/${collection.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-variant"
                      >
                        <span className="font-medium text-foreground">
                          {collection.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {collection.machineCount}{" "}
                          {collection.machineCount === 1
                            ? "machine"
                            : "machines"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {shared.length > 0 && (
              <section>
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Shared with you
                </h2>
                <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
                  {shared.map((collection) => (
                    <li key={collection.id}>
                      <Link
                        href={`/c/${collection.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-variant"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">
                            {collection.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            Shared by {collection.ownerName}
                            <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-semibold text-on-secondary-container">
                              Editor
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {collection.machineCount}{" "}
                          {collection.machineCount === 1
                            ? "machine"
                            : "machines"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
