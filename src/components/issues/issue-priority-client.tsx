"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { updateIssuePriorityAction } from "~/lib/actions/issue-actions";

interface IssuePriorityClientProps {
  issueId: string;
  currentPriorityId: string;
  currentPriorityName: string;
  availablePriorities: {
    id: string;
    name: string;
    order: number;
  }[];
}

export function IssuePriorityClient({
  issueId,
  currentPriorityId,
  currentPriorityName,
  availablePriorities,
}: IssuePriorityClientProps): JSX.Element {
  const [state, formAction, isPending] = useActionState(
    updateIssuePriorityAction.bind(null, issueId),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Select
        name="priorityId"
        defaultValue={currentPriorityId}
        disabled={isPending}
      >
        <SelectTrigger>
          <SelectValue placeholder={currentPriorityName} />
        </SelectTrigger>
        <SelectContent>
          {availablePriorities.map((priority) => (
            <SelectItem key={priority.id} value={priority.id}>
              {priority.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {state && !state.success && (
        <p className="text-error text-sm">{state.error}</p>
      )}

      {state && state.success && (
        <p className="text-tertiary text-sm">✅ Priority updated successfully</p>
      )}

      <Button type="submit" disabled={isPending} size="sm" className="w-full">
        {isPending ? "Updating..." : "Update Priority"}
      </Button>
    </form>
  );
}
