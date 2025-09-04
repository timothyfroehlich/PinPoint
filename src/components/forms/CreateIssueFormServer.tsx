/**
 * Create Issue Form Server Component
 * Phase 3A: Server-first form with Server Actions integration
 * Replaces client-heavy form with server form + client enhancement islands
 */

"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ActionResult } from "~/lib/actions/shared";
import type { MachineForIssues } from "~/lib/types";

type Machine = MachineForIssues;
interface User {
  id: string;
  name: string | null;
  email: string;
}

interface CreateIssueFormServerProps {
  machines: Machine[];
  users?: User[];
  className?: string;
  action: (
    prevState: ActionResult<{ id: string }> | null,
    formData: FormData,
  ) => Promise<ActionResult<{ id: string }>>;
  initialMachineId?: string;
  /** Show the priority selection (internal authenticated usage) */
  showPriority?: boolean;
  /** Show the assignee selection (internal authenticated usage) */
  showAssignee?: boolean;
  /** Show severity selection (public + internal unified concept, distinct from priority) */
  showSeverity?: boolean;
  /** Show machine selector; disable for fixed machine context (/report/[machineId]) */
  showMachineSelect?: boolean;
  /** Whether to show reporter contact optional fields (public anonymous context) */
  showReporterFields?: boolean;
}

/**
 * Client component for issue creation form with Server Actions
 * Uses React 19 useActionState for enhanced form handling
 */
export function CreateIssueFormServer({
  machines,
  users = [],
  className,
  action,
  initialMachineId,
  showPriority = true,
  showAssignee = true,
  showSeverity = false,
  showMachineSelect = true,
  showReporterFields = false,
}: CreateIssueFormServerProps): JSX.Element {
  const [state, formAction, isPending] = useActionState(action, null);
  // Local state to ensure Radix Select values are included in HTML form submission
  const [machineId, setMachineId] = useState<string | undefined>(
    initialMachineId,
  );
  const [priority, setPriority] = useState<string>("medium");
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [severity, setSeverity] = useState<string>("medium");
  const router = useRouter();

  // Client-side redirect after successful creation
  useEffect(() => {
    if (state && state.success && state.data.id) {
      router.push(`/issues/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Card className={className} data-testid="create-issue-form-wrapper">
      <CardHeader>
        <CardTitle>Create New Issue</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Server Action form with useActionState */}
        <form
          action={formAction}
          className="space-y-6"
          data-testid="create-issue-form"
        >
          {/* Title field */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Issue Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="Enter issue title"
              required
              disabled={isPending}
              data-testid="issue-title-input"
            />
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the issue in detail"
              rows={4}
              disabled={isPending}
              data-testid="issue-description-input"
            />
          </div>

          {showMachineSelect ? (
            <div className="space-y-2">
              <Label htmlFor="machineId">
                Machine <span className="text-destructive">*</span>
              </Label>
              <Select
                required
                disabled={isPending}
                value={machineId ?? ""}
                onValueChange={(v) => {
                  setMachineId(v);
                }}
              >
                <SelectTrigger data-testid="machine-select-trigger">
                  <SelectValue
                    placeholder="Select a machine"
                    data-testid="machine-select-value"
                  />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((machine) => (
                    <SelectItem
                      key={machine.id}
                      value={machine.id}
                      data-testid="machine-option"
                      data-machine-id={machine.id}
                    >
                      {machine.name} ({machine.model.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Hidden input to ensure value is submitted */}
              <input
                type="hidden"
                name="machineId"
                value={machineId ?? ""}
                data-testid="machineId-hidden"
                required
              />
            </div>
          ) : (
            <>
              <input
                type="hidden"
                name="machineId"
                value={machineId ?? ""}
                data-testid="machineId-hidden"
                required
              />
            </>
          )}

          {showReporterFields && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reporterName">Your Name (optional)</Label>
                <Input
                  id="reporterName"
                  name="reporterName"
                  placeholder="Name or nickname"
                  disabled={isPending}
                  data-testid="reporter-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reporterEmail">Email (optional)</Label>
                <Input
                  id="reporterEmail"
                  name="reporterEmail"
                  type="email"
                  placeholder="you@example.com"
                  disabled={isPending}
                  data-testid="reporter-email-input"
                />
                <p className="text-xs text-muted-foreground">
                  We may contact you for clarification. We'll never share your
                  email.
                </p>
              </div>
            </div>
          )}

          {showSeverity && (
            <div className="space-y-2">
              <Label htmlFor="severity">
                Severity <span className="text-destructive">*</span>
              </Label>
              <Select
                disabled={isPending}
                data-testid="severity-select"
                value={severity}
                onValueChange={(v) => setSeverity(v)}
              >
                <SelectTrigger data-testid="severity-select-trigger">
                  <SelectValue
                    placeholder="Select severity"
                    data-testid="severity-select-value"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" data-testid="severity-option-low">
                    Low
                  </SelectItem>
                  <SelectItem
                    value="medium"
                    data-testid="severity-option-medium"
                  >
                    Medium
                  </SelectItem>
                  <SelectItem
                    value="high"
                    data-testid="severity-option-high"
                  >
                    High
                  </SelectItem>
                  <SelectItem
                    value="critical"
                    data-testid="severity-option-critical"
                  >
                    Critical
                  </SelectItem>
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="severity"
                value={severity}
                data-testid="severity-hidden"
              />
            </div>
          )}

          {showPriority && (
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                disabled={isPending}
                data-testid="priority-select"
                value={priority}
                onValueChange={(v) => {
                  setPriority(v);
                }}
              >
                <SelectTrigger data-testid="priority-select-trigger">
                  <SelectValue
                    placeholder="Select priority"
                    data-testid="priority-select-value"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" data-testid="priority-option-low">
                    Low
                  </SelectItem>
                  <SelectItem
                    value="medium"
                    data-testid="priority-option-medium"
                  >
                    Medium
                  </SelectItem>
                  <SelectItem value="high" data-testid="priority-option-high">
                    High
                  </SelectItem>
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="priority"
                value={priority}
                data-testid="priority-hidden"
              />
            </div>
          )}

          {/* Assignee selection (optional + gated) */}
          {showAssignee && users.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="assigneeId">Assignee</Label>
              <Select
                disabled={isPending}
                data-testid="assignee-select"
                value={assigneeId ?? ""}
                onValueChange={(v) => {
                  setAssigneeId(v);
                }}
              >
                <SelectTrigger data-testid="assignee-select-trigger">
                  <SelectValue
                    placeholder="Select assignee (optional)"
                    data-testid="assignee-select-value"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="unassigned"
                    data-testid="assignee-option-unassigned"
                  >
                    Unassigned
                  </SelectItem>
                  {users.map((user) => (
                    <SelectItem
                      key={user.id}
                      value={user.id}
                      data-testid="assignee-option"
                      data-assignee-id={user.id}
                    >
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="assigneeId"
                value={assigneeId ?? ""}
                data-testid="assigneeId-hidden"
              />
            </div>
          )}

          {/* Error/Success display */}
          {state && !state.success && (
            <div
              className="text-error text-sm"
              data-testid="create-issue-error"
            >
              {state.error || "Failed to create issue. Please try again."}
            </div>
          )}

          {state && !state.success && state.fieldErrors && (
            <ul
              className="text-error text-xs space-y-1 list-disc pl-5"
              data-testid="create-issue-field-errors"
            >
              {Object.entries(state.fieldErrors).map(([field, errors]) => (
                <li key={field} data-field={field}>
                  <strong>{field}:</strong> {errors[0]}
                </li>
              ))}
            </ul>
          )}

          {state && state.success && (
            <div
              className="text-tertiary text-sm"
              data-testid="create-issue-success"
            >
              ✅ Issue created successfully! Redirecting...
            </div>
          )}

          {/* Server Action submit button */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full"
            data-testid="create-issue-submit"
          >
            {isPending ? "Creating Issue..." : "Create Issue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
