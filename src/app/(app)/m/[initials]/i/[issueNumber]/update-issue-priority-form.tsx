"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssuePriorityAction,
  type UpdateIssuePriorityResult,
} from "~/app/(app)/issues/actions";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { type IssuePriority } from "~/lib/types";

interface UpdateIssuePriorityFormProps {
  issueId: string;
  currentPriority: IssuePriority;
}

/**
 * Form component for updating issue priority with progressive enhancement.
 * Uses useActionState for form submission with client-side validation.
 */
export function UpdateIssuePriorityForm({
  issueId,
  currentPriority,
}: UpdateIssuePriorityFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPriority, setSelectedPriority] =
    useState<IssuePriority>(currentPriority);
  const [pendingPriority, setPendingPriority] = useState<IssuePriority | null>(
    null
  );
  const [state, formAction, isPending] = useActionState<
    UpdateIssuePriorityResult | undefined,
    FormData
  >(updateIssuePriorityAction, undefined);

  // Auto-submit form when pending priority changes
  useEffect(() => {
    if (pendingPriority !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingPriority(null);
    }
  }, [pendingPriority]);

  const handleValueChange = (newPriority: IssuePriority): void => {
    setSelectedPriority(newPriority);
    setPendingPriority(newPriority);
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-priority"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="priority" value={selectedPriority} />
      <div className="relative">
        <PrioritySelect
          value={selectedPriority}
          onValueChange={handleValueChange}
          disabled={isPending}
        />
        {isPending && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
