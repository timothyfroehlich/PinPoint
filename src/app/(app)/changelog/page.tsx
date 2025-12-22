import type React from "react";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { PageShell } from "~/components/layout/PageShell";
import { renderMarkdownToHtml } from "~/lib/markdown";

export const metadata = {
  title: "Changelog | PinPoint",
};

export default async function ChangelogPage(): Promise<React.JSX.Element> {
  const changelogPath = join(process.cwd(), "CHANGELOG.md");
  const raw = await fs.readFile(changelogPath, "utf8");
  const html = renderMarkdownToHtml(raw);

  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
        <p className="text-sm text-muted-foreground">
          Release notes and technical changes for PinPoint. This is rendered
          directly from the project&apos;s <code>CHANGELOG.md</code>.
        </p>
      </header>

      <div
        className="prose prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </PageShell>
  );
}
