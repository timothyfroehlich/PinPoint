import sanitizeHtml from "sanitize-html";

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

  // Handle links [text](url)
  parsed = parsed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return parsed;
}

/**
 * Renders strict subset of Markdown to HTML with sanitization.
 * Supports: #, ##, ###, -, bold, italic, code, links.
 * All output is sanitized to prevent XSS.
 */
export function renderMarkdownToHtml(markdown: string): string {
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

  const rawHtml = html.join("\n");

  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "h3"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "class", "target", "rel"],
    },
  });
}
