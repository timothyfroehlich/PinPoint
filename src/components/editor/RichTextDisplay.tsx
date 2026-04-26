// src/components/editor/RichTextDisplay.tsx
import React from "react";
import { renderDocToHtml, RENDER_FAILED_SENTINEL } from "~/lib/tiptap/render";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { cn } from "~/lib/utils";
import { RenderFailedPlaceholder } from "~/components/editor/RenderFailedPlaceholder";

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
 * Security: Output is double-sanitized — the renderer escapes all text
 * content, then sanitize-html applies a strict tag/attribute allowlist.
 *
 * Error handling: If rendering throws, renderDocToHtml returns the
 * RENDER_FAILED_SENTINEL string and the exception is captured to Sentry.
 * RichTextDisplay detects the sentinel and renders RenderFailedPlaceholder
 * so the user sees an actionable notice rather than a blank content area.
 */
export function RichTextDisplay({
  content,
  className,
}: RichTextDisplayProps): React.JSX.Element | null {
  if (!content) {
    return null;
  }

  const html = renderDocToHtml(content);

  if (html === RENDER_FAILED_SENTINEL) {
    return <RenderFailedPlaceholder />;
  }

  return (
    <div
      className={cn("prose prose-sm prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
