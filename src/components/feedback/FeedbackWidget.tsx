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

export function FeedbackWidget(): React.JSX.Element | null {
  interface SentryFeedbackWidget {
    createForm?: (options?: {
      formTitle?: string;
      messagePlaceholder?: string;
      tags?: Record<string, string | number | boolean>;
    }) => Promise<void>;
    openDialog?: (options?: {
      formTitle?: string;
      messagePlaceholder?: string;
    }) => void;
    open?: () => void;
  }

  function handleFeedback(type: "bug" | "feature"): void {
    const feedback = Sentry.getFeedback();
    console.log("[FeedbackWidget] Clicked:", type);
    console.log("[FeedbackWidget] Sentry.getFeedback():", feedback);

    if (feedback) {
      const widget = feedback as unknown as SentryFeedbackWidget;

      console.log("[FeedbackWidget] Widget capabilities:", {
        hasCreateForm: typeof widget.createForm === "function",
        hasOpenDialog: typeof widget.openDialog === "function",
        hasOpen: typeof widget.open === "function",
      });

      if (typeof widget.createForm === "function") {
        const createFormFn = widget.createForm; // Capture for closure safety
        // Allow Dropdown to close before opening Sentry modal to avoid focus/portal issues
        window.setTimeout(() => {
          try {
            // Safe handling whether it returns Promise or void
            const result = createFormFn({
              formTitle: type === "bug" ? "Report a Bug" : "Request a Feature",
              messagePlaceholder:
                type === "bug"
                  ? "Describe the bug, what expected, and what happened..."
                  : "Describe the feature you'd like to see...",
              tags: {
                feedback_type: type,
              },
            });

            // If it returns a promise, verify it and catch errors
            // Use void to mark floating promise as handled
            void result.catch((err) => {
              console.error("[FeedbackWidget] Failed to create form:", err);
            });
          } catch (err) {
            console.error("[FeedbackWidget] Error calling createForm:", err);
          }
        }, 100);
      } else if (typeof widget.openDialog === "function") {
        widget.openDialog({
          formTitle: type === "bug" ? "Report a Bug" : "Request a Feature",
          messagePlaceholder:
            type === "bug"
              ? "Describe the bug, what expected, and what happened..."
              : "Describe the feature you'd like to see...",
        });
      } else if (typeof widget.open === "function") {
        console.warn(
          "[FeedbackWidget] openDialog not found, falling back to open()"
        );
        widget.open();
      } else {
        console.error(
          "[FeedbackWidget] No suitable open method found on widget"
        );
      }
    } else {
      console.error(
        "[FeedbackWidget] Sentry.getFeedback() returned null/undefined"
      );
    }
  }

  useEffect(() => {
    const feedback = Sentry.getFeedback();
    console.log("[FeedbackWidget] Mounted. Sentry.getFeedback():", feedback);
    if (feedback) {
      const widget = feedback as unknown as SentryFeedbackWidget;
      console.log("[FeedbackWidget] Mount check - capabilities:", {
        hasCreateForm: typeof widget.createForm === "function",
        hasOpenDialog: typeof widget.openDialog === "function",
        hasOpen: typeof widget.open === "function",
      });
    } else {
      console.warn(
        "[FeedbackWidget] Mounted but Sentry.getFeedback() is undefined. Sentry might not be initialized yet or feedback integration is missing."
      );
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
          <span>Feedback</span>
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
