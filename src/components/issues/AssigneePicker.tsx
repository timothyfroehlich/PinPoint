"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface PickerUser {
  id: string;
  name: string;
  email: string | null;
}

interface AssigneePickerProps {
  assignedToId: string | null;
  users: PickerUser[];
  isPending: boolean;
  onAssign: (userId: string | null) => void;
}

export function AssigneePicker({
  assignedToId,
  users,
  isPending,
  onAssign,
}: AssigneePickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const selectedUser = React.useMemo(
    () => users.find((user) => user.id === assignedToId) ?? null,
    [assignedToId, users]
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
    if (!normalized) {
      return users;
    }
    return users.filter((user) => {
      const haystack = [user.name, user.email ?? ""]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return haystack.some((value) => value.includes(normalized));
    });
  }, [query, users]);

  const handleAssign = (userId: string | null): void => {
    onAssign(userId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition",
          "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isPending && "opacity-70"
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={isPending}
        data-testid="assignee-picker-trigger"
      >
        <span className="block text-xs uppercase tracking-wide text-muted-foreground">
          Current Assignee
        </span>
        <span className="block text-sm font-medium text-foreground">
          {selectedUser ? selectedUser.name : "Unassigned"}
        </span>
        <span className="block text-xs text-muted-foreground">
          {selectedUser?.email ?? "Click to search"}
        </span>
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 right-0 z-20 mt-2 rounded-md border border-border bg-popover p-3 shadow-xl"
          role="listbox"
          aria-label="Assignee options"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a name or email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="assignee-search-input"
          />
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleAssign(null)}
              data-testid="assignee-option-unassigned"
            >
              <span className="font-medium">Unassigned</span>
              <span className="block text-xs text-muted-foreground">
                Remove current assignee
              </span>
            </button>
            {filteredUsers.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No matches found
              </p>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleAssign(user.id)}
                  data-testid={`assignee-option-${user.id}`}
                >
                  <span className="font-medium">{user.name}</span>
                  {user.email ? (
                    <span className="block text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
