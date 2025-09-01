"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { addCommentAction } from "~/lib/actions/issue-actions";

interface CommentFormClientProps {
  issueId: string;
}

export function CommentFormClient({ issueId }: CommentFormClientProps) {
  const [state, formAction, isPending] = useActionState(
    addCommentAction.bind(null, issueId),
    null,
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-2">
              Add a comment
            </label>
            <Textarea
              id="content"
              name="content"
              placeholder="Share your thoughts, ask questions, or provide updates..."
              disabled={isPending}
              rows={4}
              key={state?.success ? Date.now() : "comment-form"} // Reset form on success
            />
          </div>

          {state && !state.success && (
            <p className="text-error text-sm">
              {state.error || "Failed to add comment"}
            </p>
          )}

          {state && state.success && (
            <p className="text-tertiary text-sm">
              ✅ Comment added successfully
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} size="sm">
              {isPending ? "Adding..." : "Add Comment"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
