/**
 * Create Issue Form Server Component
 * Phase 3A: Server-first form with Server Actions integration
 * Replaces client-heavy form with server form + client enhancement islands
 */

"use client";

import { useActionState } from "react";
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
type User = {
  id: string;
  name: string | null;
  email: string;
};

interface CreateIssueFormServerProps {
  machines: Machine[];
  users?: User[];
  className?: string;
  action: (
    prevState: ActionResult<{ id: string }> | null,
    formData: FormData,
  ) => Promise<ActionResult<{ id: string }>>;
  initialMachineId?: string;
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
}: CreateIssueFormServerProps) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create New Issue</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Server Action form with useActionState */}
        <form action={formAction} className="space-y-6">
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
            />
          </div>

          {/* Machine selection */}
          <div className="space-y-2">
            <Label htmlFor="machineId">
              Machine <span className="text-destructive">*</span>
            </Label>
            <Select
              name="machineId"
              required
              defaultValue={initialMachineId ?? ""}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name} ({machine.model.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority selection */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select name="priority" defaultValue="medium" disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignee selection (optional) */}
          {users.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="assigneeId">Assignee</Label>
              <Select name="assigneeId" disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Error/Success display */}
          {state && !state.success && (
            <div className="text-error text-sm">
              {state.error || "Failed to create issue. Please try again."}
            </div>
          )}

          {state && state.success && (
            <div className="text-tertiary text-sm">
              ✅ Issue created successfully!
            </div>
          )}

          {/* Server Action submit button */}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating Issue..." : "Create Issue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
