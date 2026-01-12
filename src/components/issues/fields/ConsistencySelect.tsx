"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CONSISTENCY_CONFIG } from "~/lib/issues/status";
import { type IssueConsistency } from "~/lib/types";

interface ConsistencySelectProps {
  value: IssueConsistency;
  onValueChange: (value: IssueConsistency) => void;
  disabled?: boolean;
  name?: string;
  testId?: string;
}

const consistencyOptions: IssueConsistency[] = [
  "intermittent",
  "frequent",
  "constant",
];

export function ConsistencySelect({
  value,
  onValueChange,
  disabled = false,
  name = "consistency",
  testId = "issue-consistency-select",
}: ConsistencySelectProps): React.JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger
        className="w-full border-outline-variant bg-surface text-on-surface"
        aria-label="Select Consistency"
        data-testid={testId}
      >
        <SelectValue>
          {(() => {
            const config = CONSISTENCY_CONFIG[value];
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
        {consistencyOptions.map((consistency) => {
          const config = CONSISTENCY_CONFIG[consistency];
          const Icon = config.icon;
          return (
            <SelectItem
              key={consistency}
              value={consistency}
              data-testid={`consistency-option-${consistency}`}
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
