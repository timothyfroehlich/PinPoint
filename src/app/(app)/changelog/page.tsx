import type React from "react";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { PageShell } from "~/components/layout/PageShell";

export const metadata = {
  title: "Changelog | PinPoint",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let inList = false;

  const closeList = (): void => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      closeList();
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${escapeHtml(line.slice(2).trim())}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${escapeHtml(line.slice(4).trim())}</h3>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        inList = true;
        html.push("<ul>");
      }
      html.push(`<li>${escapeHtml(line.slice(2).trim())}</li>`);
      continue;
    }

    // Fallback to paragraph
    closeList();
    html.push(`<p>${escapeHtml(line.trim())}</p>`);
  }

  closeList();
  return html.join("\n");
}

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
