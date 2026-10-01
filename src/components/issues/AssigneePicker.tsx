"use client";

import React from "react";
import { Check, User } from "lucide-react";
import { FieldRowButton } from "~/components/issues/fields/IssueFieldRow";
import {
  FieldDrawerHeader,
  fieldDrawerContentClassName,
} from "~/components/issues/fields/MetadataDrawer";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Drawer, DrawerContent, DrawerTrigger } from "~/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useIsMobile } from "~/hooks/use-is-mobile";
import { cn } from "~/lib/utils";

/**
 * AssigneePicker — the Details card's Assignee row and its picker (spec
 * issue-detail §9.4).
 *
 * ## Pattern
 * A Command (cmdk) list with manual search filtering: `shouldFilter={false}`
 * keeps "Me" and "Unassigned" visible regardless of the query. On desktop the
 * list sits in a Popover anchored to the row; on phones it sits in a bottom
 * sheet with the same chrome as the other field pickers, search box on top
 * and 44px rows. Two component trees, so this branches on `useIsMobile` (a
 * CORE-RESP-002 sanctioned exception).
 *
 * ## Composition
 * - Trigger row shows the selected user's initial + name, or "Unassigned"
 * - Alphabetical user list also includes the current user (under their real
 *   name), so searching by name finds them even though they already appear
 *   as "Me"
 * - The current assignee's row (or Unassigned) carries a check mark and is
 *   where the list's highlight starts, so the highlight never suggests a
 *   different person is assigned
 * - Filtering announces how many people match
 * - `onAssign(userId | null)` fires on selection; `null` means unassigned
 * - While `isPending` the row shows a spinner and won't open
 * - Viewers without the triage capability get a read-only row instead
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

interface AssigneeCommandProps {
  assignedToId: string | null;
  users: PickerUser[];
  currentUser: PickerUser | null;
  onSelect: (userId: string | null) => void;
  /** Phone rows are 44px tall (spec §13.2). */
  touch?: boolean;
}

/** The searchable assignee list; the Popover or the Drawer wraps it. */
export function AssigneeCommand({
  assignedToId,
  users,
  currentUser,
  onSelect,
  touch = false,
}: AssigneeCommandProps): React.JSX.Element {
  const [query, setQuery] = React.useState("");

  const filteredUsers = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return users;
    }
    return users.filter((user) => user.name.toLowerCase().includes(normalized));
  }, [query, users]);

  const itemClassName = cn(touch && "min-h-11");
  // The highlight starts on whoever is assigned now.
  const defaultValue =
    assignedToId === null
      ? "unassigned"
      : assignedToId === currentUser?.id
        ? `me-${currentUser.id}`
        : assignedToId;
  const trimmedQuery = query.trim();
  const resultAnnouncement = trimmedQuery
    ? filteredUsers.length === 0
      ? "No matches"
      : `${filteredUsers.length} ${filteredUsers.length === 1 ? "match" : "matches"}`
    : "";

  return (
    <Command
      shouldFilter={false}
      defaultValue={defaultValue}
      // In the sheet the search stays put while the list scrolls.
      className={cn(touch && "min-h-0 flex-1 bg-transparent")}
    >
      <CommandInput
        placeholder="Search users..."
        aria-label="Filter users"
        // 16px on phones so iOS doesn't zoom the page on focus.
        className={cn(touch && "text-base")}
        data-testid="assignee-search-input"
        value={query}
        onValueChange={setQuery}
      />
      <p role="status" className="sr-only">
        {resultAnnouncement}
      </p>
      <CommandList
        aria-label="Assignee options"
        className={cn(touch && "max-h-none min-h-0 flex-1")}
      >
        {/* Quick-selects: "Me" (if the current user is assignable) and
            "Unassigned". */}
        <CommandGroup>
          {currentUser ? (
            <CommandItem
              value={`me-${currentUser.id}`}
              onSelect={() => onSelect(currentUser.id)}
              className={itemClassName}
              data-testid="assignee-option-me"
              data-assigned={assignedToId === currentUser.id}
              aria-current={
                assignedToId === currentUser.id ? "true" : undefined
              }
            >
              <User
                className="size-6 shrink-0 p-0.5 text-primary"
                aria-hidden="true"
              />
              <span className="font-medium text-primary">Me</span>
              <CurrentMark show={assignedToId === currentUser.id} />
            </CommandItem>
          ) : null}
          <CommandItem
            value="unassigned"
            onSelect={() => onSelect(null)}
            className={itemClassName}
            data-testid="assignee-option-unassigned"
            data-assigned={assignedToId === null}
            aria-current={assignedToId === null ? "true" : undefined}
          >
            <span
              className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground"
              aria-hidden="true"
            >
              ?
            </span>
            <span className="font-medium">Unassigned</span>
            <CurrentMark show={assignedToId === null} />
          </CommandItem>
        </CommandGroup>
        {/* The divider is a border, not a CommandSeparator: a separator
            inside the listbox is not an allowed listbox child. */}
        <CommandGroup className={cn(currentUser && "border-t border-border")}>
          {filteredUsers.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No matches found
            </p>
          ) : (
            filteredUsers.map((user) => (
              <CommandItem
                key={user.id}
                value={user.id}
                onSelect={() => onSelect(user.id)}
                className={itemClassName}
                data-testid={`assignee-option-${user.id}`}
                data-assigned={user.id === assignedToId}
                aria-current={user.id === assignedToId ? "true" : undefined}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="font-medium leading-none">{user.name}</span>
                <CurrentMark show={user.id === assignedToId} />
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/** The check that marks the current assignee's row. */
function CurrentMark({ show }: { show: boolean }): React.JSX.Element | null {
  if (!show) return null;
  return (
    <Check
      className="ml-auto size-4 shrink-0 text-primary"
      aria-hidden="true"
    />
  );
}

export function AssigneePicker({
  assignedToId,
  users,
  isPending,
  onAssign,
  currentUserId = null,
}: AssigneePickerProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

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

  const handleOpenChange = (next: boolean): void => {
    if (next && isPending) return;
    setOpen(next);
  };

  const handleSelect = (userId: string | null): void => {
    setOpen(false);
    onAssign(userId);
  };

  const trigger = (
    <FieldRowButton
      label="Assignee"
      value={{
        label: selectedUser ? selectedUser.name : "Unassigned",
        muted: selectedUser === null,
        leading: <AssigneeInitial name={selectedUser?.name ?? null} />,
      }}
      isPending={isPending}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-testid="assignee-picker-trigger"
    />
  );

  // The list mounts with the popup, so its search resets on every open.
  const list = (
    <AssigneeCommand
      assignedToId={assignedToId}
      users={users}
      currentUser={currentUser}
      onSelect={handleSelect}
      touch={isMobile}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          className={fieldDrawerContentClassName}
          data-testid="assignee-drawer"
          onOpenAutoFocus={(event) => {
            // Start in the search box, as the desktop popover does.
            const search =
              event.currentTarget instanceof HTMLElement
                ? event.currentTarget.querySelector("input")
                : null;
            if (search) {
              event.preventDefault();
              search.focus();
            }
          }}
        >
          <FieldDrawerHeader
            title="Assignee"
            description="Search for a person, or choose Me or Unassigned."
          />
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {list}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        align="end"
        aria-label="Assignee"
      >
        {list}
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
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground"
      aria-hidden="true"
    >
      {name ? name.slice(0, 1).toUpperCase() : "?"}
    </span>
  );
}
