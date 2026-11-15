import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ClipboardList, Tag, Trophy } from "lucide-react";

import { PageContainer } from "~/components/layout/PageContainer";
import { SettingsTagActionsMenu } from "~/components/settings-tags/SettingsTagActionsMenu";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getViewer } from "~/lib/auth/viewer";
import { formatDate } from "~/lib/dates";
import { getSettingsTagPage } from "~/lib/machines/settings-tag-queries";
import {
  SETTINGS_TAGS_HREF,
  type SettingsTagPageSet,
  setsOnMachinesPhrase,
  settingsTagPageCounts,
  settingsTagPrintHref,
  undecidedSetCount,
} from "~/lib/machines/settings-tags";
import { canManageSettingsTags } from "~/lib/permissions";
import { getAccessLevel } from "~/lib/permissions/helpers";
import { db } from "~/server/db";

interface TagParams {
  params: Promise<{ slug: string }>;
}

const loadTag = cache((slug: string) => getSettingsTagPage(db, slug));

export async function generateMetadata({
  params,
}: TagParams): Promise<Metadata> {
  const { slug } = await params;
  const tag = await loadTag(slug);
  return {
    title: tag ? `${tag.name} | Settings tags | PinPoint` : "Settings tag",
  };
}

function SetBadges({ set }: { set: SettingsTagPageSet }): React.JSX.Element {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {set.isPreferredHouse ? (
        <Badge
          variant="outline"
          className="border-warning/30 bg-warning/10 text-warning"
        >
          ★ Default House
        </Badge>
      ) : null}
      {set.isPreferredTournament ? (
        <Badge
          variant="outline"
          className="border-primary bg-primary text-primary-foreground"
        >
          <Trophy aria-hidden="true" />
          Default Tournament
        </Badge>
      ) : null}
      {set.isCommunity ? (
        <Badge variant="secondary">Community</Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-outline-variant bg-muted text-muted-foreground"
        >
          Personal
        </Badge>
      )}
    </span>
  );
}

/**
 * A settings tag's page (machine-settings §3.6): every set carrying it,
 * grouped by machine, and a link to Print settings sheets with those machines
 * added and the tag as the To starting set (settings-sheets §2.6). Public.
 */
export default async function SettingsTagPage({
  params,
}: TagParams): Promise<React.JSX.Element> {
  const { slug } = await params;
  const [tag, viewer] = await Promise.all([loadTag(slug), getViewer()]);
  if (!tag) notFound();
  const { setCount, machineCount } = settingsTagPageCounts(tag);
  const canManage =
    !tag.isBuiltin && canManageSettingsTags(getAccessLevel(viewer.role));

  return (
    <PageContainer size="standard" className="max-w-4xl">
      <div className="space-y-5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Tag aria-hidden="true" className="size-3.5" />
          <Link
            href={SETTINGS_TAGS_HREF}
            className="font-medium text-primary hover:underline"
          >
            Settings tags
          </Link>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant pb-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-balance text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">
              {tag.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Settings tag · {setsOnMachinesPhrase(setCount, machineCount)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild className="max-md:h-11">
              <Link href={settingsTagPrintHref(tag.slug, tag.machines)}>
                <ClipboardList className="size-4" aria-hidden="true" />
                Print settings sheets
              </Link>
            </Button>
            {canManage ? (
              <SettingsTagActionsMenu
                tagId={tag.id}
                name={tag.name}
                setCount={setCount}
                machineCount={machineCount}
              />
            ) : null}
          </div>
        </div>

        {tag.machines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant py-8 text-center text-sm text-muted-foreground">
            No sets carry this tag
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {tag.machines.map((machine) => {
              const undecided = undecidedSetCount(tag.slug, machine.sets);
              const settingsHref = `/m/${machine.initials}/settings`;
              return (
                <section
                  key={machine.id}
                  aria-labelledby={`machine-${machine.id}`}
                  className="overflow-hidden rounded-xl border border-outline-variant bg-card"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-4 py-3">
                    <h2
                      id={`machine-${machine.id}`}
                      className="text-[15px] font-semibold"
                    >
                      <Link href={settingsHref} className="hover:underline">
                        {machine.name}
                      </Link>
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {machine.initials}
                    </span>
                    {undecided > 0 ? (
                      <span className="text-xs font-medium text-warning md:ml-auto">
                        {undecided} sets, no default
                      </span>
                    ) : null}
                  </div>
                  <ul>
                    {machine.sets.map((set) => (
                      <li
                        key={set.id}
                        className="border-t border-outline-variant/60"
                      >
                        <Link
                          href={settingsHref}
                          className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 transition-colors hover:bg-muted motion-reduce:transition-none"
                        >
                          <span className="font-medium [overflow-wrap:anywhere]">
                            {set.name}
                          </span>
                          <SetBadges set={set} />
                          <span className="ml-auto text-xs text-muted-foreground">
                            Updated {formatDate(set.updatedAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
