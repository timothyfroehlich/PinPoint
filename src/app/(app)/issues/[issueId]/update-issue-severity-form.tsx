"use client";

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
  { value: "minor", label: "Minor" },
  { value: "playable", label: "Playable" },
  { value: "unplayable", label: "Unplayable" },
];

export function UpdateIssueSeverityForm({
  issueId,
  currentSeverity,
}: UpdateIssueSeverityFormProps): React.JSX.Element {
  const [state, formAction] = useActionState<
    UpdateIssueSeverityResult,
    FormData
  >(updateIssueSeverityAction, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <select
        name="severity"
        defaultValue={currentSeverity}
        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
      >
        {severityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="w-full">
        Update Severity
      </Button>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
