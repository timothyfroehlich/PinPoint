"use client";

import type React from "react";
import { useState, useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueSeverityAction,
  type UpdateIssueSeverityResult,
} from "~/app/(app)/issues/actions";
import { SeveritySelect } from "~/components/issues/fields/SeveritySelect";
import { type IssueSeverity } from "~/lib/types";

interface UpdateIssueSeverityFormProps {
  issueId: string;
  currentSeverity: IssueSeverity;
}

export function UpdateIssueSeverityForm({
  issueId,
  currentSeverity,
}: UpdateIssueSeverityFormProps): React.JSX.Element {
  const [selectedSeverity, setSelectedSeverity] =
    useState<IssueSeverity>(currentSeverity);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueSeverityResult | undefined,
    FormData
  >(updateIssueSeverityAction, undefined);

  const handleValueChange = (newSeverity: IssueSeverity): void => {
    setSelectedSeverity(newSeverity);
    // Auto-submit form on value change
    const form = document.querySelector('form[data-form="update-severity"]');
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  };

  return (
    <form action={formAction} className="space-y-2" data-form="update-severity">
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="severity" value={selectedSeverity} />
      <div className="relative">
        <SeveritySelect
          value={selectedSeverity}
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
