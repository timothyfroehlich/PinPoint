import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MachineGroupShell } from "~/components/collections/MachineGroupShell";
import { TagTrail } from "~/components/tags/TagTrail";
import { TAG_TYPES, tagHref } from "~/lib/tags/types";
import { getTagForLayout } from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface TagParams {
  params: Promise<{ type: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: TagParams): Promise<Metadata> {
  const { type, slug } = await params;
  const tag = await getTagForLayout(type, slug);
  return { title: tag ? `${tag.name} | PinPoint` : "Tag | PinPoint" };
}

export default async function TagLayout({
  children,
  params,
}: TagParams & { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { type, slug } = await params;
  const tag = await getTagForLayout(type, slug);
  if (!tag) notFound();

  return (
    <MachineGroupShell
      title={tag.name}
      eyebrow={<TagTrail type={TAG_TYPES[tag.type]} />}
      machines={tag.machines}
      basePath={tagHref(tag.type, tag.slug)}
    >
      {children}
    </MachineGroupShell>
  );
}
