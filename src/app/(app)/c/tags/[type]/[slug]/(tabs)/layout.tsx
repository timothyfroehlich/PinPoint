import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MachineGroupShell } from "~/components/collections/MachineGroupShell";
import { EditTagMachinesDialog } from "~/components/tags/EditTagMachinesDialog";
import { TagActionsMenu } from "~/components/tags/TagActionsMenu";
import { TagTrail } from "~/components/tags/TagTrail";
import type { ResolvedTag } from "~/lib/tags/tags";
import {
  getTagEditor,
  getTagForLayout,
  getTagMerge,
  getTagMove,
} from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface TagParams {
  params: Promise<{ type: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: TagParams): Promise<Metadata> {
  const { type, slug } = await params;
  const resolved = await getTagForLayout(type, slug);
  return {
    title: resolved ? `${resolved.tag.name} | PinPoint` : "Tag | PinPoint",
  };
}

/** The tag type a tag's breadcrumb links to; none for a tag without one (7.7). */
function trailType(
  resolved: ResolvedTag
): { label: string; href: string } | undefined {
  const { group } = resolved;
  if (group.kind === "automatic") return group.type;
  if (group.kind === "hand") {
    return { label: group.type.name, href: group.type.href };
  }
  return undefined;
}

export default async function TagLayout({
  children,
  params,
}: TagParams & { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { type, slug } = await params;
  const [resolved, editor, move, merge] = await Promise.all([
    getTagForLayout(type, slug),
    getTagEditor(type, slug),
    getTagMove(type, slug),
    getTagMerge(type, slug),
  ]);
  if (!resolved) notFound();
  const { tag } = resolved;

  return (
    <MachineGroupShell
      title={tag.name}
      eyebrow={<TagTrail type={trailType(resolved)} />}
      machines={tag.machines}
      basePath={tag.href}
      action={
        editor && move && merge ? (
          <div className="flex items-center gap-2">
            <EditTagMachinesDialog {...editor} />
            <TagActionsMenu
              tagId={editor.tagId}
              name={editor.tagName}
              machineCount={editor.currentIds.length}
              parentHref={editor.parentHref}
              move={move}
              merge={merge}
            />
          </div>
        ) : null
      }
    >
      {children}
    </MachineGroupShell>
  );
}
