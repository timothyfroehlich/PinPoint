"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  searchPinballMapFamiliesAction,
  listPinballMapEditionsAction,
  resolvePinballMapLinkAction,
  type CatalogEdition,
  type CatalogFamily,
} from "~/app/(app)/m/pinballmap-actions";

/**
 * PinballMapLinkField — create/edit control for linking a machine to its
 * PinballMap catalog title, or marking it "not on PinballMap".
 *
 * ## Two-step picker (family → edition)
 * PBM groups editions of one title (Godzilla Pro/Premium/LE) under a machine
 * group; standalone titles have none. Step 1 is a debounced SERVER search of the
 * local catalog mirror for a FAMILY (a group, or a standalone title). Step 2 — an
 * EDITION dropdown — appears ONLY when the chosen family has more than one
 * edition; it starts unset and is required, so an ambiguous family can't be
 * linked without choosing the exact edition. A single-edition family resolves
 * immediately and skips step 2.
 *
 * The server re-derives manufacturer/year/OPDB/IPDB from the catalog on save,
 * never trusting the client.
 *
 * ## Submission (native form)
 * - `pbmLinkPresent=1` — marks that this form manages the link, so the action
 *   treats the submitted state as authoritative (and never wipes the link from
 *   other edit surfaces that omit the marker).
 * - `pinballmapMachineId` — the resolved edition's id, or empty when unlinked.
 *   When the edition step is shown it IS the `<select>` (so `required` is
 *   enforced natively); otherwise it is a hidden input.
 * - `pinballmapExcluded=on` — the Manual Entry flag.
 *
 * Link and excluded are mutually exclusive in the UI (selecting one clears the
 * other), mirroring the DB CHECK.
 *
 * `pinballmapExcludedReason` is deliberately NOT submitted (PP-3bbr.3). The
 * field was write-only — nothing in the app ever rendered it back, only the MCP
 * tools read it — so it was dropped rather than kept as a box nobody sees the
 * output of. The column stays, `set_machine_pinballmap` still writes it, and
 * `carryExcludedFields` preserves a stored value across a save from this form
 * because an absent field arrives as `undefined`. Nothing here can clear one.
 */

interface PinballMapLinkFieldProps {
  defaultMachineId?: number | null;
  /** Display name of the currently-linked title (resolved from the mirror), if any. */
  defaultName?: string | null;
  defaultExcluded?: boolean;
  /** Stored hand-entered model identity, for a machine already marked excluded. */
  defaultModelName?: string | null;
  defaultManufacturer?: string | null;
  defaultYear?: number | null;
  /**
   * What APC calls this cabinet, shown as the Model name field's PLACEHOLDER
   * (spec 2.4). Suggested, never pre-filled: a blank model name already means
   * "same as the cabinet's name" at read time, so leaving it blank keeps
   * following a later rename, where a pre-filled copy would freeze the name as
   * it was the day the source was switched. Omit it and the field falls back to
   * a generic example.
   */
  machineName?: string;
  disabled?: boolean;
  /**
   * Called when the USER changes the selection. The picker's state lives in
   * React (cmdk items, a Radix Select, a controlled hidden input), none of
   * which fire a bubbling `input` event — so a parent tracking dirtiness via
   * `onInput` sees nothing and reports "No unsaved changes" over real pending
   * edits (PP-o355.19 review). Deliberately NOT called by the edit-preselect
   * effect, which is initialization rather than an edit.
   */
  onDirty?: (() => void) | undefined;
}

/**
 * The two Source positions (PP-3bbr.3). "Manual Entry" rather than "Uncataloged
 * game" (Tim, 2026-08-27): it names what the operator does, not what the game
 * is. The `uncataloged` state name, the `pinballmap_excluded` column and
 * `PinballmapListingControl`'s own status copy are unchanged — that block
 * reports why a machine cannot be listed, which is a fact about the catalog,
 * not about where these three fields came from.
 */
const SOURCE_OPTIONS: readonly {
  manual: boolean;
  label: string;
  testId: string;
}[] = [
  { manual: false, label: "Pinball Map", testId: "pinballmap-source-catalog" },
  { manual: true, label: "Manual Entry", testId: "pinballmap-source-manual" },
];

function formatMeta(manufacturer: string | null, year: number | null): string {
  return [manufacturer, year !== null ? String(year) : null]
    .filter((v): v is string => v !== null && v.length > 0)
    .join(" · ");
}

export function PinballMapLinkField({
  defaultMachineId = null,
  defaultName = null,
  defaultExcluded = false,
  defaultModelName = null,
  defaultManufacturer = null,
  defaultYear = null,
  machineName = "",
  disabled = false,
  onDirty,
}: PinballMapLinkFieldProps): React.JSX.Element {
  const triggerId = useId();
  const editionId = useId();
  const modelNameId = useId();
  const manufacturerId = useId();
  const yearId = useId();
  const sourceLabelId = useId();

  const [family, setFamily] = useState<CatalogFamily | null>(null);
  const [editions, setEditions] = useState<CatalogEdition[]>([]);
  const [selectedEditionId, setSelectedEditionId] = useState<number | null>(
    null
  );
  const [editionsLoading, setEditionsLoading] = useState(false);

  const [excluded, setExcluded] = useState(defaultExcluded);

  // Hand-entered model identity for a game the catalog can't cover (PP-3bbr).
  // Kept in state rather than left uncontrolled so switching back to a catalog
  // title can warn about losing what was typed.
  const [modelName, setModelName] = useState(defaultModelName ?? "");
  // A linked machine's manufacturer/year came from the catalog, not the user.
  // Don't load them — switching to Manual Entry must not inherit them (PP-3bbr.2).
  const [manufacturer, setManufacturer] = useState(
    defaultMachineId !== null ? "" : (defaultManufacturer ?? "")
  );
  const [year, setYear] = useState(
    defaultMachineId !== null
      ? ""
      : defaultYear !== null
        ? String(defaultYear)
        : ""
  );
  // Nothing is auto-filled, so anything in these three fields is the user's
  // (spec 2.4). PP-3bbr.2 had to track whether the model name was seeded or
  // typed, because a seeded value would otherwise have fired the overwrite
  // confirm over text nobody wrote; dropping the seed drops that distinction
  // with it (Tim, 2026-08-27).
  const hasHandEntry =
    modelName.trim().length > 0 ||
    manufacturer.trim().length > 0 ||
    year.trim().length > 0;

  /**
   * A catalog pick waiting on the "you'll lose what you typed" confirm.
   *
   * Only a machine with hand-entered values has anything to lose, and losing it
   * is not a UI choice — the DB CHECK `machines_model_name_requires_excluded`
   * means a linked machine cannot carry one. So the honest move is to say so
   * before the pick lands, not to drop it silently on save.
   */
  const [pendingFamily, setPendingFamily] = useState<CatalogFamily | null>(
    null
  );

  // Whether the USER has changed the selection. Until they do, the form submits
  // the machine's STORED link — see `submittedId`.
  //
  // Mirrored into a ref because the preselect effect below closes over its
  // first render's value and would therefore always read `false`. Set both
  // through {@link markUserChanged} so they cannot drift.
  const [userChanged, setUserChanged] = useState(false);
  const userChangedRef = useRef(false);
  const markUserChanged = (): void => {
    userChangedRef.current = true;
    setUserChanged(true);
  };

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogFamily[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit preselect: resolve an existing link id back to its family + editions.
  // `defaultName` shows immediately while the round-trip is in flight.
  //
  // A rejection here must not be swallowed: `family` would stay null forever
  // while the trigger kept showing the stored title, and what the form submits
  // is decided by `userChanged` below rather than by whether this resolved.
  //
  // It also has to lose a race it can win: a user who picks Manual Entry before
  // this lands would otherwise have `family` and the resolved edition id put
  // back underneath them, with `excluded` still on — a form submitting both a
  // catalog id and the Manual Entry flag, which the DB CHECK forbids outright
  // (Codex review, PR #1925). Once the user has touched the field the stored
  // link is no longer what the control is about, so a late resolve is dropped.
  useEffect(() => {
    if (defaultMachineId === null) return;
    let active = true;
    void resolvePinballMapLinkAction(defaultMachineId)
      .then((resolved) => {
        if (active && !userChangedRef.current && resolved) {
          setFamily(resolved.family);
          setEditions(resolved.editions);
          setSelectedEditionId(resolved.pinballmapMachineId);
        }
      })
      .catch((error: unknown) => {
        // Non-fatal: the field stays usable and the stored link is still what
        // gets submitted. Surfacing it beats an unhandled rejection.
        console.error("Failed to resolve the stored PinballMap link", error);
      });
    return () => {
      active = false;
    };
  }, [defaultMachineId]);

  // Debounced server search of the local catalog mirror; `active` guards against
  // out-of-order responses when the query changes mid-flight.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        const rows = await searchPinballMapFamiliesAction(trimmed);
        if (active) {
          setResults(rows);
          setLoading(false);
        }
      })();
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  /**
   * Step 1 of a catalog pick: intercept it when there is hand-entered model
   * identity to lose, otherwise apply it straight away.
   *
   * Guarded on `hasHandEntry` alone, NOT on `excluded` too. Since PP-3bbr.3 the
   * picker only exists while Source is Pinball Map, so a guard that also
   * required `excluded` could never fire — reaching the picker means having
   * left Manual Entry already. What was typed survives that move in React
   * state, so the pick is still the step that destroys it, and this is still
   * where the warning belongs.
   */
  const handlePickFamily = (pick: CatalogFamily): void => {
    if (hasHandEntry) {
      setPendingFamily(pick);
      setOpen(false);
      return;
    }
    applyFamily(pick);
  };

  const applyFamily = (pick: CatalogFamily): void => {
    setFamily(pick);
    setExcluded(false); // mutual exclusion
    // The catalog is the source for a linked machine, so what was typed here
    // cannot survive the switch — clear it in the UI too rather than leave
    // values on screen that the save is about to drop (CORE-ARCH-012).
    setModelName("");
    setManufacturer("");
    setYear("");
    setOpen(false);
    setQuery("");
    markUserChanged();
    onDirty?.();

    if (pick.pinballmapMachineId !== null) {
      // Single-edition family (standalone or a one-edition group): resolved.
      setEditions([]);
      setSelectedEditionId(pick.pinballmapMachineId);
      return;
    }

    // Multi-edition family: load editions for the required second step.
    setEditions([]);
    setSelectedEditionId(null);
    if (pick.machineGroupId === null) return;
    const groupId = pick.machineGroupId;
    setEditionsLoading(true);
    void (async () => {
      try {
        const rows = await listPinballMapEditionsAction(groupId);
        setEditions(rows);
      } finally {
        // Always clear the loading flag — a stuck-loading state must not leave
        // the required edition select unsubmittable with no recourse.
        setEditionsLoading(false);
      }
    })();
  };

  /**
   * The Source segmented control (PP-3bbr.3). `manual` true is Manual Entry,
   * false is Pinball Map.
   *
   * Switching back to Pinball Map keeps what was typed in React state, so
   * flipping twice restores it; only saving while on Pinball Map drops it,
   * which is the source the user chose to save under. Actively picking a
   * catalog title is the destructive move, and that one is confirmed
   * ({@link handlePickFamily}).
   */
  const handleSetSource = (manual: boolean): void => {
    if (manual === excluded) return;
    markUserChanged();
    onDirty?.();
    if (manual) {
      setExcluded(true);
      setFamily(null);
      setEditions([]);
      setSelectedEditionId(null);
      setOpen(false);
      setQuery("");
    } else {
      setExcluded(false);
    }
  };

  // The edition step is shown only for an ambiguous (multi-edition) family.
  // The `?.` carries the null guard: if `family` is null the first comparison
  // is `undefined === null` → false, which also narrows `family` for the second.
  const needsEdition =
    family?.pinballmapMachineId === null && family.editionCount > 1;

  // Resolved id: a single-edition family's id, or the chosen edition.
  const resolvedId = family
    ? (family.pinballmapMachineId ?? selectedEditionId)
    : null;

  /**
   * What the form actually submits for the link.
   *
   * `resolvedId` is null until the preselect round-trip lands, but the trigger
   * shows `defaultName` the whole time — so submitting `resolvedId` during that
   * window silently unlinked a machine that looked linked, wiping the id,
   * listing, lmx and catalog metadata with no error (PP-o355.19 review). Worse,
   * a failed or empty resolve made that window permanent.
   *
   * So until the user actually changes something, submit the STORED link. If
   * its catalog row has since disappeared, `resolvePbmLinkColumnsForUpdate`
   * rejects the save with "no longer in the catalog — search again", which is
   * the honest failure (CORE-ARCH-012) rather than a silent wipe.
   */
  const submittedId = userChanged ? resolvedId : defaultMachineId;

  const familyMeta = family ? formatMeta(family.manufacturer, family.year) : "";
  // While an existing link resolves on edit, show its known name; otherwise
  // prompt.
  //
  // Gated on `userChanged` for the same reason `submittedId` is, and it has to
  // be the same gate: once the user has changed the field, the trigger showing
  // the stored title while the hidden input carries an empty id is the picker
  // claiming a link the save is about to drop (Codex review, PR #1925). The
  // clearest case is switching to Manual Entry and back — `family` is null and
  // nothing has been picked, so there is nothing to name.
  const placeholderLabel =
    !userChanged && defaultMachineId !== null && defaultName
      ? defaultName
      : "Search for a model…";

  return (
    // The outer div carries `@container`; the inner one does the `@xl:` query.
    // They cannot be the same element — an element never queries its own
    // container, so a lone `@xl:` here would silently resolve against whatever
    // ancestor container the HOST page happened to provide. That is exactly
    // what went wrong: the Manage tab has one, `/m/new` does not, so the same
    // component paired Model/Edition on one page and not the other. Owning the
    // container makes the pairing a property of this field, not of its host.
    <div className="@container">
      <div className="space-y-1.5 @xl:grid @xl:grid-cols-2 @xl:gap-4 @xl:space-y-0">
        <input type="hidden" name="pbmLinkPresent" value="1" />
        {excluded && (
          <input type="hidden" name="pinballmapExcluded" value="on" />
        )}
        {/* When the edition step is shown, the <select> below carries
          pinballmapMachineId (with native `required`); otherwise this hidden
          input does. */}
        {!needsEdition && (
          <input
            type="hidden"
            name="pinballmapMachineId"
            value={submittedId !== null ? String(submittedId) : ""}
          />
        )}

        {/* Model's label + trigger are wrapped so the root grid can lay Model and
          Edition side by side once the container is wide enough. Unlike the
          Name/Availability pairing on the form above, this one is semantic:
          Edition is meaningless without a Model, its control only appears once
          a Model with multiple editions is picked, and the second column is
          otherwise a placeholder reading "Pick a model first". Keeping them on
          one row is what makes that dependency legible. */}
        <div className="space-y-1.5">
          <Label
            htmlFor={excluded ? modelNameId : triggerId}
            className="text-foreground"
          >
            Model Details
          </Label>

          {/* Source gets its own line rather than riding the label row: it
              governs the whole group, and a control tucked in beside a label
              reads as subordinate to the thing it decides (Tim, 2026-08-27).
              The segmented control is the same one the Pinball Map block's
              Intent row uses below — real buttons in a radiogroup, so keyboard
              and screen-reader users get both positions (CORE-A11Y-004). */}
          <div className="flex items-center gap-2.5">
            <span
              id={sourceLabelId}
              className="text-[13px] leading-none text-muted-foreground"
            >
              Source:
            </span>
            <div
              role="radiogroup"
              aria-labelledby={sourceLabelId}
              className="inline-flex overflow-hidden rounded-lg border border-outline-variant"
              data-testid="pinballmap-source-toggle"
            >
              {SOURCE_OPTIONS.map((option) => {
                const selected = option.manual === excluded;
                return (
                  <button
                    key={option.testId}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => {
                      handleSetSource(option.manual);
                    }}
                    data-testid={option.testId}
                    className={cn(
                      "px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                      "border-l border-outline-variant first:border-l-0",
                      selected
                        ? "bg-primary/15 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted/50",
                      "disabled:pointer-events-none disabled:opacity-40"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* One control slot, two sources. Manual Entry REPLACES the catalog
              picker rather than leaving it live beside fields it can no longer
              fill — a picker that still searches while the machine is on manual
              is a control with nothing to do (PP-3bbr.3). */}
          {excluded ? (
            <Input
              id={modelNameId}
              name="modelName"
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                onDirty?.();
              }}
              maxLength={200}
              disabled={disabled}
              // Suggests the cabinet's name without filling it in — blank
              // already means "same as the name" (spec 2.4).
              placeholder={
                machineName.length > 0 ? machineName : "e.g. Bordertown"
              }
              className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
            />
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  id={triggerId}
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={open ? `${triggerId}-listbox` : undefined}
                  disabled={disabled}
                  data-testid="pinballmap-link-select"
                  className="w-full justify-between border-outline bg-surface text-foreground font-normal"
                >
                  <span
                    className={
                      family ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {family
                      ? `${family.name}${familyMeta ? ` · ${familyMeta}` : ""}`
                      : placeholderLabel}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                id={`${triggerId}-listbox`}
                className="w-(--radix-popover-trigger-width) p-0"
                align="start"
              >
                {/* shouldFilter={false}: results are already filtered server-side. */}
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="e.g. Medieval Madness"
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList>
                    {loading ? (
                      <div
                        role="status"
                        className="px-3 py-4 text-xs text-muted-foreground"
                      >
                        Searching…
                      </div>
                    ) : query.trim().length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground">
                        Type a title to search Pinball Map.
                      </div>
                    ) : results.length > 0 ? (
                      <CommandGroup>
                        {results.map((r) => {
                          const meta = formatMeta(r.manufacturer, r.year);
                          const key =
                            r.machineGroupId !== null
                              ? `g${r.machineGroupId}`
                              : `m${r.pinballmapMachineId}`;
                          return (
                            <CommandItem
                              key={key}
                              value={key}
                              onSelect={() => handlePickFamily(r)}
                            >
                              <div className="flex flex-col">
                                <span>
                                  {r.name}
                                  {r.editionCount > 1 && (
                                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                                      {r.editionCount} editions
                                    </span>
                                  )}
                                </span>
                                {meta.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {meta}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    ) : (
                      <p className="px-3 py-4 text-xs text-muted-foreground">
                        No Pinball Map match for “{query.trim()}”.
                      </p>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* The second column follows the source: Edition when the model comes
          from the catalog (meaningless without one), Manufacturer and Year when
          it is hand-entered. It is the slot the Reason box used to occupy —
          removing that write-only field is what freed it, so the three
          hand-entered fields fit on the Model row instead of needing a panel
          below it, and both sources render at the same height (PP-3bbr.3).

          `justify-end` because the left column is one row taller (it carries
          the Source line); without it this column's control floats above its
          neighbour instead of sitting level with it. */}
        <div className="flex flex-col justify-end gap-1.5">
          {/* Associate the label only with a control that actually renders: the
            manufacturer input when hand-entered, the edition select when one is
            needed. In the placeholder state neither exists, so the label is a
            plain caption (no htmlFor pointing at a non-existent id). */}
          <Label
            {...(excluded
              ? { htmlFor: manufacturerId }
              : needsEdition
                ? { htmlFor: editionId }
                : {})}
            className="text-xs text-muted-foreground"
          >
            {excluded ? "Manufacturer and year" : "Edition"}
            {needsEdition && !excluded && (
              <span aria-hidden="true" className="text-destructive-text">
                {" "}
                *
              </span>
            )}
          </Label>
          {excluded ? (
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
              <Input
                id={manufacturerId}
                name="manufacturer"
                value={manufacturer}
                onChange={(e) => {
                  setManufacturer(e.target.value);
                  onDirty?.();
                }}
                maxLength={100}
                disabled={disabled}
                placeholder="e.g. Williams"
                // Same surface treatment as every other input on this page.
                // Without it the shared Input base (`bg-input/30 border-input`)
                // renders dimmer than its neighbours and reads as disabled.
                className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
              />
              {/* `inputMode="numeric"` rather than `type="number"`: a spinner is
                useless for a four-digit year and Safari's stepper eats the
                field's width. It also brings up the numeric keypad on mobile,
                which is the real win.

                That choice costs the browser-side range check — `min`/`max` are
                inert on anything but `type="number"` — so `pattern` gives the
                browser the one thing it can still enforce (four digits) and the
                1930..next-year range stays the server's, where it was
                authoritative anyway.

                The visible label covers both inputs, so this one carries its
                own accessible name (CORE-A11Y). */}
              <Input
                id={yearId}
                name="year"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  onDirty?.();
                }}
                disabled={disabled}
                placeholder="1994"
                aria-label="Year"
                className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
              />
            </div>
          ) : needsEdition ? (
            <Select
              name="pinballmapMachineId"
              required
              // Do NOT disable while editions load: a disabled control is exempt
              // from native `required` validation, so disabling here would let the
              // form submit with no edition (silent un-linked save). Left enabled,
              // the empty required select blocks submit until an edition is picked.
              disabled={disabled}
              // Omit `value` entirely (not value={undefined}) when unset so the
              // placeholder shows — exactOptionalPropertyTypes forbids undefined.
              {...(selectedEditionId !== null
                ? { value: String(selectedEditionId) }
                : {})}
              onValueChange={(v) => {
                setSelectedEditionId(Number(v));
                markUserChanged();
                onDirty?.();
              }}
            >
              <SelectTrigger
                id={editionId}
                data-testid="pinballmap-edition-select"
                className="border-outline bg-surface text-foreground"
              >
                <SelectValue
                  placeholder={
                    editionsLoading ? "Loading editions…" : "Select an edition"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {editions.map((e) => {
                  const meta = formatMeta(e.manufacturer, e.year);
                  return (
                    <SelectItem
                      key={e.pinballmapMachineId}
                      value={String(e.pinballmapMachineId)}
                    >
                      {e.name}
                      {meta.length > 0 ? ` · ${meta}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <div
              data-testid="pinballmap-edition-placeholder"
              className="flex h-9 w-full items-center rounded-md border border-outline bg-surface px-3 text-sm text-muted-foreground"
            >
              {family ? "Only one edition" : "Pick a model first"}
            </div>
          )}
        </div>
      </div>

      {/* Switching to a catalog title drops everything typed above — the DB
          forbids a linked machine carrying a hand-entered model, so this is a
          real consequence rather than a preference. Confirm before the pick
          lands, not a toast after the save. */}
      <AlertDialog
        open={pendingFamily !== null}
        onOpenChange={(next) => {
          if (!next) setPendingFamily(null);
        }}
      >
        <AlertDialogContent data-testid="pinballmap-overwrite-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Use Pinball Map&apos;s details?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFamily
                ? `Linking this machine to “${pendingFamily.name}” replaces the model name, manufacturer and year you entered with Pinball Map's.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep what I entered</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                if (pendingFamily) applyFamily(pendingFamily);
                setPendingFamily(null);
              }}
            >
              Use Pinball Map&apos;s details
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
