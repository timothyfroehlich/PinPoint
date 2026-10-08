"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Star, Trophy } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { useIsMobile } from "~/hooks/use-is-mobile";
import {
  builtinSlotOf,
  SETTINGS_TAGS_HREF,
} from "~/lib/machines/settings-tags";
import type {
  SettingsPreferredSlot,
  SettingsTagRef,
} from "~/lib/machines/settings-types";
import {
  normalizeTagName,
  sameTagName,
  TAG_NAME_MAX,
  tagNameLength,
} from "~/lib/tags/names";
import { cn } from "~/lib/utils";

export interface SettingsTagPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The set being tagged, named in the panel's heading. */
  setName: string;
  /** Every settings tag, House and Tournament first (spec §3.7 order). */
  tags: SettingsTagRef[];
  /** Slugs of the tags the set carries. */
  appliedSlugs: ReadonlySet<string>;
  /** Which default slots the set holds (spec §4). */
  defaults: Record<SettingsPreferredSlot, boolean>;
  /** The viewer may create settings tags (spec §3.3). */
  canCreate: boolean;
  onToggleTag: (tag: SettingsTagRef, applied: boolean) => void;
  onToggleDefault: (slot: SettingsPreferredSlot) => void;
  /** Create a tag named `name` and apply it; resolves to an error or null. */
  onCreate: (name: string) => Promise<string | null>;
  /** The element the desktop popover opens beside (the set's ⋮ button). */
  children: React.ReactNode;
}

/**
 * The set card's tag picker (machine-settings §3.4, §4.3; approved design
 * PP-k3km.2): a filter that can also create a tag, one checkbox per settings
 * tag, and a Make default pill on House and Tournament. A popover on desktop
 * and a bottom sheet on phones — two component trees, so the swap reads
 * `useIsMobile` (the CORE-RESP-002 exception). Both trap focus.
 */
export function SettingsTagPicker({
  open,
  onOpenChange,
  children,
  ...panel
}: SettingsTagPickerProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const close = (): void => onOpenChange(false);

  return (
    <>
      <Popover open={open && !isMobile} onOpenChange={onOpenChange} modal>
        <PopoverAnchor asChild>{children}</PopoverAnchor>
        <PopoverContent
          align="end"
          collisionPadding={16}
          aria-labelledby={titleId}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border-outline-variant bg-card p-0"
        >
          <PickerPanel
            {...panel}
            title={
              <h2 id={titleId} className="text-base font-semibold">
                Tags
              </h2>
            }
            searchRef={searchRef}
            onClose={close}
          />
        </PopoverContent>
      </Popover>

      <Sheet open={open && isMobile} onOpenChange={onOpenChange}>
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
          <PickerPanel
            {...panel}
            title={<SheetTitle className="text-base">Tags</SheetTitle>}
            onClose={close}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

type PickerPanelProps = Omit<
  SettingsTagPickerProps,
  "open" | "onOpenChange" | "children"
> & {
  title: React.ReactNode;
  onClose: () => void;
  searchRef?: React.Ref<HTMLInputElement>;
};

function PickerPanel({
  title,
  onClose,
  searchRef,
  setName,
  tags,
  appliedSlugs,
  defaults,
  canCreate,
  onToggleTag,
  onToggleDefault,
  onCreate,
}: PickerPanelProps): React.JSX.Element {
  const id = useId();
  const [query, setQuery] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const name = normalizeTagName(query);
  const needle = name.toLowerCase();
  const length = tagNameLength(name);
  const tooLong = length > TAG_NAME_MAX;
  const offerCreate =
    canCreate &&
    name !== "" &&
    !tags.some((tag) => sameTagName(tag.name, name));
  const shown =
    needle === ""
      ? tags
      : tags.filter((tag) => tag.name.toLowerCase().includes(needle));
  const builtins = shown.filter((tag) => builtinSlotOf(tag.slug) !== null);
  const custom = shown.filter((tag) => builtinSlotOf(tag.slug) === null);

  function create(): void {
    const typed = query;
    setCreating(true);
    setCreateError(null);
    setQuery("");
    void onCreate(name).then((error) => {
      setCreating(false);
      if (error !== null) {
        setCreateError(error);
        setQuery(typed);
      }
    });
  }

  function row(tag: SettingsTagRef): React.JSX.Element {
    const slot = builtinSlotOf(tag.slug);
    const checked = appliedSlugs.has(tag.slug);
    const isDefault = slot !== null && defaults[slot];
    const inputId = `${id}-tag-${tag.slug}`;
    const hintId = `${inputId}-hint`;
    return (
      <div
        key={tag.slug}
        className="flex min-h-13 items-center gap-2 px-1 md:min-h-11"
      >
        <label
          htmlFor={inputId}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm text-foreground has-disabled:cursor-default"
        >
          <Checkbox
            id={inputId}
            checked={checked}
            disabled={isDefault}
            aria-describedby={isDefault ? hintId : undefined}
            onCheckedChange={(next) => onToggleTag(tag, next === true)}
          />
          <span className="flex min-w-0 flex-col">
            <span
              className={cn("truncate", isDefault && "text-muted-foreground")}
            >
              {tag.name}
            </span>
            {isDefault ? (
              <span id={hintId} className="text-xs text-muted-foreground">
                Kept while default
              </span>
            ) : null}
          </span>
        </label>
        {slot !== null ? (
          <DefaultPill
            slot={slot}
            tagName={tag.name}
            isDefault={isDefault}
            disabled={!checked}
            onClick={() => onToggleDefault(slot)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-baseline gap-2 px-4 pb-2 pt-3">
        {title}
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {setName}
        </span>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-b border-outline-variant px-4 pb-3">
        <label
          htmlFor={`${id}-search`}
          className="text-xs text-muted-foreground"
        >
          {canCreate ? "Find or create a tag" : "Find a tag"}
        </label>
        <div className="relative">
          <Input
            ref={searchRef}
            id={`${id}-search`}
            type="text"
            autoComplete="off"
            maxLength={TAG_NAME_MAX}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCreateError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && offerCreate && !tooLong) {
                event.preventDefault();
                create();
              }
            }}
            className={cn("h-11 md:h-9", canCreate && query !== "" && "pr-14")}
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
        {createError !== null ? (
          <p role="alert" className="text-sm text-destructive-text">
            {createError}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1">
        {builtins.map(row)}
        {builtins.length > 0 && custom.length > 0 ? (
          <div
            aria-hidden="true"
            className="mx-1 my-1 border-t border-outline-variant"
          />
        ) : null}
        {custom.map(row)}
        {shown.length === 0 && !offerCreate ? (
          <p className="mx-1 my-3 text-sm text-muted-foreground">
            No matching tags
          </p>
        ) : null}
      </div>

      {offerCreate ? (
        <div className="shrink-0 border-t border-outline-variant px-3 py-1.5">
          {tooLong ? (
            <p role="alert" className="px-1 py-2 text-sm text-destructive-text">
              Name over {TAG_NAME_MAX} characters
            </p>
          ) : (
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="inline-flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-md px-1 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60 motion-reduce:transition-none"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Create “{name}”</span>
            </button>
          )}
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-outline-variant px-4 py-2.5">
        <Link
          href={SETTINGS_TAGS_HREF}
          className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline md:min-h-8"
        >
          All settings tags
        </Link>
        <Button type="button" onClick={onClose} className="h-11 px-5 md:h-9">
          Done
        </Button>
      </div>
    </>
  );
}

function DefaultPill({
  slot,
  tagName,
  isDefault,
  disabled,
  onClick,
}: {
  slot: SettingsPreferredSlot;
  tagName: string;
  isDefault: boolean;
  disabled: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const Icon = slot === "house" ? Star : Trophy;
  return (
    <button
      type="button"
      aria-pressed={isDefault}
      disabled={disabled}
      onClick={onClick}
      aria-label={
        isDefault
          ? `Default ${tagName} set. Clear default`
          : `Make default ${tagName} set`
      }
      title={disabled ? `Tag the set ${tagName} first` : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors motion-reduce:transition-none md:h-7 md:px-2.5",
        // A 44px tap target on phones without a taller pill.
        "relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] md:before:hidden",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isDefault
          ? slot === "house"
            ? "border-warning/40 bg-warning/15 text-warning"
            : "border-primary bg-primary text-primary-foreground"
          : "border-outline-variant text-muted-foreground hover:bg-muted"
      )}
    >
      {isDefault ? <Icon className="size-3" aria-hidden="true" /> : null}
      {isDefault ? "Default" : "Make default"}
    </button>
  );
}
