"use client";

import type { JSX } from "react";
import { useActionState } from "react"; // React 19 correct import
import { useFormStatus } from "react-dom";
import { createIssueAction } from "~/lib/actions/issue-actions";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

interface Machine {
  id: string;
  name: string;
  model?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateIssueFormProps {
  machines: Machine[];
  users?: User[];
  className?: string;
}

function SubmitButton({ isPending }: { isPending: boolean }): JSX.Element {
  const { pending: formPending } = useFormStatus();
  const isSubmitting = isPending || formPending;
  
  return (
    <Button type="submit" disabled={isSubmitting} className="w-full">
      {isSubmitting ? "Creating Issue..." : "Create Issue"}
    </Button>
  );
}

export function CreateIssueForm({ machines, users = [], className }: CreateIssueFormProps): JSX.Element {
  // React 19 useActionState for enhanced form handling
  const [state, formAction, isPending] = useActionState(createIssueAction, null);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create New Issue</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {/* Error display */}
          {state && !state.success && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {state && state.success && state.message && (
            <Alert>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

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
              aria-invalid={state && !state.success && state.fieldErrors?.['title'] ? 'true' : 'false'}
            />
            {state && !state.success && state.fieldErrors?.['title'] && (
              <p className="text-sm text-destructive">{state.fieldErrors['title'][0]}</p>
            )}
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the issue in detail"
              rows={4}
            />
            {state && !state.success && state.fieldErrors?.['description'] && (
              <p className="text-sm text-destructive">{state.fieldErrors['description'][0]}</p>
            )}
          </div>

          {/* Machine selection */}
          <div className="space-y-2">
            <Label htmlFor="machineId">
              Machine <span className="text-destructive">*</span>
            </Label>
            <Select name="machineId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select a machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name} {machine.model && `(${machine.model})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state && !state.success && state.fieldErrors?.['machineId'] && (
              <p className="text-sm text-destructive">{state.fieldErrors['machineId'][0]}</p>
            )}
          </div>

          {/* Priority selection */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            {state && !state.success && state.fieldErrors?.['priority'] && (
              <p className="text-sm text-destructive">{state.fieldErrors['priority'][0]}</p>
            )}
          </div>

          {/* Assignee selection (optional) */}
          {users.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="assigneeId">Assignee</Label>
              <Select name="assigneeId">
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
              {state && !state.success && state.fieldErrors?.['assigneeId'] && (
                <p className="text-sm text-destructive">{state.fieldErrors['assigneeId'][0]}</p>
              )}
            </div>
          )}

          {/* Submit button */}
          <SubmitButton isPending={isPending} />
        </form>
      </CardContent>
    </Card>
  );
}