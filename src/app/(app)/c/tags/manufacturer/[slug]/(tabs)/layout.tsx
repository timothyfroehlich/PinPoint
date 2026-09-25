import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MachineGroupShell } from "~/components/collections/MachineGroupShell";
import { manufacturerTagHref } from "~/lib/machines/manufacturer";
import { getManufacturerTagForLayout } from "../_data";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getManufacturerTagForLayout(slug);
  return { title: tag ? `${tag.name} | PinPoint` : "Tag | PinPoint" };
}

export default async function ManufacturerTagLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const tag = await getManufacturerTagForLayout(slug);
  if (!tag) notFound();

  return (
    <MachineGroupShell
      title={tag.name}
      eyebrow={
        <Link href="/c/tags" className="hover:text-foreground">
          Manufacturer
        </Link>
      }
      machines={tag.machines}
      basePath={manufacturerTagHref(tag.slug)}
    >
      {children}
    </MachineGroupShell>
  );
}
