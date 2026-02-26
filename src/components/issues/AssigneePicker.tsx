"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Loader2, User } from "lucide-react";
import { Separator } from "~/components/ui/separator";

/**
 * AssigneePicker — Listbox-style dropdown for assigning a user to an issue.
 *
 * ## Pattern
 * Custom listbox with local open/close state, a search input for filtering
 * users by name, and an "Unassigned" option that maps to `null`. Used on
 * the issue detail page (single-select, immediate mutation) — distinct from
 * the multi-select assignee filter in `IssueFilters`.
 *
 * ## Composition
 * - Trigger button shows the selected user's avatar initial + name, or "Unassigned"
 * - Dropdown includes a text input for filtering, then "Unassigned" as a
 *   permanent first option, followed by filtered users
 * - Click-outside closes the dropdown via a `mousedown` document listener
 * - `onAssign(userId | null)` fires on selection; `null` means unassigned
 *
 * ## Key Abstractions
 * - `assignedToId: string | null` — `null` represents the unassigned state
 * - `currentUserId` — when provided, shows "Me" as a quick-select above
 *   "Unassigned", and removes that user from the alphabetical list
 * - `isPending` shows a spinner overlay during optimistic update transitions
 * - `disabled` / `disabledReason` support permission-gated assignment
 *
 * ## Mobile Notes
 * The standardized assignee ordering (Me -> Unassigned -> separator -> alpha)
 * from `~/lib/issues/filter-utils` follows the same pattern used here.
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
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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

  React.useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleClick(event: MouseEvent): void {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery("");
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const filteredUsers = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    // Exclude the current user from the alphabetical list — they appear as "Me".
    const candidates = currentUser
      ? users.filter((u) => u.id !== currentUser.id)
      : users;
    if (!normalized) {
      return candidates;
    }
    return candidates.filter((user) => {
      const haystack = [user.name]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return haystack.some((value) => value.includes(normalized));
    });
  }, [query, users, currentUser]);

  const handleAssign = (userId: string | null): void => {
    onAssign(userId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition",
          "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
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

      {isOpen ? (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-md border border-border bg-popover p-2 shadow-xl text-popover-foreground">
          <input
            ref={inputRef}
            type="text"
            placeholder="Filter users..."
            aria-label="Filter users"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mb-2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="assignee-search-input"
          />
          <div
            className="max-h-56 space-y-1 overflow-y-auto"
            role="listbox"
            aria-label="Assignee options"
          >
            {/* "Me" quick-select — shown only when the current user is in the list */}
            {currentUser ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                onClick={() => handleAssign(currentUser.id)}
                data-testid="assignee-option-me"
                role="option"
                aria-selected={assignedToId === currentUser.id}
              >
                <User className="size-6 shrink-0 p-0.5 text-primary" />
                <span className="font-medium text-primary">Me</span>
              </button>
            ) : null}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              onClick={() => handleAssign(null)}
              data-testid="assignee-option-unassigned"
              role="option"
              aria-selected={assignedToId === null}
            >
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                ?
              </div>
              <span className="font-medium">Unassigned</span>
            </button>
            {/* Separator between quick-selects and alphabetical user list */}
            {currentUser ? <Separator className="my-1" /> : null}
            {filteredUsers.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No matches found
              </p>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  onClick={() => handleAssign(user.id)}
                  data-testid={`assignee-option-${user.id}`}
                  role="option"
                  aria-selected={user.id === assignedToId}
                >
                  <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium leading-none">
                      {user.name}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
