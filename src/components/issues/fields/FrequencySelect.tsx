"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FREQUENCY_CONFIG } from "~/lib/issues/status";
import { type IssueFrequency } from "~/lib/types";

interface FrequencySelectProps {
  value: IssueFrequency | "";
  onValueChange: (value: IssueFrequency) => void;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  testId?: string;
}

const frequencyOptions: IssueFrequency[] = [
  "intermittent",
  "frequent",
  "constant",
];

export function FrequencySelect({
  value,
  onValueChange,
  disabled = false,
  name = "frequency",
  placeholder = "Select frequency...",
  testId = "issue-frequency-select",
}: FrequencySelectProps): React.JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger
        className="w-full border-outline-variant bg-surface text-on-surface"
        aria-label={
          value
            ? `Frequency: ${FREQUENCY_CONFIG[value].label}`
            : "Select Frequency"
        }
        data-testid={testId}
      >
        <SelectValue placeholder={placeholder}>
          {value &&
            (() => {
              const config = FREQUENCY_CONFIG[value];
              const Icon = config.icon;
              return (
                <div className="flex items-center gap-2">
                  <Icon className={`size-4 ${config.iconColor}`} />
                  <span>{config.label}</span>
                </div>
              );
            })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {frequencyOptions.map((frequency) => {
          const config = FREQUENCY_CONFIG[frequency];
          const Icon = config.icon;
          return (
            <SelectItem
              key={frequency}
              value={frequency}
              data-testid={`frequency-option-${frequency}`}
            >
              <Icon className={`size-4 ${config.iconColor}`} />
              <span>{config.label}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
