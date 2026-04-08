import type React from "react";
import type { Metadata } from "next";
import { ChangelogSeenMarker } from "./changelog-seen-marker";
import ChangelogContent from "@content/changelog.mdx";
import changelogMeta from "@content/changelog-meta.json";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PageContainer } from "~/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "What's New | PinPoint",
  description: "Latest features and bug fixes in PinPoint",
};

export default function WhatsNewPage(): React.JSX.Element {
  return (
    <PageContainer size="narrow">
      <ChangelogSeenMarker totalEntries={changelogMeta.totalEntries} />
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">What&apos;s New</CardTitle>
        </CardHeader>
        <CardContent>
          <article className="space-y-6">
            <ChangelogContent />
          </article>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
