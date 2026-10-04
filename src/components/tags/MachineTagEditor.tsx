"use client";

import type React from "react";
import {
  startTransition,
  useId,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { Pencil, Plus, X } from "lucide-react";

import {
  createTagAction,
  setMachineTagAction,
} from "~/app/(app)/c/tags/actions";
import { ExclusiveBadge } from "~/components/tags/ExclusiveBadge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  applyTagChanges,
  mergeCreatedTags,
  type CreatedTag,
  type TagChange,
  type TagEditorGroup,
  type TagEditorTag,
} from "~/lib/tags/editor";
import {
  normalizeTagName,
  sameTagName,
  TAG_NAME_MAX,
  tagNameLength,
} from "~/lib/tags/names";
import { cn } from "~/lib/utils";

interface MachineTagEditorProps {
  machineId: string;
  /** Hand-applied tag types by name, then tags with no type (spec 11.14). */
  groups: TagEditorGroup[];
  /** The hand-applied tags the machine holds now. */
  appliedTagIds: string[];
  /** The viewer may create tags (`tags.manage`, spec 11.15). */
  canCreate: boolean;
  /** False for a Removed machine, which tag counts leave out (spec 7.9). */
  countsThisMachine: boolean;
}

/** What the editor knows beyond the server's last render. */
interface EditorState {
  applied: string[];
  created: CreatedTag[];
}

interface EditorUpdate {
  changes: TagChange[];
  created?: CreatedTag;
}

type Status =
  { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

const SAVE_FAILED = "Could not save. Try again.";
/** Stands in for a new tag's id until the server returns the real one. */
const PENDING_PREFIX = "pending:";

function reduce(state: EditorState, update: EditorUpdate): EditorState {
  return {
    applied: applyTagChanges(state.applied, update.changes),
    created: update.created
      ? [...state.created, update.created]
      : state.created,
  };
}

/** A Server Action call that reports a thrown error as a failed save. */
async function call<T>(
  action: () => Promise<{ ok: true; value: T } | { ok: false; message: string }>
): Promise<Outcome<T>> {
  try {
    return await action();
  } catch (error) {
    console.error("Tag save failed", error);
    return { ok: false, message: SAVE_FAILED };
  }
}

/**
 * Applies and removes a machine's hand-applied tags, one save per click (spec
 * 11.4–11.6, 11.10), and lets technicians and admins create a tag while
 * tagging (11.15). The UI updates at once and rolls back when a save fails.
 * The page revalidates after each save, which refreshes the props.
 */
interface Editing {
  /** The server's groups with tags created here merged in. */
  groups: TagEditorGroup[];
  applied: ReadonlySet<string>;
  /** The tag's machine count with this machine's pending change counted. */
  count: (tag: TagEditorTag) => number;
  status: Status;
  setTag: (tagId: string, on: boolean, clears: string[]) => void;
  create: (name: string, typeId: string | null, clears: string[]) => void;
}

function useMachineTags({
  machineId,
  groups,
  appliedTagIds,
  countsThisMachine,
}: Omit<MachineTagEditorProps, "canCreate">): Editing {
  const [confirmed, setConfirmed] = useState<EditorState>({
    applied: appliedTagIds,
    created: [],
  });
  // A fresh server render is the truth; take its applied set when it lands.
  const [rendered, setRendered] = useState(appliedTagIds);
  if (rendered !== appliedTagIds) {
    setRendered(appliedTagIds);
    setConfirmed((previous) => ({ ...previous, applied: appliedTagIds }));
  }
  const [state, addOptimistic] = useOptimistic(confirmed, reduce);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const shownGroups = useMemo(
    () => mergeCreatedTags(groups, state.created),
    [groups, state.created]
  );
  const applied = useMemo(() => new Set(state.applied), [state.applied]);
  const onServer = useMemo(() => new Set(appliedTagIds), [appliedTagIds]);

  function count(tag: TagEditorTag): number {
    if (!countsThisMachine) return tag.machineCount;
    return (
      tag.machineCount +
      Number(applied.has(tag.id)) -
      Number(onServer.has(tag.id))
    );
  }

  function setTag(tagId: string, on: boolean, clears: string[]): void {
    const update: EditorUpdate = {
      changes: [{ tagId, applied: on, clears }],
    };
    startTransition(async () => {
      addOptimistic(update);
      const result = await call(() =>
        setMachineTagAction({ machineId, tagId, applied: on })
      );
      if (!result.ok) {
        setStatus({ kind: "error", message: result.message });
        return;
      }
      setConfirmed((previous) => reduce(previous, update));
      setStatus({ kind: "saved" });
    });
  }

  function create(name: string, typeId: string | null, clears: string[]): void {
    const pendingId = `${PENDING_PREFIX}${name}`;
    startTransition(async () => {
      addOptimistic({
        changes: [{ tagId: pendingId, applied: true, clears }],
        created: { id: pendingId, name, typeId, machineCount: 0 },
      });
      const made = await call(() =>
        createTagAction({ name, tagTypeId: typeId })
      );
      if (!made.ok) {
        setStatus({ kind: "error", message: made.message });
        return;
      }
      const tag: CreatedTag = {
        id: made.value.id,
        name,
        typeId,
        machineCount: 0,
      };
      const result = await call(() =>
        setMachineTagAction({ machineId, tagId: tag.id, applied: true })
      );
      if (!result.ok) {
        // The tag exists now; it is just not on this machine.
        setConfirmed((previous) =>
          reduce(previous, { changes: [], created: tag })
        );
        setStatus({ kind: "error", message: result.message });
        return;
      }
      setConfirmed((previous) =>
        reduce(previous, {
          changes: [{ tagId: tag.id, applied: true, clears }],
          created: tag,
        })
      );
      setStatus({ kind: "saved" });
    });
  }

  return { groups: shownGroups, applied, count, status, setTag, create };
}

/**
 * The machine Info tab's tag editor: an "Edit tags" button in the Tags card
 * that opens the editor as a bottom sheet on phones and a popover on desktop.
 * Both triggers render and CSS shows one (design bible §4: no JS viewport
 * detection). The editing state lives here, so a save still in flight when the
 * panel closes reports its error on the next open.
 */
export function MachineTagEditor({
  canCreate,
  ...props
}: MachineTagEditorProps): React.JSX.Element {
  const editing = useMachineTags(props);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  const trigger = (
    <>
      <Pencil className="size-3.5" aria-hidden="true" />
      Edit tags
    </>
  );
  const triggerClass =
    "-mr-2 gap-1 px-2 text-xs font-medium text-primary hover:text-primary";

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          {/* A full 44px touch target, pulled into the card header's line. */}
          <Button
            variant="ghost"
            className={cn(triggerClass, "-my-3.5 h-11 md:hidden")}
          >
            {trigger}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          closeClassName="hidden"
          className="max-h-[85dvh] gap-0 rounded-t-2xl border-outline-variant bg-card p-0"
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-outline-variant"
          />
          <TagEditorPanel
            title={<SheetTitle className="text-base">Edit tags</SheetTitle>}
            onClose={() => setSheetOpen(false)}
            editing={editing}
            canCreate={canCreate}
          />
        </SheetContent>
      </Sheet>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(triggerClass, "-my-1.5 hidden h-7 md:inline-flex")}
          >
            {trigger}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          collisionPadding={16}
          aria-labelledby={titleId}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          className="flex max-h-[min(45rem,var(--radix-popover-content-available-height))] w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border-outline-variant bg-card p-0"
        >
          <TagEditorPanel
            title={
              <h2 id={titleId} className="text-base font-semibold">
                Edit tags
              </h2>
            }
            onClose={() => setPopoverOpen(false)}
            editing={editing}
            canCreate={canCreate}
            searchRef={searchRef}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

interface TagEditorPanelProps {
  title: React.ReactNode;
  onClose: () => void;
  editing: Editing;
  canCreate: boolean;
  searchRef?: React.Ref<HTMLInputElement>;
}

/**
 * The editor itself (approved design, PP-wqit.3): a search that can also
 * create a tag, then one fieldset per hand-applied tag type and one for tags
 * with no type. Exclusive types are a single choice with a None option.
 */
function TagEditorPanel({
  title,
  onClose,
  editing,
  canCreate,
  searchRef,
}: TagEditorPanelProps): React.JSX.Element {
  const id = useId();
  const [query, setQuery] = useState("");
  const [newTypeId, setNewTypeId] = useState("");

  const name = normalizeTagName(query);
  const needle = name.toLowerCase();
  const length = tagNameLength(name);
  const tooLong = length > TAG_NAME_MAX;
  const allTags = editing.groups.flatMap((group) => group.tags);
  const offerCreate =
    canCreate &&
    name !== "" &&
    !allTags.some((tag) => sameTagName(tag.name, name));

  const types = editing.groups.filter((group) => group.typeId !== null);
  // A type deleted while the panel is open falls back to No type rather than
  // sending a stale id (pinpoint-ui: native select stale options).
  const typeId = types.some((group) => group.typeId === newTypeId)
    ? newTypeId
    : "";

  const shown = editing.groups
    .map((group) => ({
      ...group,
      tags:
        needle === ""
          ? group.tags
          : group.tags.filter((tag) => tag.name.toLowerCase().includes(needle)),
    }))
    .filter((group) => group.tags.length > 0);

  function createTag(): void {
    const group = types.find((candidate) => candidate.typeId === typeId);
    const clears =
      group?.exclusive === true ? group.tags.map((tag) => tag.id) : [];
    editing.create(name, typeId === "" ? null : typeId, clears);
    setQuery("");
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant py-2 pl-4 pr-2">
        <div className="mr-auto">{title}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 text-muted-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="size-[18px]" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-b border-outline-variant px-4 py-3">
        <label htmlFor={`${id}-search`} className="sr-only">
          {canCreate ? "Find or create a tag" : "Find a tag"}
        </label>
        <div className="relative">
          <Input
            ref={searchRef}
            id={`${id}-search`}
            type="text"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={canCreate ? "Find or create a tag" : "Find a tag"}
            className={cn("h-10", canCreate && "pr-14")}
          />
          {canCreate && query !== "" ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums",
                tooLong ? "text-destructive-text" : "text-muted-foreground"
              )}
            >
              {length}/{TAG_NAME_MAX}
            </span>
          ) : null}
        </div>
        {offerCreate ? (
          <div className="flex items-center gap-2">
            {tooLong ? (
              <p
                role="alert"
                className="min-w-0 flex-1 text-sm text-destructive-text"
              >
                Name is over {TAG_NAME_MAX} characters
              </p>
            ) : (
              <button
                type="button"
                onClick={createTag}
                className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-dashed border-primary/50 bg-primary/10 px-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/15 motion-reduce:transition-none"
              >
                <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Create “{name}”</span>
              </button>
            )}
            <label htmlFor={`${id}-type`} className="sr-only">
              Tag type for the new tag
            </label>
            <select
              id={`${id}-type`}
              value={typeId}
              onChange={(event) => setNewTypeId(event.target.value)}
              className="h-10 max-w-[45%] shrink-0 rounded-md border border-input bg-background px-2 text-base text-foreground md:text-[13px]"
            >
              <option value="">No type</option>
              {types.map((group) => (
                <option key={group.typeId} value={group.typeId ?? ""}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-1">
        {shown.map((group) => {
          const key = group.typeId ?? "untyped";
          const radioName = `${id}-${key}`;
          const current = group.tags.filter((tag) =>
            editing.applied.has(tag.id)
          );
          return (
            <fieldset key={key} className="m-0 min-w-0 border-0 p-0 pt-3">
              <legend className="flex items-center gap-1.5 px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {group.name}
                {group.exclusive ? <ExclusiveBadge /> : null}
              </legend>
              {group.tags.map((tag) => {
                const inputId = `${id}-tag-${tag.id}`;
                const checked = editing.applied.has(tag.id);
                const pending = tag.id.startsWith(PENDING_PREFIX);
                const count = editing.count(tag);
                const label = (
                  <>
                    {/* One text node for assistive tech, so the name reads
                        "Topper, 3 machines" with no stray space. */}
                    <span className="sr-only">
                      {`${tag.name}, ${String(count)} ${count === 1 ? "machine" : "machines"}`}
                    </span>
                    <span
                      aria-hidden="true"
                      className="min-w-0 flex-1 truncate"
                    >
                      {tag.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-xs tabular-nums text-muted-foreground"
                    >
                      {count}
                    </span>
                  </>
                );
                return group.exclusive ? (
                  <label key={tag.id} htmlFor={inputId} className={ROW}>
                    <input
                      id={inputId}
                      type="radio"
                      name={radioName}
                      checked={checked}
                      disabled={pending}
                      onChange={() =>
                        editing.setTag(
                          tag.id,
                          true,
                          group.tags
                            .filter((other) => other.id !== tag.id)
                            .map((other) => other.id)
                        )
                      }
                      className={RADIO}
                    />
                    {label}
                  </label>
                ) : (
                  <label key={tag.id} htmlFor={inputId} className={ROW}>
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      disabled={pending}
                      onCheckedChange={(next) =>
                        editing.setTag(tag.id, next === true, [])
                      }
                    />
                    {label}
                  </label>
                );
              })}
              {group.exclusive && needle === "" ? (
                <label htmlFor={`${radioName}-none`} className={ROW}>
                  <input
                    id={`${radioName}-none`}
                    type="radio"
                    name={radioName}
                    checked={current.length === 0}
                    onChange={() => {
                      for (const tag of current)
                        editing.setTag(tag.id, false, []);
                    }}
                    className={RADIO}
                  />
                  <span className="flex-1 text-muted-foreground">None</span>
                </label>
              ) : null}
            </fieldset>
          );
        })}
        {shown.length === 0 && !offerCreate ? (
          <p className="mx-1 my-4 text-sm text-muted-foreground">
            {needle === "" ? "No tags" : "No matching tags"}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-outline-variant px-4 py-3">
        {editing.status.kind === "error" ? (
          <p
            role="alert"
            className="min-w-0 flex-1 text-sm text-destructive-text"
          >
            {editing.status.message}
          </p>
        ) : (
          <p
            role="status"
            className="min-w-0 flex-1 text-sm text-muted-foreground"
          >
            {editing.status.kind === "saved" ? "Saved" : ""}
          </p>
        )}
        <Button type="button" onClick={onClose} className="h-10 px-5">
          Done
        </Button>
      </div>
    </>
  );
}

const ROW =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-sm text-foreground hover:bg-muted has-disabled:cursor-default";
// `color-scheme: dark` keeps the unchecked native radio from painting white.
const RADIO = "size-4 shrink-0 accent-primary [color-scheme:dark]";
