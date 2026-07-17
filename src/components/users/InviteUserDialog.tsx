"use client";

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { OwnerSelectUser } from "~/components/machines/OwnerSelect";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  inviteUser,
  type InviteUserResult,
} from "~/app/(app)/admin/users/actions";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (userId: string, user: OwnerSelectUser) => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation to a new user.
          </DialogDescription>
        </DialogHeader>

        {/*
         * The form (and its `useActionState`) lives in a child that mounts with
         * the dialog content, so every open starts from a clean state instead of
         * showing the previous attempt's error.
         */}
        <InviteUserForm
          onOpenChange={onOpenChange}
          {...(onSuccess ? { onSuccess } : {})}
        />
      </DialogContent>
    </Dialog>
  );
}

function InviteUserForm({
  onOpenChange,
  onSuccess,
}: {
  onOpenChange: (open: boolean) => void;
  onSuccess?: (userId: string, user: OwnerSelectUser) => void;
}): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    InviteUserResult | undefined,
    FormData
  >(inviteUser, undefined);

  // Run success side effects once per resolved state (mirrors the create-machine
  // form's handled-state guard so we don't re-fire on unrelated re-renders).
  const handledStateRef = useRef<typeof state>(undefined);
  useEffect(() => {
    if (!state || state === handledStateRef.current || !state.ok) {
      return;
    }
    handledStateRef.current = state;

    toast.success("User invited successfully");

    // Build a minimal display row for the caller (CORE-SEC-006). Invited users
    // are always created with the member role.
    const newUser: OwnerSelectUser = {
      id: state.value.userId,
      name: `${state.value.firstName} ${state.value.lastName}`,
      lastName: state.value.lastName,
      status: "invited",
      machineCount: 0,
      role: "member",
    };
    onSuccess?.(state.value.userId, newUser);
    onOpenChange(false);
  }, [state, onSuccess, onOpenChange]);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {/* Invited users are always created as members; role isn't user-editable. */}
      <input type="hidden" name="role" value="member" />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invite-firstName">
            First Name{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </Label>
          <Input
            id="invite-firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            enterKeyHint="next"
            maxLength={50}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-lastName">
            Last Name{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </Label>
          <Input
            id="invite-lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            enterKeyHint="next"
            maxLength={50}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-email">
          Email{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          enterKeyHint="send"
        />
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
        <div className="space-y-0.5">
          <Label htmlFor="invite-sendInvite">Send Invitation Email</Label>
          <p className="text-sm text-muted-foreground">
            User will receive an email to join.
          </p>
        </div>
        {/* Native checkbox (value "true") so the form submits without JS and the
            server reads `sendInvite === "true"`. */}
        <input
          id="invite-sendInvite"
          name="sendInvite"
          type="checkbox"
          value="true"
          defaultChecked
          className="size-4 accent-primary"
        />
      </div>

      <DialogFooter className="pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {isPending ? "Inviting..." : "Invite User"}
        </Button>
      </DialogFooter>
    </form>
  );
}
