import type React from "react";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { PageShell } from "~/components/layout/PageShell";

export const metadata = {
  title: "Roadmap | PinPoint",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseInline(text: string): string {
  // Handle bold (**text**)
  let parsed = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Handle italic (*text*)
  parsed = parsed.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Handle code (`text`)
  parsed = parsed.replace(/`(.*?)`/g, "<code>$1</code>");

  return parsed;
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

    if (line.trim() === "---") {
      closeList();
      html.push("<hr />");
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${parseInline(escapeHtml(line.slice(2).trim()))}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${parseInline(escapeHtml(line.slice(3).trim()))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${parseInline(escapeHtml(line.slice(4).trim()))}</h3>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        inList = true;
        html.push("<ul>");
      }
      html.push(`<li>${parseInline(escapeHtml(line.slice(2).trim()))}</li>`);
      continue;
    }

    // Fallback to paragraph
    closeList();
    html.push(`<p>${parseInline(escapeHtml(line.trim()))}</p>`);
  }

  closeList();
  return html.join("\n");
}

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
