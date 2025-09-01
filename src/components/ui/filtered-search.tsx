/**
 * Filtered Search Component
 * Optimized for use within complex filtering systems like issue filters
 * 
 * Features:
 * - Controlled component pattern for predictable state management
 * - Debounced input to prevent excessive filter updates
 * - Clean integration with filter toolbars
 * - No URL state management (handled by parent components)
 * - Minimal UI that doesn't compete with other filter controls
 */

"use client";

import { Search, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface FilteredSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  debounceMs?: number;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "default";
}

export function FilteredSearch({
  value,
  onChange,
  placeholder = "Search...",
  label = "Search",
  debounceMs = 300,
  disabled = false,
  className = "",
  showLabel = false,
  size = "default",
}: FilteredSearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange handler
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return (): void => {
      clearTimeout(timer);
    };
  }, [localValue, value, onChange, debounceMs]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setLocalValue(event.target.value);
    },
    [],
  );

  const handleClear = useCallback((): void => {
    setLocalValue("");
    onChange("");
  }, [onChange]);

  const inputId = `filtered-search-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={cn("w-full", size === "sm" ? "min-w-[160px]" : "min-w-[200px]", className)}>
      {showLabel && label && (
        <Label htmlFor={inputId} className="text-sm font-medium mb-1 block">
          {label}
        </Label>
      )}
      <div className="relative">
        <Search className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
          size === "sm" ? "h-3 w-3" : "h-4 w-4"
        )} />
        <Input
          id={inputId}
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          data-testid="filtered-search-input"
          className={cn(
            size === "sm" ? "pl-8 h-8" : "pl-9",
            localValue && (size === "sm" ? "pr-8" : "pr-9")
          )}
        />
        {localValue && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 p-0 hover:bg-transparent",
              size === "sm" ? "right-1 h-5 w-5" : "right-1 h-6 w-6"
            )}
            aria-label="Clear search"
          >
            <X className={cn(
              "text-muted-foreground hover:text-foreground",
              size === "sm" ? "h-3 w-3" : "h-4 w-4"
            )} />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact variant for use in dense filter toolbars
 */
export function FilteredSearchCompact(props: Omit<FilteredSearchProps, "size" | "showLabel">) {
  return <FilteredSearch {...props} size="sm" showLabel={false} />;
}

/**
 * Variant with visible label for standalone use
 */
export function FilteredSearchWithLabel(props: Omit<FilteredSearchProps, "showLabel">) {
  return <FilteredSearch {...props} showLabel={true} />;
}