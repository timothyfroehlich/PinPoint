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
 * Server component to render ProseMirror JSON to sanitized HTML.
 *
 * Uses the server-side rendering utility with strict sanitization.
 */
export function RichTextDisplay({
  content,
  className,
}: RichTextDisplayProps): React.JSX.Element | null {
  if (!content) {
    return null;
  }

  const html = renderDocToHtml(content);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
