"use client";

import type React from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
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
      <div className="relative">
        <select
          name="consistency"
          defaultValue={currentConsistency}
          aria-label="Update Issue Consistency"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 pr-10 text-sm text-on-surface disabled:opacity-50"
          data-testid="issue-consistency-select"
          disabled={isPending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
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
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
