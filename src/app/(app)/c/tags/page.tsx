import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { AutomaticBadge } from "~/components/tags/AutomaticBadge";
import { TagList } from "~/components/tags/TagList";
import { listTags } from "~/lib/tags/tags";
import { TAG_TYPE_IDS, TAG_TYPES, tagHref } from "~/lib/tags/types";

export const metadata: Metadata = {
  title: "Tags | PinPoint",
};

/** Public tag browse, grouped by tag type (spec collections-and-tags 7.3). */
export default async function TagsPage(): Promise<React.JSX.Element> {
  const tags = await listTags();
  const types = TAG_TYPE_IDS.filter((type) => tags[type].length > 0);

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        <PageHeader title="Tags" />
        {types.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tags yet
          </p>
        ) : (
          types.map((type) => {
            const info = TAG_TYPES[type];
            return (
              <section key={type} aria-labelledby={`${type}-tags-heading`}>
                <h2
                  id={`${type}-tags-heading`}
                  className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <Link
                    href={info.href}
                    className="text-primary hover:underline"
                  >
                    {info.label}
                  </Link>
                  {info.automatic ? <AutomaticBadge /> : null}
                </h2>
                <TagList
                  tags={tags[type].map((tag) => ({
                    href: tagHref(tag.type, tag.slug),
                    name: tag.name,
                    machineCount: tag.machines.length,
                  }))}
                />
              </section>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
