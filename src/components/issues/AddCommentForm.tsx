import React from "react";
import { Input } from "~/components/ui/input";
import { addCommentAction } from "~/app/(app)/issues/actions";
import { AddCommentSubmitButton } from "~/components/issues/AddCommentSubmitButton";

interface AddCommentFormProps {
  issueId: string;
}

export function AddCommentForm({
  issueId,
}: AddCommentFormProps): React.JSX.Element {
  return (
    <form action={addCommentAction} className="flex gap-2">
      <input type="hidden" name="issueId" value={issueId} />
      <AddCommentSubmitButton />
      <Input
        name="comment"
        placeholder="Add comment..."
        required
        minLength={1}
        className="flex-1"
      />
    </form>
  );
}
