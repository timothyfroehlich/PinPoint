"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { UnifiedUser } from "~/lib/types";
import { InviteUserDialog } from "~/components/users/InviteUserDialog";
import { Plus } from "lucide-react";
import { compareUnifiedUsers } from "~/lib/users/queries";

interface OwnerSelectProps {
  users: UnifiedUser[];
  defaultValue?: string | null;
  disabled?: boolean;
  onUsersChange?: (users: UnifiedUser[]) => void;
}

export function OwnerSelect({
  users,
  defaultValue,
  disabled,
  onUsersChange,
}: OwnerSelectProps): React.JSX.Element {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");

  // Ref to track pending user ID to select after users list updates
  const pendingSelectionRef = useRef<string | null>(null);

  // Effect to apply pending selection after users list is updated
  useEffect(() => {
    if (pendingSelectionRef.current) {
      const pendingId = pendingSelectionRef.current;
      // Check if the pending ID now exists in the users list
      if (users.some((u) => u.id === pendingId)) {
        setSelectedId(pendingId);
        pendingSelectionRef.current = null;
      }
    }
  }, [users]);

  // Re-sort users after client-side mutations (e.g., inviting a new user)
  // to maintain consistent ordering: confirmed first, by machine count desc, then by last name
  const sortedUsers = useMemo(
    () => [...users].sort(compareUnifiedUsers),
    [users]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="ownerId" className="text-on-surface">
          Machine Owner
        </Label>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-primary"
            onClick={() => setInviteDialogOpen(true)}
          >
            <Plus className="mr-1 size-3" />
            Invite New
          </Button>
        )}
      </div>
      <Select
        name="ownerId"
        value={selectedId}
        onValueChange={setSelectedId}
        disabled={!!disabled}
      >
        <SelectTrigger
          id="ownerId"
          className="border-outline bg-surface text-on-surface"
          aria-describedby="owner-help"
          data-testid="owner-select"
        >
          <SelectValue placeholder="Select an owner" />
        </SelectTrigger>
        <SelectContent>
          {sortedUsers.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <div className="flex items-center gap-2">
                <span>{user.name}</span>
                {user.machineCount > 0 && (
                  <span className="text-[10px] text-on-surface-variant/70">
                    ({user.machineCount})
                  </span>
                )}
                {user.status === "invited" && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                    (Invited)
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="owner-help" className="text-xs text-on-surface-variant">
        The owner receives notifications for new issues on this machine.
      </p>

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={(newUserId, newUser) => {
          // Store the pending selection - it will be applied after users list updates
          pendingSelectionRef.current = newUserId;
          // Add the new user to the list immediately (no server refresh needed)
          if (onUsersChange) {
            onUsersChange([...users, newUser]);
          }
        }}
      />
    </div>
  );
}
