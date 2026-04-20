"use client";

import React, { useState, useMemo } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import type { UserStatus } from "~/lib/types";
import { InviteUserDialog } from "~/components/users/InviteUserDialog";
import { compareUnifiedUsers } from "~/lib/users/comparators";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
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
 * - Each option shows: name, machine count badge (if > 0), and "(Invited)"
 *   tag for users with `status === "invited"`
 * - `onUsersChange` callback allows the parent to update its user list
 *   without a server round-trip after an invite
 *
 * ## Key Abstractions
 * - `OwnerSelectUser` includes `machineCount` and `status` for metadata display
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
  // Local extra users added via invite when parent doesn't provide onUsersChange
  const [extraUsers, setExtraUsers] = useState<OwnerSelectUser[]>([]);

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
                  {selectedUser.status === "invited" && (
                    <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      (Invited)
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
          <Command>
            <CommandInput placeholder="Search users..." />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup>
                {sortedUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.name}
                    onSelect={() => handleSelect(user.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{user.name}</span>
                      {user.machineCount > 0 && (
                        <span className="text-[10px] text-muted-foreground/70">
                          ({user.machineCount})
                        </span>
                      )}
                      {user.status === "invited" && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                          (Invited)
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
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
