import React from "react";
import { Textarea } from "~/components/ui/textarea";
import { addCommentAction } from "~/app/(app)/issues/actions";
import { AddCommentSubmitButton } from "~/components/issues/AddCommentSubmitButton";

interface AddCommentFormProps {
  issueId: string;
}

export function AddCommentForm({
  issueId,
}: AddCommentFormProps): React.JSX.Element {
  return (
    <form action={addCommentAction} className="space-y-3">
      <input type="hidden" name="issueId" value={issueId} />
      <Textarea
        name="comment"
        placeholder="Leave a comment..."
        required
        minLength={1}
        className="min-h-24"
      />
      <div className="flex justify-end">
        <AddCommentSubmitButton />
      </div>
    </form>
  );
}
