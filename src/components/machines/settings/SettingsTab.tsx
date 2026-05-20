"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  SettingsSetCard,
  type SettingsSetData,
} from "~/components/machines/settings/SettingsSetCard";

// ---------------------------------------------------------------------------
// Hardcoded scaffold data — replaced by DB query once schema lands (PP-43q3)
// ---------------------------------------------------------------------------
const SAMPLE_SETS: SettingsSetData[] = [
  {
    id: "set-1",
    name: "Standard House",
    isPreferred: true,
    updatedBy: "Bob",
    updatedAt: "2026-05-12",
    description:
      "Our **day-to-day** setup — slightly harder than factory but accessible. See [2026 league rules](#).",
    baseline: { group: "Stern", value: "Competition Install" },
    softwareSettings: [
      { id: "S-001", name: "Replay score", value: "700,000,000" },
      { id: "S-014", name: "Tilt warnings", value: "2" },
      { id: "S-021", name: "Balls per game", value: "3" },
      { id: "S-040", name: "Free play", value: "On" },
    ],
    dipSwitches: [
      { bank: "MPU", switch: "DS1", position: "ON", note: "Free play" },
      {
        bank: "MPU",
        switch: "DS3",
        position: "ON",
        note: "3-ball game (off = 5-ball)",
      },
      { bank: "MPU", switch: "DS7", position: "OFF", note: "Match disabled" },
    ],
    rubbers:
      '**Install:** 3/8" silicone on outlane posts. Leave everything else stock.',
    postPositions: "Outlane posts — **middle hole**. Center post installed.",
    notes:
      "Right scoop has a slight kickout issue — we've been logging it as [issue #142](#). No impact on gameplay; just flag if it gets worse.",
  },
  {
    id: "set-2",
    name: "Friday Tournament",
    isPreferred: false,
    updatedBy: "Alice",
    updatedAt: "2026-05-12",
    description: "Tightened for league night — tilt sensitive, no extra balls.",
    baseline: { group: "Stern", value: "Competition Install" },
    softwareSettings: [
      { id: "S-001", name: "Replay score", value: "800,000,000" },
      { id: "S-014", name: "Tilt warnings", value: "1" },
      { id: "S-021", name: "Balls per game", value: "3" },
      { id: "S-030", name: "Extra ball award", value: "Off" },
      { id: "S-041", name: "Match feature", value: "Off" },
    ],
    dipSwitches: [],
    rubbers: "Same as Standard House.",
    postPositions: "Outlane posts — **top hole** (tighter lane).",
    notes: "Review ball times after each league session.",
  },
];

interface SettingsTabProps {
  canEdit: boolean;
}

export function SettingsTab({ canEdit }: SettingsTabProps): React.JSX.Element {
  // Set 1 expanded by default; set 2 collapsed
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set([SAMPLE_SETS[0]!.id])
  );
  const [sets, setSets] = useState<SettingsSetData[]>(SAMPLE_SETS);

  function toggleExpand(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function togglePreferred(id: string): void {
    // Exclusive — selecting a set as preferred unsets all others
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        isPreferred: s.id === id ? !s.isPreferred : false,
      }))
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Game settings{" "}
          <span className="text-muted-foreground">
            · {String(sets.length)} set{sets.length !== 1 ? "s" : ""}
          </span>
        </p>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              /* no-op scaffold */
            }}
          >
            <Plus aria-hidden="true" />
            New set
          </Button>
        )}
      </div>

      {/* Set cards */}
      <div className="space-y-3">
        {sets.map((set) => (
          <SettingsSetCard
            key={set.id}
            set={set}
            isExpanded={expandedIds.has(set.id)}
            canEdit={canEdit}
            onToggleExpand={() => {
              toggleExpand(set.id);
            }}
            onTogglePreferred={() => {
              togglePreferred(set.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
