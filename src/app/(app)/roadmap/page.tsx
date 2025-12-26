import type React from "react";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { PageShell } from "~/components/layout/PageShell";
import { renderMarkdownToHtml } from "~/lib/markdown";

export const metadata = {
  title: "Roadmap | PinPoint",
};

export default async function RoadmapPage(): Promise<React.JSX.Element> {
  const roadmapPath = join(process.cwd(), "docs/V2_ROADMAP.md");
  let raw = "";
  try {
    raw = await fs.readFile(roadmapPath, "utf8");
  } catch (error) {
    console.error("Failed to read roadmap:", error);
    raw = "# Roadmap\n\nFailed to load roadmap file.";
  }

  const html = renderMarkdownToHtml(raw);

  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
        <p className="text-sm text-muted-foreground">
          Future plans and development status for PinPoint. This is rendered
          directly from the <code>docs/V2_ROADMAP.md</code> file.
        </p>
      </header>

      <div
        className="prose prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </PageShell>
  );
}
