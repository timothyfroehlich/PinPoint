"use client";

import type React from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueSeverityAction,
  type UpdateIssueSeverityResult,
} from "~/app/(app)/issues/actions";
import { type IssueSeverity } from "~/lib/types";

interface UpdateIssueSeverityFormProps {
  issueId: string;
  currentSeverity: IssueSeverity;
}

const severityOptions: { value: IssueSeverity; label: string }[] = [
  { value: "cosmetic", label: "Cosmetic" },
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "unplayable", label: "Unplayable" },
];

export function UpdateIssueSeverityForm({
  issueId,
  currentSeverity,
}: UpdateIssueSeverityFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    UpdateIssueSeverityResult | undefined,
    FormData
  >(updateIssueSeverityAction, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <div className="relative">
        <select
          name="severity"
          defaultValue={currentSeverity}
          aria-label="Update Issue Severity"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 pr-10 text-sm text-on-surface disabled:opacity-50"
          data-testid="issue-severity-select"
          disabled={isPending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {severityOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              data-testid={`severity-option-${option.value}`}
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
