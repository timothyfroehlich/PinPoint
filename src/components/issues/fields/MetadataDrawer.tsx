"use client";

import type React from "react";
import { Check } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface MetadataDrawerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ElementType;
  iconColor?: string;
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
        <DrawerHeader className="space-y-2 text-left">
          <DrawerTitle className="text-lg">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Choose a new {title.toLowerCase()} value.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-2 overflow-y-auto px-4 pb-4">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === currentValue;

            return (
              <DrawerClose asChild key={option.value}>
                <button
                  type="button"
                  data-testid={option.testId}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  )}
                  onClick={() => onSelect(option.value)}
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted",
                      isSelected && "bg-primary/10"
                    )}
                  >
                    {Icon ? (
                      <Icon
                        className={cn(
                          "size-4",
                          option.iconColor,
                          isSelected && "text-primary"
                        )}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">
                      {option.label}
                    </div>
                    {option.description ? (
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    ) : null}
                  </div>
                  <Check
                    className={cn(
                      "size-4 shrink-0 text-primary transition-opacity",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                </button>
              </DrawerClose>
            );
          })}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
