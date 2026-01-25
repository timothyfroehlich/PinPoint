"use client";

import type React from "react";
import { useState, useActionState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueFrequencyAction,
  type UpdateIssueFrequencyResult,
} from "~/app/(app)/issues/actions";
import { FrequencySelect } from "~/components/issues/fields/FrequencySelect";
import { type IssueFrequency } from "~/lib/types";

interface UpdateIssueFrequencyFormProps {
  issueId: string;
  currentFrequency: IssueFrequency;
}

export function UpdateIssueFrequencyForm({
  issueId,
  currentFrequency,
}: UpdateIssueFrequencyFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedFrequency, setSelectedFrequency] =
    useState<IssueFrequency>(currentFrequency);
  const [pendingFrequency, setPendingFrequency] =
    useState<IssueFrequency | null>(null);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueFrequencyResult | undefined,
    FormData
  >(updateIssueFrequencyAction, undefined);

  // Auto-submit form when pending frequency changes
  useEffect(() => {
    if (pendingFrequency !== null && formRef.current) {
      formRef.current.requestSubmit();
      setPendingFrequency(null);
    }
  }, [pendingFrequency]);

  const handleValueChange = (newFrequency: IssueFrequency): void => {
    setSelectedFrequency(newFrequency);
    setPendingFrequency(newFrequency);
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2"
      data-form="update-frequency"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="frequency" value={selectedFrequency} />
      <div className="relative">
        <FrequencySelect
          value={selectedFrequency}
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
