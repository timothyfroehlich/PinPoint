"use client";

import * as Sentry from "@sentry/nextjs";
import React, { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { MessageSquare, Bug, Lightbulb } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

// Delay to allow dropdown menu to close before opening Sentry modal
// to prevent focus management conflicts between Radix UI and Sentry's portal
const DROPDOWN_CLOSE_DELAY = 100;

interface SentryFeedbackWidget {
  createForm?: (options?: {
    formTitle?: string;
    messagePlaceholder?: string;
    submitButtonLabel?: string;
    tags?: Record<string, string | number | boolean>;
  }) => Promise<{ open: () => void; appendToDom?: () => void } | void>;
  openDialog?: (options?: {
    formTitle?: string;
    messagePlaceholder?: string;
    submitButtonLabel?: string;
  }) => void;
  open?: () => void;
}

function isSentryFeedbackWidget(obj: unknown): obj is SentryFeedbackWidget {
  return (
    typeof obj === "object" &&
    obj !== null &&
    ("createForm" in obj || "openDialog" in obj || "open" in obj)
  );
}

// Shared helper that opens the Sentry feedback widget without type-specific form options.
// Applies a consistent delay to all open methods to prevent focus conflicts with Radix UI portals.
// Used by both openFeedbackForm and handleFeedback (for fallback branches).
function openSentryFeedbackWidget(
  feedback: unknown,
  delayMs: number = DROPDOWN_CLOSE_DELAY
): void {
  if (!isSentryFeedbackWidget(feedback)) {
    return;
  }

  const widget = feedback;

  if (typeof widget.createForm === "function") {
    const createFormFn = widget.createForm;

    window.setTimeout(() => {
      void (async () => {
        try {
          const dialog = await createFormFn();

          if (dialog) {
            if (typeof dialog.appendToDom === "function") {
              dialog.appendToDom();
            }
            if (typeof dialog.open === "function") {
              dialog.open();
            }
          }
        } catch (err) {
          console.error("[FeedbackWidget] Error calling createForm:", err);
        }
      })();
    }, delayMs);
  } else if (typeof widget.openDialog === "function") {
    const openDialogFn = widget.openDialog;
    window.setTimeout(() => {
      openDialogFn();
    }, delayMs);
  } else if (typeof widget.open === "function") {
    const openFn = widget.open;
    window.setTimeout(() => {
      openFn();
    }, delayMs);
  }
}

export function openFeedbackForm(): void {
  const rawFeedback = Sentry.getFeedback();
  const feedback = rawFeedback as unknown;

  openSentryFeedbackWidget(feedback, DROPDOWN_CLOSE_DELAY);
}

function handleFeedback(type: "bug" | "feature"): void {
  const rawFeedback = Sentry.getFeedback();
  // Cast to unknown to allow type guard to work
  const feedback = rawFeedback as unknown;

  if (!isSentryFeedbackWidget(feedback)) {
    return;
  }

  const widget = feedback;

  if (typeof widget.createForm === "function") {
    // Wrap in arrow function to preserve 'this' context if needed, though bind isn't strictly required if method doesn't use 'this'
    const createFormFn = widget.createForm;

    window.setTimeout(() => {
      void (async () => {
        try {
          const dialog = await createFormFn({
            formTitle: type === "bug" ? "Report a Bug" : "Request a Feature",
            messagePlaceholder:
              type === "bug"
                ? "Describe the bug, what was expected, and what happened..."
                : "Describe the feature you'd like to see...",
            submitButtonLabel:
              type === "bug" ? "Send Bug Report" : "Send Feature Request",
            tags: {
              feedback_type: type,
            },
          });

          if (dialog) {
            // Ensure dialog is attached to DOM before opening
            if (typeof dialog.appendToDom === "function") {
              dialog.appendToDom();
            }
            if (typeof dialog.open === "function") {
              dialog.open();
            }
          }
        } catch (err) {
          console.error("[FeedbackWidget] Error calling createForm:", err);
        }
      })();
    }, DROPDOWN_CLOSE_DELAY);
  } else {
    // Delegate to shared helper for fallback widget APIs (openDialog / open).
    // Type-specific options (formTitle etc.) are not available on these older APIs.
    openSentryFeedbackWidget(feedback, DROPDOWN_CLOSE_DELAY);
  }
}

export function FeedbackWidget(): React.JSX.Element | null {
  useEffect(() => {
    // Optional: Mount checks/logging if needed in dev
    if (process.env.NODE_ENV === "development") {
      const feedback = Sentry.getFeedback();
      console.log("[FeedbackWidget] Mounted.", { feedback });
    }
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary gap-2"
          title="Send Feedback"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="hidden sm:inline">Feedback</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handleFeedback("bug")}>
          <Bug className="mr-2 h-4 w-4" />
          <span>Report a Bug</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleFeedback("feature")}>
          <Lightbulb className="mr-2 h-4 w-4" />
          <span>Request a Feature</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
