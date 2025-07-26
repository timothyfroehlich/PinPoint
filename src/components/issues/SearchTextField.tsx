"use client";

import { Search } from "@mui/icons-material";
import { TextField, InputAdornment } from "@mui/material";
import { useState, useEffect, useCallback } from "react";

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
}: SearchTextFieldProps): React.JSX.Element {
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
    <TextField
      value={localValue}
      onChange={handleChange}
      label={label}
      placeholder={placeholder}
      size="small"
      fullWidth
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search color="action" />
            </InputAdornment>
          ),
          endAdornment: localValue ? (
            <InputAdornment position="end">
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "rgba(0, 0, 0, 0.54)",
                  fontSize: "18px",
                  lineHeight: 1,
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={{
        minWidth: 200,
        "& .MuiInputBase-root": {
          paddingRight: localValue ? "8px" : "14px",
        },
      }}
    />
  );
}
