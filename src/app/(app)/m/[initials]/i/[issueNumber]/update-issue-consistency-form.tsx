"use client";

import type React from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import {
  updateIssueConsistencyAction,
  type UpdateIssueConsistencyResult,
} from "~/app/(app)/issues/actions";
import { type IssueConsistency } from "~/lib/types";

interface UpdateIssueConsistencyFormProps {
  issueId: string;
  currentConsistency: IssueConsistency;
}

const consistencyOptions: { value: IssueConsistency; label: string }[] = [
  { value: "intermittent", label: "Intermittent" },
  { value: "frequent", label: "Frequent" },
  { value: "constant", label: "Constant" },
];

export function UpdateIssueConsistencyForm({
  issueId,
  currentConsistency,
}: UpdateIssueConsistencyFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateIssueConsistencyResult | undefined,
    FormData
  >(updateIssueConsistencyAction, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <select
        name="consistency"
        defaultValue={currentConsistency}
        aria-label="Update Issue Consistency"
        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
        data-testid="issue-consistency-select"
      >
        {consistencyOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            data-testid={`consistency-option-${option.value}`}
          >
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="w-full" disabled={isPending}>
        {isPending ? "Updating..." : "Update Consistency"}
      </Button>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
