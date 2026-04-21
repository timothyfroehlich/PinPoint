"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Loader2, User } from "lucide-react";
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
 * - Trigger button shows the selected user's avatar initial + name, or "Unassigned"
 * - CommandInput provides the search field; items are filtered manually so that
 *   "Me" and "Unassigned" are always visible regardless of query
 * - Alphabetical user list (excluding the "Me" user) filters by name as the user types
 * - `onAssign(userId | null)` fires on selection; `null` means unassigned
 *
 * ## Key Abstractions
 * - `assignedToId: string | null` — `null` represents the unassigned state
 * - `currentUserId` — when provided, shows "Me" as a quick-select above
 *   "Unassigned", and removes that user from the alphabetical list
 * - `isPending` shows a spinner overlay during optimistic update transitions
 * - `disabled` / `disabledReason` support permission-gated assignment
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
  disabled?: boolean;
  disabledReason?: string | null;
  currentUserId?: string | null;
}

export function AssigneePicker({
  assignedToId,
  users,
  isPending,
  onAssign,
  disabled = false,
  disabledReason = null,
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

  // Alphabetical list excludes current user (they appear as "Me"), filtered by query.
  const filteredUsers = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const candidates = currentUser
      ? users.filter((u) => u.id !== currentUser.id)
      : users;
    if (!normalized) {
      return candidates;
    }
    return candidates.filter((user) =>
      user.name.toLowerCase().includes(normalized)
    );
  }, [query, users, currentUser]);

  const handleSelect = (userId: string | null): void => {
    onAssign(userId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm text-foreground transition",
            "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={isPending || disabled}
          title={disabledReason ?? undefined}
          data-testid="assignee-picker-trigger"
        >
          <div className="flex items-center gap-2">
            {isPending ? (
              <>
                <Loader2 className="size-6 animate-spin p-1 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">
                  Updating...
                </span>
              </>
            ) : (
              <>
                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  {selectedUser
                    ? selectedUser.name.slice(0, 1).toUpperCase()
                    : "?"}
                </div>
                <span className="font-medium">
                  {selectedUser ? selectedUser.name : "Unassigned"}
                </span>
              </>
            )}
          </div>
          {isPending ? (
            <Loader2
              className="size-4 animate-spin opacity-50"
              aria-hidden="true"
              data-testid="assignee-picker-loader"
            />
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 opacity-50"
              aria-hidden="true"
            >
              <path
                d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.26618 11.9026 7.38064 11.95 7.49999 11.95C7.61933 11.95 7.73379 11.9026 7.81819 11.8182L10.0682 9.56819Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
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
