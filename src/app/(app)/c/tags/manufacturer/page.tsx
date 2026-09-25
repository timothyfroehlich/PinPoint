import type React from "react";
import type { Metadata } from "next";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { AutomaticBadge } from "~/components/tags/AutomaticBadge";
import { TagList } from "~/components/tags/TagList";
import { TagTrail } from "~/components/tags/TagTrail";
import { manufacturerTagHref } from "~/lib/machines/manufacturer";
import { listManufacturerTags } from "~/lib/tags/manufacturer";
import { MANUFACTURER_TAG_TYPE } from "~/lib/tags/types";

export const metadata: Metadata = {
  title: "Manufacturer Tags | PinPoint",
};

/** The Manufacturer tag type's page (spec collections-and-tags 7.7–7.8). */
export default async function ManufacturerTagTypePage(): Promise<React.JSX.Element> {
  const tags = await listManufacturerTags();

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        <div className="space-y-1">
          <TagTrail />
          <PageHeader
            title={MANUFACTURER_TAG_TYPE.label}
            titleAdornment={
              MANUFACTURER_TAG_TYPE.automatic ? <AutomaticBadge /> : null
            }
          />
          <p className="pt-1 text-sm text-muted-foreground">
            {MANUFACTURER_TAG_TYPE.source}
          </p>
        </div>
        {tags.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tags yet
          </p>
        ) : (
          <TagList
            tags={tags.map((tag) => ({
              href: manufacturerTagHref(tag.slug),
              name: tag.name,
              machineCount: tag.machines.length,
            }))}
          />
        )}
      </div>
    </PageContainer>
  );
}
