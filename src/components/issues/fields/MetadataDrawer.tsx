"use client";

import type React from "react";
import { useState } from "react";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";

interface MetadataOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

interface MetadataDrawerProps<T extends string> {
  title: string;
  options: MetadataOption<T>[];
  currentValue: T;
  onSelect: (value: T) => void;
  trigger: React.ReactNode;
  disabled?: boolean;
}

export function MetadataDrawer<T extends string>({
  title,
  options,
  currentValue,
  onSelect,
  trigger,
  disabled,
}: MetadataDrawerProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: T): void => {
    onSelect(value);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild disabled={disabled}>
        {trigger}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            Select {title}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
          <div className="space-y-1">
            {options.map((option) => {
              const Icon = option.icon;
              const isSelected = option.value === currentValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-accent"
                      : "hover:bg-accent/50 active:bg-accent"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  {Icon && (
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full bg-muted",
                        option.iconColor
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="size-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
          <DrawerClose asChild>
            <Button variant="outline" className="mt-3 w-full">
              Cancel
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
