"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useRef } from "react";
import type React from "react";
import { Button } from "~/components/ui/button";
import { MessageSquare } from "lucide-react";

export function FeedbackWidget(): React.JSX.Element | null {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const feedback = Sentry.getFeedback();
    const button = buttonRef.current;

    if (feedback && button) {
      const cleanup = feedback.attachTo(button, {
        formTitle: "Send Feedback",
      });
      return () => {
        cleanup();
      };
    }
    return undefined;
  }, []);

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-primary gap-2"
      title="Send Feedback"
    >
      <MessageSquare className="h-5 w-5" />
      <span>Feedback</span>
    </Button>
  );
}
