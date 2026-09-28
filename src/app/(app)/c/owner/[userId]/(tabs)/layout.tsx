import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MachineGroupShell } from "~/components/collections/MachineGroupShell";
import { getOwnerCollectionForLayout } from "../_data";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  return {
    title: collection
      ? `${collection.owner.name}'s Machines | PinPoint`
      : "Machines | PinPoint",
  };
}

export default async function CollectionLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { userId } = await params;
  const collection = await getOwnerCollectionForLayout(userId);
  if (!collection) notFound();

  return (
    <MachineGroupShell
      title={`${collection.owner.name}'s Machines`}
      machines={collection.machines}
      basePath={`/c/owner/${collection.owner.id}`}
    >
      {children}
    </MachineGroupShell>
  );
}
