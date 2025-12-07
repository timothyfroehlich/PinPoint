"use client";

import React, { useCallback } from "react";
import { Button } from "~/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

interface FeedbackIntegration {
  createForm: () => Promise<void>;
}

export function FeedbackButton(): React.JSX.Element {
  const handleClick = useCallback(async () => {
    const client = Sentry.getClient();
    const feedback = client?.getIntegrationByName("Feedback") as unknown as
      | FeedbackIntegration
      | undefined;

    if (!feedback) {
      console.warn(
        "Sentry Feedback integration not found. Ensure Sentry is initialized and the feedback integration is added."
      );
      return;
    }

    try {
      // Manually create (open) the feedback form
      await feedback.createForm();
    } catch (error) {
      console.error("Failed to open Sentry feedback form:", error);
    }
  }, []);

  return (
    <Button variant="ghost" size="sm" className="gap-2" onClick={handleClick}>
      <MessageSquarePlus className="size-4" />
      Feedback
    </Button>
  );
}
