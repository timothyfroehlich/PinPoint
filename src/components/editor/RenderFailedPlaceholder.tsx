"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { openFeedbackForm } from "~/components/feedback/FeedbackWidget";

/**
 * Inline error notice shown by RichTextDisplay when the ProseMirror renderer
 * throws an unexpected exception.
 *
 * Renders a visible notice so users know content failed to render, and offers
 * a one-click path to report the issue via the Sentry feedback widget.
 * The underlying error is already captured to Sentry by renderDocToHtml.
 */
export function RenderFailedPlaceholder(): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      role="alert"
      aria-label="Content failed to render"
      data-testid="render-failed-placeholder"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">This content failed to render.</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto shrink-0 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/20 hover:text-destructive"
        onClick={() => {
          openFeedbackForm();
        }}
      >
        Report this
      </Button>
    </div>
  );
}
