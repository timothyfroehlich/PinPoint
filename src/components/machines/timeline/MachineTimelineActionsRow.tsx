"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";

import { MachineTimelineComposer } from "~/components/machines/timeline/MachineTimelineComposer";
import { MachineTimelineFilter } from "~/components/machines/timeline/MachineTimelineFilter";
import { Button } from "~/components/ui/button";
import type { TimelineTag } from "~/lib/timeline/machine-tags";

interface Props {
  machineId: string;
  currentTags: TimelineTag[];
  canCompose: boolean;
}

/**
 * Stitches the multi-select tag filter and the "+ New entry" trigger onto a
 * single row, and renders the controlled composer form below when expanded.
 * Owning the expand state here keeps the page component fully server-rendered.
 */
export function MachineTimelineActionsRow({
  machineId,
  currentTags,
  canCompose,
}: Props): React.ReactElement {
  const [composing, setComposing] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <MachineTimelineFilter currentTags={currentTags} />
        {canCompose && !composing ? (
          <Button
            variant="outline"
            onClick={() => {
              setComposing(true);
            }}
          >
            <Plus className="size-4" />
            New entry
          </Button>
        ) : null}
      </div>
      {canCompose && composing ? (
        <MachineTimelineComposer
          machineId={machineId}
          onCancel={() => {
            setComposing(false);
          }}
          onPosted={() => {
            setComposing(false);
          }}
        />
      ) : null}
    </div>
  );
}
