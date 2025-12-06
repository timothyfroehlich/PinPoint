"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export function FeedbackButton(): React.JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Manually attach Sentry Feedback widget to this button
    // This avoids issues with selectors not finding the element during initialization
    if (buttonRef.current) {
      const feedback = Sentry.getFeedback();
      if (feedback) {
        // attachTo returns a cleanup function (unsubscribe)
        const cleanup = feedback.attachTo(buttonRef.current);
        return () => {
          cleanup();
        };
      }
    }
    return undefined;
  }, []);

  return (
    <Button ref={buttonRef} variant="ghost" size="sm" className="gap-2">
      <MessageSquarePlus className="size-4" />
      Feedback
    </Button>
  );
}
