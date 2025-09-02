/**
 * Invite User Dialog Client Island
 * Phase 4B.2: User invitation functionality with Server Actions
 */

"use client";

import { useState, useActionState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { UserPlusIcon, LoaderIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { inviteUserAction } from "~/lib/actions/admin-actions";

interface InviteUserDialogProps {
  children?: React.ReactNode;
  availableRoles?: { id: string; name: string; description?: string }[];
}

export function InviteUserDialog({
  children,
  availableRoles = [],
}: InviteUserDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(inviteUserAction, null);

  // Handle successful invitation
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "User invitation sent successfully!");
      setIsOpen(false);
    } else if (state) {
      // Handle field errors or general error
      if (state.fieldErrors) {
        // Display field-specific errors
        Object.entries(state.fieldErrors).forEach(([field, errors]) => {
          if (Array.isArray(errors)) {
            errors.forEach((error) => toast.error(`${field}: ${error}`));
          }
        });
      } else if (state.error) {
        toast.error(state.error);
      }
    }
  }, [state]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button>
            <UserPlusIcon className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They'll receive an
            email with setup instructions.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="user@example.com"
              required
              disabled={isPending}
            />
            {state && !state.success && state.fieldErrors?.["email"] && (
              <p className="text-xs text-destructive">
                {state.fieldErrors["email"][0]}
              </p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Optional. They can set this up later during onboarding.
            </p>
            {state && !state.success && state.fieldErrors?.["name"] && (
              <p className="text-xs text-destructive">
                {state.fieldErrors["name"][0]}
              </p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="roleId">Role</Label>
            <Select name="roleId" disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role (optional - will use default)" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                    {role.description && (
                      <span className="text-muted-foreground ml-2">
                        - {role.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optional. If not selected, the default role will be assigned.
            </p>
            {state && !state.success && state.fieldErrors?.["roleId"] && (
              <p className="text-xs text-destructive">
                {state.fieldErrors["roleId"][0]}
              </p>
            )}
          </div>

          {/* Personal Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Welcome to our team! We're excited to have you join us."
              rows={3}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              This message will be included in the invitation email.
            </p>
            {state && !state.success && state.fieldErrors?.["message"] && (
              <p className="text-xs text-destructive">
                {state.fieldErrors["message"][0]}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MailIcon className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
