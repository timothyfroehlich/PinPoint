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
  disabled?: boolean;
}

/**
 * Bottom-sheet picker for an issue field on phones. Built to fit a 320×568
 * screen without scrolling: a one-line header, small group labels, and the
 * options as a two-column grid of 44px tiles (spec issue-detail §13.2).
 */
export function MetadataDrawer<T extends string>({
  title,
  options,
  currentValue,
  onSelect,
  trigger,
  disabled = false,
}: MetadataDrawerProps<T>): React.JSX.Element {
  return (
    <Drawer>
      <DrawerTrigger asChild disabled={disabled}>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-h-[85vh] w-full max-w-md">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 px-4 py-0 text-left">
          <DrawerTitle className="text-base">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Choose a new {title.toLowerCase()} value.
          </DrawerDescription>
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
        <div className="space-y-2.5 overflow-y-auto px-4 pb-4">
          {groupOptions(options).map(({ group, items }) => (
            <div key={group ?? "options"} className="space-y-1">
              {group ? (
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((option) => {
                  const Icon = option.icon;
                  const isSelected = option.value === currentValue;
                  return (
                    <DrawerClose asChild key={option.value}>
                      <button
                        type="button"
                        data-testid={option.testId}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-left text-sm font-medium leading-tight transition-colors duration-150",
                          "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-outline-variant bg-background text-foreground"
                        )}
                        onClick={() => onSelect(option.value)}
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
                    </DrawerClose>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
