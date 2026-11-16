import type React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";

/** One step of a breadcrumb: where the page lives. */
export interface Crumb {
  label: string;
  href: string;
}

const TAGS_CRUMB: Crumb = { label: "Tags", href: "/c/tags" };

/**
 * A tag's breadcrumb (collections-and-tags 4.8, 7.7): Tags, then the tag's
 * tag type when it has one. A tag type's own page passes no type.
 */
export function tagCrumbs(type?: Crumb): Crumb[] {
  return type ? [TAGS_CRUMB, type] : [TAGS_CRUMB];
}

/** A Collection's breadcrumb: Collections, linking to My Collections (4.8). */
export const COLLECTIONS_CRUMB: Crumb = {
  label: "Collections",
  href: "/c/collections",
};

function Separator({
  className,
}: {
  className?: string | undefined;
}): React.JSX.Element {
  return (
    <li aria-hidden="true" className={cn("mx-1.5", className)}>
      ›
    </li>
  );
}

// On phones each link reaches 44px (list-views §7.9) through a centered hit
// area, so the trail keeps its spacing.
const linkClass =
  "relative rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:after:absolute max-md:after:top-1/2 max-md:after:left-1/2 max-md:after:size-11 max-md:after:-translate-x-1/2 max-md:after:-translate-y-1/2";

interface CrumbListProps {
  crumbs: readonly Crumb[];
  /**
   * Classes for the "›" that ends a breadcrumb sitting inline before the
   * title; omitted, the breadcrumb never ends with one.
   */
  trailingSeparatorClassName?: string | undefined;
  /** Plain text instead of links, for a hidden measurement copy. */
  asText?: boolean | undefined;
}

/** The crumbs themselves, "›" between them, with no tag icon (4.8). */
export function CrumbList({
  crumbs,
  trailingSeparatorClassName,
  asText = false,
}: CrumbListProps): React.JSX.Element {
  return (
    <ol className="flex flex-wrap items-center text-[13px] leading-[18px] text-muted-foreground">
      {crumbs.map((crumb, index) => (
        <CrumbItem
          key={crumb.href}
          crumb={crumb}
          separated={index > 0}
          asText={asText}
        />
      ))}
      {trailingSeparatorClassName !== undefined ? (
        <Separator className={trailingSeparatorClassName} />
      ) : null}
    </ol>
  );
}

function CrumbItem({
  crumb,
  separated,
  asText,
}: {
  crumb: Crumb;
  separated: boolean;
  asText: boolean;
}): React.JSX.Element {
  return (
    <>
      {separated ? <Separator /> : null}
      <li>
        {asText ? (
          <span>{crumb.label}</span>
        ) : (
          <Link href={crumb.href} className={linkClass}>
            {crumb.label}
          </Link>
        )}
      </li>
    </>
  );
}

interface GroupBreadcrumbProps extends Omit<CrumbListProps, "asText"> {
  className?: string | undefined;
}

/** A page's breadcrumb: where a Machine Group or tag type lives (4.8). */
export function GroupBreadcrumb({
  crumbs,
  trailingSeparatorClassName,
  className,
}: GroupBreadcrumbProps): React.JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className={cn("shrink-0", className)}>
      <CrumbList
        crumbs={crumbs}
        trailingSeparatorClassName={trailingSeparatorClassName}
      />
    </nav>
  );
}
