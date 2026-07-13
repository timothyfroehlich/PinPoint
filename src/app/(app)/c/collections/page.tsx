import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/url";
import { getMyCollections } from "~/lib/collections/list";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { CreateCollectionForm } from "~/components/collections/CreateCollectionForm";

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

  const collections = await getMyCollections(undefined, user.id);

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        <PageHeader title="My Collections" />

        <CreateCollectionForm />

        {collections.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            You haven&apos;t created any collections yet. Name one above to get
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
