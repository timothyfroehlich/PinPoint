import type React from "react";
import Link from "next/link";

import { HelpToc } from "~/components/help/HelpToc";
import { cn } from "~/lib/utils";

interface HelpPageProps {
  breadcrumb: string;
  title: string;
  description?: string;
  size?: "narrow" | "default";
  /** Show "On this page" navigation built from the article's headings. */
  toc?: boolean;
  children: React.ReactNode;
}

export function HelpPage({
  breadcrumb,
  title,
  description,
  size = "narrow",
  toc = false,
  children,
}: HelpPageProps): React.JSX.Element {
  const sizeClass = size === "narrow" ? "max-w-3xl" : "max-w-6xl";
  const header = (
    <header className="space-y-2 mb-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/help" className="text-link">
          Help
        </Link>
        {" / "}
        {breadcrumb}
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );

  if (toc) {
    // The rail sits beside the article, so the article column keeps the
    // narrow width and the whole page widens by the rail.
    return (
      <div className="mx-auto max-w-5xl pb-10 md:pt-10">
        <HelpToc>
          <div className={sizeClass}>
            {header}
            <div>{children}</div>
          </div>
        </HelpToc>
      </div>
    );
  }

  return (
    <div className={cn(sizeClass, "mx-auto py-10")}>
      {header}
      <div>{children}</div>
    </div>
  );
}
