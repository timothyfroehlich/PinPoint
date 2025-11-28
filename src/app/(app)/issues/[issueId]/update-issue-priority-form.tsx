"use client";

import type React from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import {
  updateIssuePriorityAction,
  type UpdateIssuePriorityResult,
} from "~/app/(app)/issues/actions";
import { type IssuePriority } from "~/lib/types";

interface UpdateIssuePriorityFormProps {
  issueId: string;
  currentPriority: IssuePriority;
}

const priorityOptions: IssuePriority[] = ["low", "medium", "high"];

export function UpdateIssuePriorityForm({
  issueId,
  currentPriority,
}: UpdateIssuePriorityFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<
    UpdateIssuePriorityResult | undefined,
    FormData
  >(updateIssuePriorityAction, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <select
        name="priority"
        defaultValue={currentPriority}
        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
        data-testid="issue-priority-select"
      >
        {priorityOptions.map((priority) => (
          <option
            key={priority}
            value={priority}
            data-testid={`priority-option-${priority}`}
          >
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="w-full">
        Update Priority
      </Button>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
