"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import {
  SectionNavLayout,
  type SectionNavItem,
} from "~/components/layout/SectionNav";

/**
 * A help article with the "On this page" navigation the Manage tab uses.
 *
 * The entries are the article's own `##` and `###` headings, read from the
 * rendered page after mount, so an article never lists its sections twice.
 * The desktop rail keeps its width while empty, so the article does not shift
 * when the entries appear.
 */
export function HelpToc({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const articleRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<SectionNavItem[]>([]);

  useEffect(() => {
    const article = articleRef.current;
    if (article === null) return;
    const headings =
      article.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id]");
    setSections(
      Array.from(headings, (heading) => ({
        id: heading.id,
        label: heading.textContent,
        depth: heading.tagName === "H3" ? 2 : 1,
      }))
    );
  }, []);

  return (
    <SectionNavLayout sections={sections}>
      <div ref={articleRef}>{children}</div>
    </SectionNavLayout>
  );
}
