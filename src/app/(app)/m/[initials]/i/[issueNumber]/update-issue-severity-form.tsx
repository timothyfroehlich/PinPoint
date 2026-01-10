"use client";

import type React from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
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
      <select
        name="severity"
        defaultValue={currentSeverity}
        aria-label="Update Issue Severity"
        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
        data-testid="issue-severity-select"
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
      <Button type="submit" size="sm" className="w-full" loading={isPending}>
        Update Severity
      </Button>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
