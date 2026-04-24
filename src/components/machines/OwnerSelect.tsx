"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import type { UserStatus } from "~/lib/types";
import { InviteUserDialog } from "~/components/users/InviteUserDialog";
import { compareUnifiedUsers } from "~/lib/users/comparators";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

/**
 * OwnerSelect — Single-select dropdown for assigning a machine owner.
 *
 * ## Pattern
 * Popover + Command (cmdk) dropdown with built-in search. An "Invite New"
 * button opens an `<InviteUserDialog>`; on invite-success the new user is
 * immediately added to the list and selected.
 *
 * ## Composition
 * - Users are sorted by `compareUnifiedUsers` (confirmed first, by machine
 *   count descending, then by last name)
 * - Default state hides guests and invited users; a checkbox reveals them.
 * - Typed search bypasses the hide-guests filter and shows all matches.
 * - Each option shows: name, machine count badge (if > 0), and role tags
 *   ("(GUEST)", "(INVITED)", or "(INVITED · GUEST)") for non-member users
 * - `onUsersChange` callback allows the parent to update its user list
 *   without a server round-trip after an invite
 *
 * ## Key Abstractions
 * - `OwnerSelectUser` includes `role`, `machineCount` and `status` for metadata display
 * - A hidden `<input type="hidden">` preserves native form submission compat
 * - `compareUnifiedUsers` from `~/lib/users/comparators` drives sort order
 */

/** Minimal user shape for owner selection (CORE-SEC-006) */
export interface OwnerSelectUser {
  id: string;
  name: string;
  lastName: string;
  machineCount: number;
  status: UserStatus;
  role: "guest" | "member" | "technician" | "admin";
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
  const [open, setOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState("");
  // Local extra users added via invite when parent doesn't provide onUsersChange
  const [extraUsers, setExtraUsers] = useState<OwnerSelectUser[]>([]);

  // Reset search when popover closes
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  // Merged user list: prop users + locally-tracked invited users (deduped)
  const allUsers = useMemo(() => {
    if (extraUsers.length === 0) return users;
    const knownIds = new Set(users.map((u) => u.id));
    return [...users, ...extraUsers.filter((u) => !knownIds.has(u.id))];
  }, [users, extraUsers]);

  const sortedUsers = useMemo(
    () => [...allUsers].sort(compareUnifiedUsers),
    [allUsers]
  );

  const selectedUser = useMemo(
    () => allUsers.find((u) => u.id === selectedId) ?? null,
    [allUsers, selectedId]
  );

  /**
   * Filter and partition users into three groups:
   * 1. Member+ active users (no section header)
   * 2. Invited users (header "Invited")
   * 3. Guest users (header "Guests")
   *
   * When query is non-empty, all matches are shown regardless of showHidden.
   * When query is empty and !showHidden, guests and invited users are hidden.
   */
  const { memberUsers, invitedUsers, guestUsers } = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const hasQuery = normalized.length > 0;

    const matchesQuery = (u: OwnerSelectUser): boolean =>
      u.name.toLowerCase().includes(normalized);

    const isGuest = (u: OwnerSelectUser): boolean => u.role === "guest"; // permissions-audit-allow: UI display filter, not a permission gate
    const isInvited = (u: OwnerSelectUser): boolean =>
      u.status === "invited" && !isGuest(u);
    const isMemberPlus = (u: OwnerSelectUser): boolean =>
      !isGuest(u) && !isInvited(u);

    if (hasQuery) {
      // Search bypasses the filter — show all matching users across categories
      return {
        memberUsers: sortedUsers.filter(
          (u) => isMemberPlus(u) && matchesQuery(u)
        ),
        invitedUsers: sortedUsers.filter(
          (u) => isInvited(u) && matchesQuery(u)
        ),
        guestUsers: sortedUsers.filter((u) => isGuest(u) && matchesQuery(u)),
      };
    }

    if (showHidden) {
      // Show all users, partitioned into groups
      return {
        memberUsers: sortedUsers.filter(isMemberPlus),
        invitedUsers: sortedUsers.filter(isInvited),
        guestUsers: sortedUsers.filter(isGuest),
      };
    }

    // Default: only show member+ active users
    return {
      memberUsers: sortedUsers.filter(isMemberPlus),
      invitedUsers: [],
      guestUsers: [],
    };
  }, [sortedUsers, query, showHidden]);

  const handleSelect = (userId: string): void => {
    setSelectedId(userId);
    onValueChange?.(userId);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Hidden input for native form submission — server actions read formData.get("ownerId") */}
      <input type="hidden" name="ownerId" value={selectedId} />

      <div className="flex items-center justify-between">
        <Label htmlFor="owner-trigger" className="text-foreground">
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id="owner-trigger"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-describedby="owner-help"
            disabled={!!disabled}
            data-testid="owner-select"
            className="w-full justify-between border-outline bg-surface text-foreground font-normal"
          >
            <span
              className={
                selectedUser ? "text-foreground" : "text-muted-foreground"
              }
            >
              {selectedUser ? (
                <>
                  {selectedUser.name}
                  {selectedUser.role !== "guest" &&
                    selectedUser.status === "invited" && ( // permissions-audit-allow: UI badge display, not a permission gate
                      <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        (Invited)
                      </span>
                    )}
                  {selectedUser.role === "guest" &&
                    selectedUser.status !== "invited" && ( // permissions-audit-allow: UI badge display, not a permission gate
                      <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        (GUEST)
                      </span>
                    )}
                  {selectedUser.role === "guest" &&
                    selectedUser.status === "invited" && ( // permissions-audit-allow: UI badge display, not a permission gate
                      <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        (INVITED · GUEST)
                      </span>
                    )}
                </>
              ) : (
                "Select an owner"
              )}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          {/*
           * shouldFilter={false}: we manage filtering manually so guests/invited
           * are only shown when toggle is on or query is active.
           */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search users..."
              value={query}
              onValueChange={setQuery}
            />
            {/* Checkbox to reveal guests and invited users */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Checkbox
                id="show-hidden-users"
                checked={showHidden}
                onCheckedChange={(checked) => {
                  setShowHidden(checked === true);
                }}
              />
              <label
                htmlFor="show-hidden-users"
                className="cursor-pointer text-xs text-muted-foreground select-none"
              >
                Show guests and invited users
              </label>
            </div>
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>

              {/* Section 1: Member+ active users (no header) */}
              {memberUsers.length > 0 && (
                <CommandGroup>
                  {memberUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => handleSelect(user.id)}
                      aria-current={user.id === selectedId ? "true" : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <span>{user.name}</span>
                        {user.machineCount > 0 && (
                          <span className="text-[10px] text-muted-foreground/70">
                            ({user.machineCount})
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Section 2: Invited (non-guest) users */}
              {invitedUsers.length > 0 && (
                <>
                  {memberUsers.length > 0 && <CommandSeparator />}
                  <CommandGroup heading="Invited">
                    {invitedUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => handleSelect(user.id)}
                        aria-current={
                          user.id === selectedId ? "true" : undefined
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span>{user.name}</span>
                          {user.machineCount > 0 && (
                            <span className="text-[10px] text-muted-foreground/70">
                              ({user.machineCount})
                            </span>
                          )}
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            (INVITED)
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Section 3: Guest users */}
              {guestUsers.length > 0 && (
                <>
                  {(memberUsers.length > 0 || invitedUsers.length > 0) && (
                    <CommandSeparator />
                  )}
                  <CommandGroup heading="Guests">
                    {guestUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => handleSelect(user.id)}
                        aria-current={
                          user.id === selectedId ? "true" : undefined
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span>{user.name}</span>
                          {user.machineCount > 0 && (
                            <span className="text-[10px] text-muted-foreground/70">
                              ({user.machineCount})
                            </span>
                          )}
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {user.status === "invited"
                              ? "(INVITED · GUEST)"
                              : "(GUEST)"}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="invite-new"
                  onSelect={() => {
                    setOpen(false);
                    setInviteDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 size-4" />
                  Invite new user
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p id="owner-help" className="text-xs text-muted-foreground">
        The owner receives notifications for new issues on this machine.
      </p>

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={(newUserId, newUser) => {
          // Propagate to parent if callback provided; otherwise track locally so
          // the new user appears in the list and can be re-selected.
          if (onUsersChange) {
            onUsersChange([...users, newUser]);
          } else {
            setExtraUsers((prev) => [...prev, newUser]);
          }
          setSelectedId(newUserId);
          onValueChange?.(newUserId);
        }}
      />
    </div>
  );
}
