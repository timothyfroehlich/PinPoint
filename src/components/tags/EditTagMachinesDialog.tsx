"use client";

import type React from "react";
import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { setTagMachinesAction } from "~/app/(app)/c/tags/actions";

interface PickerMachine {
  id: string;
  initials: string;
  name: string;
}

interface EditTagMachinesDialogProps {
  tagId: string;
  tagName: string;
  /** "Location · One per machine", or null for a tag with no tag type. */
  context: string | null;
  allMachines: PickerMachine[];
  currentIds: string[];
  /**
   * In an exclusive tag type: each machine already holding another tag of the
   * type, mapped to that tag's name. Adding it here moves it (spec 11.5).
   */
  otherTagByMachine: Record<string, string>;
  /** The empty tag's call to action reads "Add machines". */
  variant?: "edit" | "add";
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * A hand-applied tag page's machine editor (spec 11.11): every machine with a
 * checkbox, the tag's current machines checked. Saving gives the tag exactly
 * the checked machines.
 */
export function EditTagMachinesDialog({
  variant = "edit",
  ...props
}: EditTagMachinesDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "add" ? (
          <Button className="gap-2">
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Add machines
          </Button>
        ) : (
          // Icon-only below md so the tag's name keeps the header row.
          <Button variant="outline" className="gap-2 max-md:size-9 max-md:px-0">
            <Pencil className="size-4 shrink-0" aria-hidden="true" />
            <span className="max-md:sr-only">Edit machines</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg"
        // A stray backdrop click shouldn't discard the selection.
        onInteractOutside={(event) => event.preventDefault()}
      >
        {/* Mounts with the content, so each open starts from the saved set. */}
        <EditTagMachinesForm {...props} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditTagMachinesForm({
  tagId,
  tagName,
  context,
  allMachines,
  currentIds,
  otherTagByMachine,
  onClose,
}: Omit<EditTagMachinesDialogProps, "variant"> & {
  onClose: () => void;
}): React.JSX.Element {
  const id = useId();
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(currentIds));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = useMemo(() => new Set(currentIds), [currentIds]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return allMachines;
    return allMachines.filter(
      (machine) =>
        machine.name.toLowerCase().includes(needle) ||
        machine.initials.toLowerCase().includes(needle)
    );
  }, [allMachines, query]);

  const added = allMachines.filter(
    (machine) => selected.has(machine.id) && !current.has(machine.id)
  );
  const removedCount = currentIds.filter(
    (machineId) => !selected.has(machineId)
  ).length;
  const moved = added.filter((machine) => machine.id in otherTagByMachine);

  const changes: string[] = [];
  if (added.length > 0) changes.push(`Adds ${plural(added.length, "machine")}`);
  if (removedCount > 0)
    changes.push(`Removes ${plural(removedCount, "machine")}`);
  const [onlyMoved] = moved;
  const moveNote =
    moved.length === 1 && onlyMoved
      ? `${onlyMoved.name} moves from ${otherTagByMachine[onlyMoved.id] ?? "another tag"}`
      : moved.length > 1
        ? `${plural(moved.length, "machine")} move from other tags`
        : null;

  const saveLabel =
    added.length > 0 && removedCount === 0
      ? `Add ${plural(added.length, "machine")}`
      : removedCount > 0 && added.length === 0
        ? `Remove ${plural(removedCount, "machine")}`
        : "Save changes";

  function toggle(machineId: string, checked: boolean): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(machineId);
      else next.delete(machineId);
      return next;
    });
  }

  function save(): void {
    setError(null);
    startTransition(async () => {
      const result = await setTagMachinesAction({
        tagId,
        machineIds: [...selected],
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <>
      <DialogHeader className="border-b border-outline-variant px-5 pb-4 pr-12 pt-5">
        <DialogTitle>Machines in {tagName}</DialogTitle>
        <DialogDescription className={context === null ? "sr-only" : ""}>
          {context ?? "Check the machines this tag belongs on."}
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-5 py-3">
        <label htmlFor={`${id}-search`} className="sr-only">
          Find a machine
        </label>
        <Input
          id={`${id}-search`}
          type="search"
          placeholder="Find a machine"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
        <fieldset className="-mx-2 min-h-0 flex-1 overflow-y-auto">
          <legend className="sr-only">Machines</legend>
          {visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No machines found
            </p>
          ) : (
            <ul>
              {visible.map((machine) => {
                const checkboxId = `${id}-machine-${machine.id}`;
                const otherTag = current.has(machine.id)
                  ? undefined
                  : otherTagByMachine[machine.id];
                return (
                  <li key={machine.id}>
                    <label
                      htmlFor={checkboxId}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={selected.has(machine.id)}
                        onCheckedChange={(checked) =>
                          toggle(machine.id, checked === true)
                        }
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm">{machine.name}</span>
                        {/* Names repeat (three Godzillas); initials tell them apart. */}
                        <span className="shrink-0 rounded border border-outline-variant px-1.5 text-[11px] font-semibold text-muted-foreground">
                          {machine.initials}
                        </span>
                      </span>
                      {otherTag !== undefined ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Now in {otherTag}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      </div>
      {error !== null ? (
        <p role="alert" className="px-5 pb-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-outline-variant px-5 py-3">
        <p
          className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {changes.length === 0 ? "No changes" : changes.join(" · ")}
          {moveNote !== null ? (
            <>
              <br />
              {moveNote}
            </>
          ) : null}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            loading={pending}
            disabled={changes.length === 0}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
