"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PRIORITY_CONFIG } from "~/lib/issues/status";
import { type IssuePriority } from "~/lib/types";

interface PrioritySelectProps {
  value: IssuePriority | "";
  onValueChange: (value: IssuePriority) => void;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  testId?: string;
}

const priorityOptions: IssuePriority[] = ["low", "medium", "high"];

export function PrioritySelect({
  value,
  onValueChange,
  disabled = false,
  name = "priority",
  placeholder = "Select priority...",
  testId = "issue-priority-select",
}: PrioritySelectProps): React.JSX.Element {
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
            ? `Priority: ${PRIORITY_CONFIG[value].label}`
            : "Select Priority"
        }
        data-testid={testId}
      >
        <SelectValue placeholder={placeholder}>
          {value &&
            (() => {
              const config = PRIORITY_CONFIG[value];
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
        {priorityOptions.map((priority) => {
          const config = PRIORITY_CONFIG[priority];
          const Icon = config.icon;
          return (
            <SelectItem
              key={priority}
              value={priority}
              data-testid={`priority-option-${priority}`}
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
