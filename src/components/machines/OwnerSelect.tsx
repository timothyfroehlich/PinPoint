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
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { UserStatus, UserRole } from "~/lib/types";
import { InviteUserDialog } from "~/components/users/InviteUserDialog";
import { Plus } from "lucide-react";
import { compareUnifiedUsers } from "~/lib/users/comparators";

/**
 * OwnerSelect — Single-select dropdown for assigning a machine owner.
 *
 * ## Pattern
 * Standard `<Select>` with an inline "Invite New" button that opens an
 * `<InviteUserDialog>`. After a user is invited, the new user is
 * optimistically added to the list and auto-selected via a pending
 * selection ref that fires once the `users` prop updates.
 *
 * ## Composition
 * - Users are sorted by `compareUnifiedUsers` (confirmed first, by machine
 *   count descending, then by last name)
 * - Default view: member+ active users only. "Show guests and invited users"
 *   checkbox reveals hidden groups. Typed search bypasses the filter.
 * - Sections: member+ active (no header), then "Invited" header + invited,
 *   then "Guests" header + guest users. Sections only shown when populated.
 * - Each option shows: name, machine count badge (if > 0), and role badges
 *   matching the existing `(INVITED)` pattern.
 * - `onUsersChange` callback allows the parent to update its user list
 *   without a server round-trip after an invite
 *
 * ## Key Abstractions
 * - `OwnerSelectUser` includes `role`, `machineCount`, and `status` for
 *   metadata display and filtering
 * - `pendingSelectionRef` handles the async flow: invite dialog closes ->
 *   parent updates users -> effect detects the new user and selects them
 * - `compareUnifiedUsers` from `~/lib/users/comparators` drives sort order
 * - The help text below the select explains the notification implication of
 *   owner assignment
 */
/** Minimal user shape for owner selection (CORE-SEC-006) */
export interface OwnerSelectUser {
  id: string;
  name: string;
  lastName: string;
  machineCount: number;
  status: UserStatus;
  role: UserRole;
}

interface OwnerSelectProps {
  users: OwnerSelectUser[];
  defaultValue?: string | null;
  disabled?: boolean;
  onUsersChange?: (users: OwnerSelectUser[]) => void;
  onValueChange?: (id: string) => void;
}

export function OwnerSelect({
  users,
  defaultValue,
  disabled,
  onUsersChange,
  onValueChange,
}: OwnerSelectProps): React.JSX.Element {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState("");

  // Ref to track pending user ID to select after users list updates
  const pendingSelectionRef = useRef<string | null>(null);

  // Effect to apply pending selection after users list is updated
  useEffect(() => {
    if (pendingSelectionRef.current) {
      const pendingId = pendingSelectionRef.current;
      // Check if the pending ID now exists in the users list
      if (users.some((u) => u.id === pendingId)) {
        setSelectedId(pendingId);
        onValueChange?.(pendingId);
        pendingSelectionRef.current = null;
      }
    }
  }, [users, onValueChange]);

  // Re-sort users after client-side mutations (e.g., inviting a new user)
  // to maintain consistent ordering: confirmed first, by machine count desc, then by last name
  const sortedUsers = useMemo(
    () => [...users].sort(compareUnifiedUsers),
    [users]
  );

  // Filter and section logic.
  // When query is empty and showHidden is false: only member+ active users.
  // When query has content: all users matching the search (filter bypassed).
  const { memberUsers, invitedUsers, guestUsers } = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const isSearching = normalizedQuery.length > 0;

    const visibleUsers = isSearching
      ? sortedUsers.filter((u) =>
          u.name.toLowerCase().includes(normalizedQuery)
        )
      : showHidden
        ? sortedUsers
        : sortedUsers.filter(
            // permissions-audit-allow: UI display filter, not a permission gate
            (u) => u.role !== "guest" && u.status !== "invited"
          );

    const memberGroup = visibleUsers.filter(
      // permissions-audit-allow: UI sectioning by role, not a permission gate
      (u) => u.status === "active" && u.role !== "guest"
    );
    const invitedGroup = visibleUsers.filter((u) => u.status === "invited");
    const guestGroup = visibleUsers.filter(
      // permissions-audit-allow: UI sectioning by role, not a permission gate
      (u) => u.status === "active" && u.role === "guest"
    );

    return {
      memberUsers: memberGroup,
      invitedUsers: invitedGroup,
      guestUsers: guestGroup,
    };
  }, [sortedUsers, query, showHidden]);

  const RoleBadge = ({
    user,
  }: {
    user: OwnerSelectUser;
  }): React.JSX.Element | null => {
    const isGuest = user.role === "guest"; // permissions-audit-allow: UI badge display, not a permission gate
    const isInvited = user.status === "invited";

    if (isGuest && isInvited) {
      return (
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          (INVITED · GUEST)
        </span>
      );
    }
    if (isInvited) {
      return (
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          (INVITED)
        </span>
      );
    }
    if (isGuest) {
      return (
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          (GUEST)
        </span>
      );
    }
    return null;
  };

  const UserItem = ({ user }: { user: OwnerSelectUser }): React.JSX.Element => (
    <SelectItem key={user.id} value={user.id}>
      <div className="flex items-center gap-2">
        <span>{user.name}</span>
        {user.machineCount > 0 && (
          <span className="text-[10px] text-muted-foreground/70">
            ({user.machineCount})
          </span>
        )}
        <RoleBadge user={user} />
      </div>
    </SelectItem>
  );

  const SectionHeader = ({ label }: { label: string }): React.JSX.Element => (
    <div className="px-2 py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="ownerId" className="text-foreground">
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

      {/* Search input */}
      <Input
        type="text"
        placeholder="Search users..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
        disabled={!!disabled}
        data-testid="owner-search-input"
      />

      {/* Show guests and invited users toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="owner-show-hidden"
          checked={showHidden}
          onCheckedChange={(checked) => setShowHidden(checked === true)}
          disabled={!!disabled}
          data-testid="owner-show-hidden-checkbox"
        />
        <label
          htmlFor="owner-show-hidden"
          className="text-xs text-muted-foreground cursor-pointer select-none"
        >
          Show guests and invited users
        </label>
      </div>

      <Select
        name="ownerId"
        value={selectedId}
        onValueChange={(value) => {
          setSelectedId(value);
          onValueChange?.(value);
        }}
        disabled={!!disabled}
      >
        <SelectTrigger
          id="ownerId"
          className="border-outline bg-surface text-foreground"
          aria-describedby="owner-help"
          data-testid="owner-select"
        >
          <SelectValue placeholder="Select an owner" />
        </SelectTrigger>
        <SelectContent>
          {/* Member+ active users (no section header — default group) */}
          {memberUsers.map((user) => (
            <UserItem key={user.id} user={user} />
          ))}

          {/* Invited section */}
          {invitedUsers.length > 0 && (
            <>
              <SectionHeader label="Invited" />
              {invitedUsers.map((user) => (
                <UserItem key={user.id} user={user} />
              ))}
            </>
          )}

          {/* Guests section */}
          {guestUsers.length > 0 && (
            <>
              <SectionHeader label="Guests" />
              {guestUsers.map((user) => (
                <UserItem key={user.id} user={user} />
              ))}
            </>
          )}

          {/* Empty state */}
          {memberUsers.length === 0 &&
            invitedUsers.length === 0 &&
            guestUsers.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No users found
              </div>
            )}
        </SelectContent>
      </Select>
      <p id="owner-help" className="text-xs text-muted-foreground">
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
