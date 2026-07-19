"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import type { CollaboratorUser } from "~/lib/collections/collaborators";
import {
  addCollectionCollaboratorAction,
  removeCollectionCollaboratorAction,
} from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  ownerName: string;
  editors: CollaboratorUser[];
  /** All grantable members (owner already excluded); this filters out current editors. */
  grantableMembers: CollaboratorUser[];
}

function Avatar({ name }: { name: string }): React.JSX.Element {
  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/**
 * Owner-only "People with access" panel inside the Share dialog (PP-wqit.7).
 * Lists the owner + current editors (each removable) and an "Add people" picker
 * over the remaining members. Names only — no emails (CORE-SEC-007).
 */
export function CollectionCollaborators({
  collectionId,
  ownerName,
  editors: initialEditors,
  grantableMembers,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [editors, setEditors] = useState<CollaboratorUser[]>(initialEditors);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editorIds = useMemo(() => new Set(editors.map((e) => e.id)), [editors]);
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grantableMembers.filter(
      (m) =>
        !editorIds.has(m.id) && (q === "" || m.name.toLowerCase().includes(q))
    );
  }, [grantableMembers, editorIds, query]);

  function add(user: CollaboratorUser): void {
    setError(null);
    setOpen(false);
    setQuery("");
    startTransition(async () => {
      const result = await addCollectionCollaboratorAction({
        collectionId,
        userId: user.id,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditors((prev) =>
        [...prev, user].sort((a, b) => a.name.localeCompare(b.name))
      );
      router.refresh();
    });
  }

  function remove(userId: string): void {
    setError(null);
    startTransition(async () => {
      const result = await removeCollectionCollaboratorAction({
        collectionId,
        userId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditors((prev) => prev.filter((e) => e.id !== userId));
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-sm font-semibold">People with access</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Editors can add or remove machines and rename this collection. They
        can&apos;t delete it, change the share link, or manage this list.
      </p>

      <div className="max-h-[196px] space-y-1 overflow-y-auto">
        <div className="flex items-center gap-2 py-1">
          <Avatar name={ownerName} />
          <span className="flex-1 text-sm font-medium">
            {ownerName} (owner)
          </span>
        </div>
        {editors.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-1">
            <Avatar name={e.name} />
            <span className="flex-1 text-sm">{e.name}</span>
            <button
              type="button"
              onClick={() => remove(e.id)}
              disabled={pending}
              aria-label={`Remove ${e.name}`}
              data-testid={`collab-remove-${e.id}`}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            data-testid="collab-add-trigger"
            disabled={pending}
          >
            Add people
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search members…"
              aria-label="Search members"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandGroup>
                {available.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    No members to add.
                  </p>
                ) : (
                  available.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => add(m)}
                      data-testid={`collab-option-${m.id}`}
                    >
                      <Avatar name={m.name} />
                      <span className="ml-2">{m.name}</span>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
