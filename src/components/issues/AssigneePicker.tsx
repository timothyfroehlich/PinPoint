"use client";

import React from "react";
import { User } from "lucide-react";
import { FieldRowButton } from "~/components/issues/fields/IssueFieldRow";
import {
  Command,
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
 * AssigneePicker — Dropdown for assigning a user to an issue.
 *
 * ## Pattern
 * Popover + Command (cmdk) with manual search filtering. We use `Command` +
 * `CommandInput` + `CommandList` + `CommandItem` for full cmdk keyboard navigation.
 * `shouldFilter={false}` lets us filter manually so "Me" and "Unassigned" stay
 * visible regardless of query. Radix Popover handles click-outside and focus management.
 *
 * ## Composition
 * - Trigger row shows the selected user's initial + name, or "Unassigned"
 * - CommandInput provides the search field; items are filtered manually so that
 *   "Me" and "Unassigned" are always visible regardless of query
 * - Alphabetical user list also includes the current user (under their real name),
 *   so searching by name finds them even though they already appear as "Me"
 * - `onAssign(userId | null)` fires on selection; `null` means unassigned
 *
 * ## Key Abstractions
 * - `assignedToId: string | null` — `null` represents the unassigned state
 * - `currentUserId` — when provided, shows "Me" as a quick-select above
 *   "Unassigned"; that user still also appears in the alphabetical list
 * - `isPending` shows a spinner overlay during optimistic update transitions
 * - The trigger is the Details card's Assignee row (spec issue-detail §9);
 *   viewers without the triage capability get a read-only row instead
 */

interface PickerUser {
  id: string;
  name: string;
}

interface AssigneePickerProps {
  assignedToId: string | null;
  users: PickerUser[];
  isPending: boolean;
  onAssign: (userId: string | null) => void;
  currentUserId?: string | null;
}

export function AssigneePicker({
  assignedToId,
  users,
  isPending,
  onAssign,
  currentUserId = null,
}: AssigneePickerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const selectedUser = React.useMemo(
    () => users.find((user) => user.id === assignedToId) ?? null,
    [assignedToId, users]
  );

  // The "current user" for the "Me" quick-select; null if not found in the list.
  const currentUser = React.useMemo(
    () =>
      currentUserId
        ? (users.find((u) => u.id === currentUserId) ?? null)
        : null,
    [currentUserId, users]
  );

  // Alphabetical list includes the current user under their real name (in
  // addition to the "Me" quick-select) so searching by name still finds them.
  const filteredUsers = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return users;
    }
    return users.filter((user) => user.name.toLowerCase().includes(normalized));
  }, [query, users]);

  const handleSelect = (userId: string | null): void => {
    onAssign(userId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FieldRowButton
          label="Assignee"
          value={{
            label: selectedUser ? selectedUser.name : "Unassigned",
            muted: selectedUser === null,
            leading: <AssigneeInitial name={selectedUser?.name ?? null} />,
          }}
          isPending={isPending}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-testid="assignee-picker-trigger"
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        align="end"
      >
        {/*
         * shouldFilter={false}: we manage filtering manually so that "Me" and
         * "Unassigned" remain visible regardless of the search query.
         * CommandItems use onSelect for both click and keyboard (Enter) activation.
         */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search users..."
            aria-label="Filter users"
            data-testid="assignee-search-input"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList aria-label="Assignee options">
            {/* Quick-selects group: "Me" (if current user present) + "Unassigned" */}
            <CommandGroup>
              {currentUser ? (
                <CommandItem
                  value={`me-${currentUser.id}`}
                  onSelect={() => handleSelect(currentUser.id)}
                  data-testid="assignee-option-me"
                  data-assigned={assignedToId === currentUser.id}
                  aria-current={
                    assignedToId === currentUser.id ? "true" : undefined
                  }
                >
                  <User className="size-6 shrink-0 p-0.5 text-primary" />
                  <span className="font-medium text-primary">Me</span>
                </CommandItem>
              ) : null}
              <CommandItem
                value="unassigned"
                onSelect={() => handleSelect(null)}
                data-testid="assignee-option-unassigned"
                data-assigned={assignedToId === null}
                aria-current={assignedToId === null ? "true" : undefined}
              >
                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  ?
                </div>
                <span className="font-medium">Unassigned</span>
              </CommandItem>
            </CommandGroup>
            {/* Separator between quick-selects and alphabetical user list */}
            {currentUser ? <CommandSeparator /> : null}
            {/* Alphabetical user list — manually filtered by query */}
            <CommandGroup>
              {filteredUsers.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matches found
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleSelect(user.id)}
                    data-testid={`assignee-option-${user.id}`}
                    data-assigned={user.id === assignedToId}
                    aria-current={user.id === assignedToId ? "true" : undefined}
                  >
                    <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium leading-none">
                        {user.name}
                      </span>
                    </div>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The selected assignee's initial, or "?" when unassigned. */
export function AssigneeInitial({
  name,
}: {
  name: string | null;
}): React.JSX.Element {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground"
      aria-hidden="true"
    >
      {name ? name.slice(0, 1).toUpperCase() : "?"}
    </span>
  );
}
