import type React from "react";
import type { Metadata } from "next";
import { ChangelogSeenMarker } from "./changelog-seen-marker";
import ChangelogContent from "@content/changelog.mdx";
import changelogMeta from "@content/changelog-meta.json";

export const metadata: Metadata = {
  title: "What's New | PinPoint",
  description: "Latest features and bug fixes in PinPoint",
};

export default function WhatsNewPage(): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto py-10">
      <ChangelogSeenMarker totalEntries={changelogMeta.totalEntries} />

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
    </div>
  );
}
