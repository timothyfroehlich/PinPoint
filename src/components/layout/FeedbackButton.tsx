"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { MessageSquarePlus } from "lucide-react";

export function FeedbackButton(): React.JSX.Element {
  return (
    <Button variant="ghost" size="sm" id="feedback-trigger" className="gap-2">
      <MessageSquarePlus className="size-4" />
      Feedback
    </Button>
  );
}
