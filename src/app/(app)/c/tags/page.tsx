import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { AutomaticBadge } from "~/components/tags/AutomaticBadge";
import { TagList } from "~/components/tags/TagList";
import { manufacturerTagHref } from "~/lib/machines/manufacturer";
import { listManufacturerTags } from "~/lib/tags/manufacturer";
import { MANUFACTURER_TAG_TYPE } from "~/lib/tags/types";

export const metadata: Metadata = {
  title: "Tags | PinPoint",
};

/** Public tag browse, grouped by tag type (spec collections-and-tags 7.3). */
export default async function TagsPage(): Promise<React.JSX.Element> {
  const manufacturers = await listManufacturerTags();

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        <PageHeader title="Tags" />
        {manufacturers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tags yet
          </p>
        ) : (
          <section aria-labelledby="manufacturer-tags-heading">
            <h2
              id="manufacturer-tags-heading"
              className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <Link
                href={MANUFACTURER_TAG_TYPE.href}
                className="hover:text-foreground"
              >
                {MANUFACTURER_TAG_TYPE.label}
              </Link>
              {MANUFACTURER_TAG_TYPE.automatic ? <AutomaticBadge /> : null}
            </h2>
            <TagList
              tags={manufacturers.map((tag) => ({
                href: manufacturerTagHref(tag.slug),
                name: tag.name,
                machineCount: tag.machines.length,
              }))}
            />
          </section>
        )}
      </div>
    </PageContainer>
  );
}
