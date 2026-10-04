import type React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "~/lib/utils";

/** A transient result line on the Admin Integrations page. */
export interface Feedback {
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
  invalidField?: boolean;
}

export function FeedbackMessage({
  feedback,
}: {
  feedback: Feedback;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 text-xs",
        feedback.tone === "error" && "text-destructive-text",
        feedback.tone === "warning" && "text-warning",
        feedback.tone === "success" && "text-success"
      )}
    >
      {feedback.tone === "success" ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      <span>
        {feedback.title && <strong className="block">{feedback.title}</strong>}
        {feedback.message}
      </span>
    </div>
  );
}
