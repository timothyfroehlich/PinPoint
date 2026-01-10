"use client";

import type React from "react";
import { useState, useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  updateIssueConsistencyAction,
  type UpdateIssueConsistencyResult,
} from "~/app/(app)/issues/actions";
import { ConsistencySelect } from "~/components/issues/fields/ConsistencySelect";
import { type IssueConsistency } from "~/lib/types";

interface UpdateIssueConsistencyFormProps {
  issueId: string;
  currentConsistency: IssueConsistency;
}

export function UpdateIssueConsistencyForm({
  issueId,
  currentConsistency,
}: UpdateIssueConsistencyFormProps): React.JSX.Element {
  const [selectedConsistency, setSelectedConsistency] =
    useState<IssueConsistency>(currentConsistency);
  const [state, formAction, isPending] = useActionState<
    UpdateIssueConsistencyResult | undefined,
    FormData
  >(updateIssueConsistencyAction, undefined);

  const handleValueChange = (newConsistency: IssueConsistency): void => {
    setSelectedConsistency(newConsistency);
    // Auto-submit form on value change
    const form = document.querySelector('form[data-form="update-consistency"]');
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  };

  return (
    <form
      action={formAction}
      className="space-y-2"
      data-form="update-consistency"
    >
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="consistency" value={selectedConsistency} />
      <div className="relative">
        <ConsistencySelect
          value={selectedConsistency}
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
