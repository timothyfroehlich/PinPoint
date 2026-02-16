import type React from "react";
import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PageShell } from "~/components/layout/PageShell";
import { ChangelogSeenMarker } from "./changelog-seen-marker";
import ChangelogContent from "@content/changelog.mdx";

export const metadata: Metadata = {
  title: "What's New | PinPoint",
  description: "Latest features and bug fixes in PinPoint",
};

interface ChangelogMeta {
  totalEntries: number;
  lastUpdated: string;
}

function readChangelogMeta(): ChangelogMeta {
  const metaPath = join(process.cwd(), "content", "changelog-meta.json");
  return JSON.parse(readFileSync(metaPath, "utf-8")) as ChangelogMeta;
}

export default function WhatsNewPage(): React.JSX.Element {
  const meta = readChangelogMeta();

  return (
    <PageShell size="narrow">
      <ChangelogSeenMarker totalEntries={meta.totalEntries} />

      <header className="space-y-2 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          What&apos;s New
        </h1>
        <p className="text-sm text-muted-foreground">
          Recent features and fixes in PinPoint.
        </p>
      </header>

      <article className="space-y-6">
        <ChangelogContent />
      </article>
    </PageShell>
  );
}
