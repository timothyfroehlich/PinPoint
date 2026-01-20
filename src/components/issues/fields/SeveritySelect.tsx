"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import { type IssueSeverity } from "~/lib/types";

interface SeveritySelectProps {
  value: IssueSeverity;
  onValueChange: (value: IssueSeverity) => void;
  disabled?: boolean;
  name?: string;
  testId?: string;
}

const severityOptions: IssueSeverity[] = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
];

export function SeveritySelect({
  value,
  onValueChange,
  disabled = false,
  name = "severity",
  testId = "issue-severity-select",
}: SeveritySelectProps): React.JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger
        className="w-full border-outline-variant bg-surface text-on-surface"
        aria-label={`Severity: ${SEVERITY_CONFIG[value].label}`}
        data-testid={testId}
      >
        <SelectValue>
          {(() => {
            const config = SEVERITY_CONFIG[value];
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
        {severityOptions.map((severity) => {
          const config = SEVERITY_CONFIG[severity];
          const Icon = config.icon;
          return (
            <SelectItem
              key={severity}
              value={severity}
              data-testid={`severity-option-${severity}`}
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
