"use client";

import { Search, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SearchTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  debounceMs?: number;
}

export function SearchTextField({
  value,
  onChange,
  placeholder = "Search issues...",
  label = "Search",
  debounceMs = 300,
}: SearchTextFieldProps) {
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

  return (
    <div className="space-y-1 w-full min-w-[200px]">
      {label && (
        <Label htmlFor="search-input" className="text-sm font-medium">
          {label}
        </Label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="search-input"
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          data-testid="issue-search-input"
          className={cn(
            "pl-9",
            localValue && "pr-9"
          )}
        />
        {localValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-transparent"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
