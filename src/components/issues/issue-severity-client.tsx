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
import { updateIssueSeverityAction } from "~/lib/actions/issue-actions";

interface IssueSeverityClientProps {
  issueId: string;
  currentSeverity: "low" | "medium" | "high" | "critical";
}

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low", description: "Minor issue, low impact" },
  { value: "medium", label: "Medium", description: "Moderate impact" },
  { value: "high", label: "High", description: "Significant impact" },
  {
    value: "critical",
    label: "Critical",
    description: "Severe impact, urgent",
  },
] as const;

export function IssueSeverityClient({
  issueId,
  currentSeverity,
}: IssueSeverityClientProps): JSX.Element {
  const [state, formAction, isPending] = useActionState(
    updateIssueSeverityAction.bind(null, issueId),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Select
        name="severity"
        defaultValue={currentSeverity}
        disabled={isPending}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select severity" />
        </SelectTrigger>
        <SelectContent>
          {SEVERITY_OPTIONS.map((severity) => (
            <SelectItem key={severity.value} value={severity.value}>
              <div className="flex flex-col">
                <span className="font-medium">{severity.label}</span>
                <span className="text-xs text-muted-foreground">
                  {severity.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {state && !state.success && (
        <p className="text-error text-sm">{state.error}</p>
      )}

      {state && state.success && (
        <p className="text-tertiary text-sm">✅ Severity updated successfully</p>
      )}

      <Button type="submit" disabled={isPending} size="sm" className="w-full">
        {isPending ? "Updating..." : "Update Severity"}
      </Button>
    </form>
  );
}
