import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "~/components/layout/PageContainer";
import { NewSettingsTagDialog } from "~/components/settings-tags/NewSettingsTagDialog";
import { getViewer } from "~/lib/auth/viewer";
import { canManageSettingsTags } from "~/lib/permissions";
import { getAccessLevel } from "~/lib/permissions/helpers";
import { listSettingsTagSummaries } from "~/lib/machines/settings-tag-queries";
import {
  builtinSlotOf,
  setsOnMachinesPhrase,
  settingsTagHref,
} from "~/lib/machines/settings-tags";
import { cn } from "~/lib/utils";
import { db } from "~/server/db";

export const metadata: Metadata = {
  title: "Settings tags | PinPoint",
};

/** The chip tone for each kind of tag, matching the set cards' badges. */
function chipTone(slug: string): string {
  switch (builtinSlotOf(slug)) {
    case "house":
      return "border-outline-variant text-muted-foreground";
    case "tournament":
      return "border-primary/30 bg-primary/10 text-primary";
    case null:
      return "border-secondary/35 bg-secondary/10 text-secondary";
  }
}

/**
 * Every settings tag with how many sets carry it, House and Tournament first
 * (machine-settings §3.7). Public; technicians and admins create tags here
 * (§3.3).
 */
export default async function SettingsTagsPage(): Promise<React.JSX.Element> {
  const [tags, viewer] = await Promise.all([
    listSettingsTagSummaries(db),
    getViewer(),
  ]);
  const canManage = canManageSettingsTags(getAccessLevel(viewer.role));

  return (
    <PageContainer size="standard" className="max-w-3xl">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant pb-3 md:pb-2">
          <h1 className="text-balance text-3xl font-bold tracking-tight">
            Settings tags
          </h1>
          {canManage ? <NewSettingsTagDialog /> : null}
        </div>
        <ul className="overflow-hidden rounded-xl border border-outline-variant bg-card">
          {tags.map((tag, index) => {
            const firstCustom =
              builtinSlotOf(tag.slug) === null &&
              builtinSlotOf(tags[index - 1]?.slug ?? "") !== null;
            return (
              <li
                key={tag.id}
                className={cn(
                  "flex min-h-13 items-center gap-3 px-4 py-2",
                  index > 0 && "border-t border-outline-variant/60",
                  firstCustom && "border-outline-variant"
                )}
              >
                <Link
                  href={settingsTagHref(tag.slug)}
                  className={cn(
                    "inline-flex min-h-8 min-w-0 max-w-full items-center rounded-md border px-2.5 text-[13px] font-medium transition-colors hover:border-primary motion-reduce:transition-none max-md:min-h-11",
                    chipTone(tag.slug)
                  )}
                >
                  <span className="truncate">{tag.name}</span>
                </Link>
                <span className="ml-auto shrink-0 text-right text-sm text-muted-foreground">
                  {setsOnMachinesPhrase(tag.setCount, tag.machineCount)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </PageContainer>
  );
}
