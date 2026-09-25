import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { manufacturerTagHref } from "~/lib/machines/manufacturer";
import { listManufacturerTags } from "~/lib/tags/manufacturer";

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
              className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Manufacturer
            </h2>
            <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
              {manufacturers.map((tag) => (
                <li key={tag.slug}>
                  <Link
                    href={manufacturerTagHref(tag.slug)}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-variant"
                  >
                    <span className="font-medium text-foreground">
                      {tag.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {tag.machines.length}{" "}
                      {tag.machines.length === 1 ? "machine" : "machines"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
