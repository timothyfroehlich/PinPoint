"use client";

import type React from "react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  addCommentAction,
  type AddCommentResult,
} from "~/app/(app)/issues/actions";

interface AddCommentFormProps {
  issueId: string;
}

export function AddCommentForm({
  issueId,
}: AddCommentFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<
    AddCommentResult | undefined,
    FormData
  >(addCommentAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <input type="hidden" name="issueId" value={issueId} />
      <Textarea
        name="comment"
        placeholder="Leave a comment..."
        required
        className="border-outline-variant bg-surface text-on-surface"
      />
      <Button type="submit" size="sm">
        Add Comment
      </Button>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
