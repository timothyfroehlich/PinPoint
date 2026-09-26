import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { AutomaticBadge } from "~/components/tags/AutomaticBadge";
import { TagList } from "~/components/tags/TagList";
import { TagTrail } from "~/components/tags/TagTrail";
import { listTags } from "~/lib/tags/tags";
import { isTagTypeId, TAG_TYPES, tagHref } from "~/lib/tags/types";

interface PageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { type } = await params;
  return {
    title: isTagTypeId(type)
      ? `${TAG_TYPES[type].label} Tags | PinPoint`
      : "Tags | PinPoint",
  };
}

/** A tag type's page (spec collections-and-tags 7.7–7.8). */
export default async function TagTypePage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { type } = await params;
  if (!isTagTypeId(type)) notFound();
  const info = TAG_TYPES[type];
  const tags = (await listTags())[type];

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        <div className="space-y-1">
          <TagTrail />
          <PageHeader
            title={info.label}
            titleAdornment={info.automatic ? <AutomaticBadge /> : null}
          />
          <p className="pt-1 text-sm text-muted-foreground">{info.source}</p>
        </div>
        {tags.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tags yet
          </p>
        ) : (
          <TagList
            tags={tags.map((tag) => ({
              href: tagHref(tag.type, tag.slug),
              name: tag.name,
              machineCount: tag.machines.length,
            }))}
          />
        )}
      </div>
    </PageContainer>
  );
}
