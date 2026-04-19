"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
 * optimistically added to the list and auto-selected.
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
 * - After an invite, `pendingSelectionRef` stores the new user's ID and
 *   `localExtraUsers` adds them to `sortedUsers` immediately. A `useEffect`
 *   applies `setSelectedId` once the user appears in `sortedUsers` — by then
 *   their `SelectItem` is registered in Radix's DocumentFragment collection
 *   and `SelectValue` can portal the text into the trigger correctly.
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

// Module-scope helper components — must NOT be defined inside OwnerSelect.
// Defining components inside a render function creates a new component type on
// every render, causing Radix UI to unmount/remount items and lose their refs,
// which triggers "Cannot read properties of undefined (reading 'ref')" crashes.

function RoleBadge({
  user,
}: {
  user: OwnerSelectUser;
}): React.JSX.Element | null {
  const isGuest = user.role === "guest"; // permissions-audit-allow: UI badge display, not a permission gate
  const isInvited = user.status === "invited";

  if (isGuest && isInvited) {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        (Invited · Guest)
      </span>
    );
  }
  if (isInvited) {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        (Invited)
      </span>
    );
  }
  if (isGuest) {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        (Guest)
      </span>
    );
  }
  return null;
}

function UserItem({ user }: { user: OwnerSelectUser }): React.JSX.Element {
  return (
    <SelectItem value={user.id}>
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

  // Users added via the inline invite flow are tracked locally so they are
  // immediately available in sortedUsers (and thus the SelectContent's
  // DocumentFragment) before the parent re-renders with the updated users prop.
  // This ensures the invited user's SelectItem is registered in Radix's item
  // collection so SelectValue can portal the text into the trigger.
  const [localExtraUsers, setLocalExtraUsers] = useState<OwnerSelectUser[]>([]);

  // Ref to track pending user ID to select after users list updates.
  // Using a ref (not state) here is intentional: it survives re-renders that
  // happen before the users prop is updated, without triggering extra renders.
  const pendingSelectionRef = useRef<string | null>(null);

  // Re-sort users after client-side mutations (e.g., inviting a new user)
  // to maintain consistent ordering: confirmed first, by machine count desc, then by last name
  const sortedUsers = useMemo(
    () => [...users, ...localExtraUsers].sort(compareUnifiedUsers),
    [users, localExtraUsers]
  );

  // Apply the pending selection once the invited user appears in sortedUsers.
  // This effect fires after the render where localExtraUsers is updated (adding
  // the new user) OR after the parent re-renders with the updated users prop.
  // At that point, Radix's SelectItem for the new user is mounted in the
  // DocumentFragment and its ItemText is portaled into the SelectValue node.
  useEffect(() => {
    if (pendingSelectionRef.current) {
      const pendingId = pendingSelectionRef.current;
      if (sortedUsers.some((u) => u.id === pendingId)) {
        setSelectedId(pendingId);
        onValueChange?.(pendingId);
        pendingSelectionRef.current = null;
      }
    }
  }, [sortedUsers, onValueChange]);

  // Filter and section logic.
  // When query is empty and showHidden is false: only member+ active users.
  // When query has content: all users matching the search (filter bypassed).
  // The currently selected user is always included regardless of filter so
  // Radix Select can display the trigger value correctly.
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
            (u) =>
              u.id === selectedId ||
              // permissions-audit-allow: UI display filter, not a permission gate
              (u.role !== "guest" && u.status !== "invited")
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
  }, [sortedUsers, query, showHidden, selectedId]);

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
          <SelectGroup>
            {memberUsers.map((user) => (
              <UserItem key={user.id} user={user} />
            ))}
          </SelectGroup>

          {/* Invited section */}
          {invitedUsers.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Invited
                </SelectLabel>
                {invitedUsers.map((user) => (
                  <UserItem key={user.id} user={user} />
                ))}
              </SelectGroup>
            </>
          )}

          {/* Guests section */}
          {guestUsers.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Guests
                </SelectLabel>
                {guestUsers.map((user) => (
                  <UserItem key={user.id} user={user} />
                ))}
              </SelectGroup>
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
          // Store the pending selection ID in a ref (survives re-renders
          // triggered by Next.js router cache updates after the server action).
          // The useEffect above applies the selection once sortedUsers includes
          // the new user — at which point Radix's SelectItem is mounted in the
          // DocumentFragment and SelectValue can display the correct name.
          pendingSelectionRef.current = newUserId;
          // Add the new user to localExtraUsers immediately — this makes them
          // available in sortedUsers (and thus the closed SelectContent's
          // DocumentFragment) in the NEXT render, without waiting for the
          // parent to re-render with an updated users prop.
          setLocalExtraUsers((prev) => [...prev, newUser]);
          // Show hidden groups so the invited user appears in the content.
          setShowHidden(true);
          // Also notify parent so it can persist the updated user list
          // (e.g. for form submission or other UI concerns).
          if (onUsersChange) {
            onUsersChange([...users, newUser]);
          }
        }}
      />
    </div>
  );
}
