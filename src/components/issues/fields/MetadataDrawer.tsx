import type React from "react";
import { type ElementType } from "react";
import { Check } from "lucide-react";
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

export interface MetadataDrawerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ElementType;
  iconColor?: string;
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
  disabled,
}: MetadataDrawerProps<T>): React.JSX.Element {
  return (
    <Drawer>
      <DrawerTrigger asChild disabled={disabled}>
        {trigger}
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Select {title}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pb-0">
            <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto">
              {options.map((option) => {
                const Icon = option.icon;
                const isSelected = option.value === currentValue;

                return (
                  <DrawerClose asChild key={option.value}>
                    <button
                      type="button"
                      onClick={() => onSelect(option.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50",
                        isSelected && "bg-muted/50"
                      )}
                    >
                      {Icon && (
                        <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-background border shadow-sm">
                          <Icon className={cn("w-4 h-4", option.iconColor)} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground">
                          {option.label}
                        </div>
                        {option.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  </DrawerClose>
                );
              })}
            </div>
          </div>
          <div className="p-4 mt-4">
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                Cancel
              </Button>
            </DrawerClose>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
