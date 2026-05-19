"use client";

import type React from "react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";

interface BaselineSelectProps {
  value: string;
  onChange?: (value: string) => void;
}

const BASELINE_GROUPS: { label: string; options: string[] }[] = [
  {
    label: "Stern",
    options: [
      "Factory Install",
      "Home Install",
      "Competition Install",
      "Extra Hard Install",
    ],
  },
  {
    label: "Bally / Williams",
    options: [
      "Extra Easy",
      "Easy",
      "Medium",
      "Hard",
      "Extra Hard",
      "3-ball",
      "5-ball",
    ],
  },
  {
    label: "Other",
    options: ["Other..."],
  },
];

// Format value as "Group · Option" for display in the trigger
function formatDisplayValue(raw: string): string {
  for (const group of BASELINE_GROUPS) {
    for (const opt of group.options) {
      if (opt === "Other...") continue;
      const encoded = `${group.label}__${opt}`;
      if (encoded === raw) return `${group.label} · ${opt}`;
    }
  }
  if (raw === "Other...") return "Other...";
  // Custom free-text value
  if (raw.startsWith("custom__")) return raw.slice(8);
  return raw;
}

export function BaselineSelect({
  value,
  onChange,
}: BaselineSelectProps): React.JSX.Element {
  const isCustom = value === "Other..." || value.startsWith("custom__");
  const [customText, setCustomText] = useState(
    value.startsWith("custom__") ? value.slice(8) : ""
  );

  function handleSelectChange(newVal: string): void {
    if (newVal === "Other...") {
      onChange?.("Other...");
    } else {
      onChange?.(newVal);
    }
  }

  function handleCustomBlur(): void {
    if (customText) {
      onChange?.(`custom__${customText}`);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={value} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-56 text-sm">
          <SelectValue>
            <span>{formatDisplayValue(value) || "Select baseline…"}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {BASELINE_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((opt) => {
                const encoded =
                  opt === "Other..." ? "Other..." : `${group.label}__${opt}`;
                return (
                  <SelectItem key={encoded} value={encoded}>
                    {opt}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {isCustom && (
        <Input
          className="w-56 text-sm"
          placeholder="Describe the baseline…"
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
          }}
          onBlur={handleCustomBlur}
        />
      )}
    </div>
  );
}
