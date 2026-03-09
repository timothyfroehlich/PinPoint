// src/components/editor/RichTextDisplay.tsx
import React from "react";
import { renderDocToHtml } from "~/lib/tiptap/render";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { cn } from "~/lib/utils";

interface RichTextDisplayProps {
  content: ProseMirrorDoc | null;
  className?: string;
}

/**
 * Render ProseMirror JSON to sanitized HTML for display.
 *
 * Works in both Server Components and Client Components because
 * the underlying renderer uses pure string operations (no DOM/jsdom).
 *
 * Security: Content is double-sanitized — the renderer escapes all text
 * content, then sanitize-html applies a strict tag/attribute allowlist.
 */
export function RichTextDisplay({
  content,
  className,
}: RichTextDisplayProps): React.JSX.Element | null {
  if (!content) {
    return null;
  }

  // renderDocToHtml returns sanitized HTML (via sanitize-html allowlist)
  const html = renderDocToHtml(content);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
