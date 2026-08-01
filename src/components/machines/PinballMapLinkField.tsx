"use client";

import React, { useEffect, useId, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
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
 * - `pinballmapExcluded=on` + `pinballmapExcludedReason` — the "not on
 *   PinballMap" flag and its optional reason.
 *
 * Link and excluded are mutually exclusive in the UI (selecting one clears the
 * other), mirroring the DB CHECK.
 */

interface PinballMapLinkFieldProps {
  defaultMachineId?: number | null;
  /** Display name of the currently-linked title (resolved from the mirror), if any. */
  defaultName?: string | null;
  defaultExcluded?: boolean;
  defaultExcludedReason?: string | null;
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

function formatMeta(manufacturer: string | null, year: number | null): string {
  return [manufacturer, year !== null ? String(year) : null]
    .filter((v): v is string => v !== null && v.length > 0)
    .join(" · ");
}

export function PinballMapLinkField({
  defaultMachineId = null,
  defaultName = null,
  defaultExcluded = false,
  defaultExcludedReason = null,
  disabled = false,
  onDirty,
}: PinballMapLinkFieldProps): React.JSX.Element {
  const reasonId = useId();
  const triggerId = useId();
  const editionId = useId();

  const [family, setFamily] = useState<CatalogFamily | null>(null);
  const [editions, setEditions] = useState<CatalogEdition[]>([]);
  const [selectedEditionId, setSelectedEditionId] = useState<number | null>(
    null
  );
  const [editionsLoading, setEditionsLoading] = useState(false);

  const [excluded, setExcluded] = useState(defaultExcluded);
  const [reason, setReason] = useState(defaultExcludedReason ?? "");

  // Whether the USER has changed the selection. Until they do, the form submits
  // the machine's STORED link — see `submittedId`.
  const [userChanged, setUserChanged] = useState(false);

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
  useEffect(() => {
    if (defaultMachineId === null) return;
    let active = true;
    void resolvePinballMapLinkAction(defaultMachineId)
      .then((resolved) => {
        if (active && resolved) {
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

  const handlePickFamily = (pick: CatalogFamily): void => {
    setFamily(pick);
    setExcluded(false); // mutual exclusion
    setOpen(false);
    setQuery("");
    setUserChanged(true);
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

  // Choosing "Not on PinballMap" from the Model dropdown. Mutually exclusive
  // with a catalog link, and a machine that isn't on the map can't be listed.
  const handlePickExcluded = (): void => {
    setExcluded(true);
    setFamily(null);
    setEditions([]);
    setSelectedEditionId(null);
    setOpen(false);
    setQuery("");
    setUserChanged(true);
    onDirty?.();
  };

  // The edition step is shown only for an ambiguous (multi-edition) family.
  const needsEdition =
    family !== null &&
    family.pinballmapMachineId === null &&
    family.editionCount > 1;

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
   * its catalog row has since disappeared, `resolvePbmLinkColumns` rejects the
   * save with "no longer in the catalog — search again", which is the honest
   * failure (CORE-ARCH-012) rather than a silent wipe.
   */
  const submittedId = userChanged ? resolvedId : defaultMachineId;

  const familyMeta = family ? formatMeta(family.manufacturer, family.year) : "";
  // While an existing link resolves on edit, show its known name; otherwise prompt.
  const placeholderLabel =
    defaultMachineId !== null && defaultName
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
            htmlFor={triggerId}
            className="flex items-baseline gap-2 text-foreground"
          >
            Model
            <span className="text-xs font-normal text-muted-foreground">
              source: Pinball Map
            </span>
          </Label>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                id={triggerId}
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={disabled}
                data-testid="pinballmap-link-select"
                className="w-full justify-between border-outline bg-surface text-foreground font-normal"
              >
                <span
                  className={
                    family || excluded
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {family
                    ? `${family.name}${familyMeta ? ` · ${familyMeta}` : ""}`
                    : excluded
                      ? "Not on Pinball Map"
                      : placeholderLabel}
                </span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
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
                    // Searched with no match → surface the "Not on PinballMap"
                    // fallback here (not before someone has looked), so the choice
                    // only appears once the catalog has actually come up empty.
                    <>
                      <p className="px-3 pt-3 pb-1 text-xs text-muted-foreground">
                        No Pinball Map match for “{query.trim()}”.
                      </p>
                      <CommandGroup>
                        <CommandItem
                          value="__not_on_pinballmap__"
                          onSelect={handlePickExcluded}
                          data-testid="pinballmap-not-on-map"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              Not on Pinball Map
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Pinball Map only maps standard pinball machines —
                              pick this for novelty or non-pinball games it
                              won&apos;t list.
                            </span>
                          </div>
                        </CommandItem>
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Edition / Reason — one always-present slot so the field never reflows.
          It's the required edition picker for an ambiguous multi-edition family;
          when the machine is marked Not on PinballMap it becomes the reason
          input instead; otherwise it's a disabled slot with contextual text.
          The select carries pinballmapMachineId natively when shown; otherwise
          the hidden input above does. */}
        </div>

        <div className="space-y-1.5">
          {/* Associate the label only with a control that actually renders: the
            reason input when excluded, the edition select when one is needed.
            In the placeholder state neither exists, so the label is a plain
            caption (no htmlFor pointing at a non-existent id). */}
          <Label
            {...(excluded
              ? { htmlFor: reasonId }
              : needsEdition
                ? { htmlFor: editionId }
                : {})}
            className="text-xs text-muted-foreground"
          >
            {excluded ? "Reason (optional)" : "Edition"}
            {needsEdition && !excluded && (
              <span aria-hidden="true" className="text-destructive-text">
                {" "}
                *
              </span>
            )}
          </Label>
          {excluded ? (
            <Input
              id={reasonId}
              name="pinballmapExcludedReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. novelty game, not real pinball"
              maxLength={200}
              disabled={disabled}
              // Same surface treatment as every other input on this page. Without
              // it the shared Input base (`bg-input/30 border-input`) renders
              // dimmer than its neighbours and reads as disabled.
              className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
              aria-label="Reason this machine is not on Pinball Map"
            />
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
                setUserChanged(true);
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
    </div>
  );
}
