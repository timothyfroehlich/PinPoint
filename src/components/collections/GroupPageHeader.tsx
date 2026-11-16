"use client";

import type React from "react";
import { useRef } from "react";
import {
  CrumbList,
  GroupBreadcrumb,
  type Crumb,
} from "~/components/collections/GroupBreadcrumb";
import { useMeasuredWidths } from "~/components/list-view/use-measured-widths";
import {
  planGroupHeader,
  type GroupHeaderPlan,
} from "~/lib/list-view/overflow";
import { cn } from "~/lib/utils";

interface GroupPageHeaderProps {
  title: string;
  /** Where the group lives (collections-and-tags 4.8); empty for none. */
  breadcrumb: readonly Crumb[];
  /** A Collection's description, already clamped (4.7, 4.12). */
  description?: React.ReactNode;
}

const titleClass =
  "text-2xl/[30px] font-bold tracking-tight text-foreground md:text-3xl/9";

/**
 * A Collection or Tag page's header (collections-and-tags 4.2, 4.8–4.12):
 * the breadcrumb, the title, and a Collection's description, with no counts.
 *
 * The breadcrumb sits inline before the title and moves above it when the
 * row runs out of room; at and above md the description sits beside the
 * title in a 280–560px column and moves under it when that column cannot
 * get 280px, and below md it always sits under the title (list-views §8.9,
 * §8.10). The header measures its own width and its title and breadcrumb on
 * one line (CORE-RESP-002 boundary), plans both widths' layouts, and lets
 * the md breakpoint in CSS pick which one shows.
 */
export function GroupPageHeader({
  title,
  breadcrumb,
  description,
}: GroupPageHeaderProps): React.JSX.Element {
  const containerRef = useRef<HTMLElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const hasBreadcrumb = breadcrumb.length > 0;
  const hasDescription = description !== undefined && description !== null;
  const contentKey = [title, ...breadcrumb.map((crumb) => crumb.label)].join(
    "|"
  );
  const measured = useMeasuredWidths(containerRef, laneRef, contentKey);

  const plan = (withDescription: boolean): GroupHeaderPlan | null =>
    measured && measured.available > 0
      ? planGroupHeader({
          available: measured.available,
          breadcrumb: hasBreadcrumb ? (measured.widths["breadcrumb"] ?? 0) : 0,
          title: measured.widths["title"] ?? 0,
          description: withDescription,
        })
      : null;
  // Before the first measurement CSS guesses: the breadcrumb above the
  // title on phones, inline before it with the description beside on
  // wider screens.
  const phone = plan(false);
  const wide = plan(hasDescription);
  const phoneInline = phone?.breadcrumbInline ?? false;
  const wideInline = wide?.breadcrumbInline ?? true;
  const beside = hasDescription && (wide?.descriptionBeside ?? true);

  return (
    <header
      ref={containerRef}
      data-testid="group-header"
      // The plan each width shows, for tests and screenshots to read.
      data-breadcrumb-phone={phoneInline ? "inline" : "above"}
      data-breadcrumb-wide={wideInline ? "inline" : "above"}
      data-description={beside ? "beside" : "under"}
      className={cn(
        "relative flex flex-col gap-1",
        beside && "md:flex-row md:items-start md:gap-6"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1 md:flex-[0_1_auto]",
          phoneInline && "max-md:flex-row max-md:items-start max-md:gap-2",
          wideInline && "md:flex-row md:items-start md:gap-2"
        )}
      >
        {hasBreadcrumb ? (
          <GroupBreadcrumb
            crumbs={breadcrumb}
            // Inline, the breadcrumb lines up with the title's top and ends
            // with a "›" before it.
            className={cn(
              phoneInline && "max-md:mt-1",
              wideInline && "md:mt-1"
            )}
            trailingSeparatorClassName={cn(
              !phoneInline && "max-md:hidden",
              !wideInline && "md:hidden"
            )}
          />
        ) : null}
        <h1 className={cn("min-w-0 break-words", titleClass)}>{title}</h1>
      </div>
      {hasDescription ? (
        <div
          className={cn(
            "min-w-0",
            beside && "md:max-w-[560px] md:min-w-[280px] md:flex-[1_1_280px]"
          )}
        >
          {description}
        </div>
      ) : null}

      {/* The title and breadcrumb on one line, kept out of the
          accessibility tree and clipped so they never widen the page. */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        <span data-measure="title" className={cn("absolute w-max", titleClass)}>
          {title}
        </span>
        {hasBreadcrumb ? (
          <span data-measure="breadcrumb" className="absolute w-max">
            <CrumbList
              crumbs={breadcrumb}
              trailingSeparatorClassName=""
              asText
            />
          </span>
        ) : null}
      </div>
    </header>
  );
}
