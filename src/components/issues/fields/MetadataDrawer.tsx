"use client";

import React from "react";
import { X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { groupOptions } from "~/components/issues/fields/group-options";
import { cn } from "~/lib/utils";

interface MetadataDrawerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ElementType;
  iconColor?: string;
  /** Options sharing a group render under one heading, in order. */
  group?: string;
  testId?: string;
}

interface MetadataDrawerProps<T extends string> {
  title: string;
  options: MetadataDrawerOption<T>[];
  currentValue: T;
  onSelect: (value: T) => void;
  trigger: React.ReactNode;
  /** While a save is in flight the trigger stays focusable but won't open. */
  disabled?: boolean;
}

/**
 * The one-line header of an issue field's bottom sheet: the field's name and a
 * close button (spec issue-detail §13.2). Shared by the enum pickers and the
 * Assignee picker so every field sheet has the same chrome.
 */
export function FieldDrawerHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <DrawerHeader className="flex flex-row items-center justify-between gap-2 px-4 py-0 text-left">
      <DrawerTitle className="text-base">{title}</DrawerTitle>
      <DrawerDescription className="sr-only">{description}</DrawerDescription>
      <DrawerClose asChild>
        <button
          type="button"
          aria-label="Close"
          className="-mr-3 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </DrawerClose>
    </DrawerHeader>
  );
}

/** Classes for a field sheet's content: capped to the dynamic viewport. */
export const fieldDrawerContentClassName =
  "mx-auto max-h-[85dvh] w-full max-w-md";

/**
 * Bottom-sheet picker for an issue field on phones. Built to fit a 320×568
 * screen without scrolling: a one-line header, small group labels, and the
 * options as a two-column grid of 44px tiles (spec issue-detail §13.2).
 *
 * Each group is a radio group; opening the sheet focuses the current value.
 */
export function MetadataDrawer<T extends string>({
  title,
  options,
  currentValue,
  onSelect,
  trigger,
  disabled = false,
}: MetadataDrawerProps<T>): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const selectedRef = React.useRef<HTMLButtonElement>(null);
  const idPrefix = React.useId();

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next && disabled) return;
        setOpen(next);
      }}
    >
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className={fieldDrawerContentClassName}
        // vaul doesn't move focus into a drawer by default; start on the
        // current value.
        onOpenAutoFocus={(event) => {
          if (selectedRef.current) {
            event.preventDefault();
            selectedRef.current.focus();
          }
        }}
      >
        <FieldDrawerHeader
          title={title}
          description={`Choose a new ${title.toLowerCase()} value.`}
        />
        <div className="space-y-2.5 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {groupOptions(options).map(({ group, items }, index) => {
            const labelId = `${idPrefix}-group-${index}`;
            return (
              <div key={group ?? "options"} className="space-y-1">
                {group ? (
                  <div
                    id={labelId}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group}
                  </div>
                ) : null}
                <div
                  role="radiogroup"
                  {...(group
                    ? { "aria-labelledby": labelId }
                    : { "aria-label": title })}
                  className="grid grid-cols-2 gap-1.5"
                >
                  {items.map((option) => {
                    const Icon = option.icon;
                    const isSelected = option.value === currentValue;
                    return (
                      <button
                        key={option.value}
                        ref={isSelected ? selectedRef : undefined}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={option.testId}
                        className={cn(
                          "flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-left text-sm font-medium leading-tight transition-colors duration-150",
                          "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-outline-variant bg-background text-foreground"
                        )}
                        onClick={() => {
                          setOpen(false);
                          onSelect(option.value);
                        }}
                      >
                        {Icon ? (
                          <Icon
                            className={cn("size-4 shrink-0", option.iconColor)}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="min-w-0 break-words">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
