"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";

import { MachineTimelineComposer } from "~/components/machines/timeline/MachineTimelineComposer";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

interface Props {
  machineId: string;
  machineName: string;
}

/**
 * "New Note" entry point for the machine header.
 *
 * Opens the timeline composer in a bottom sheet (design-bible §17 — composer
 * surfaces use a bottom sheet on mobile so the editor + Post button clear the
 * keyboard and the affordance is reachable without scrolling). On desktop the
 * same bottom sheet is centered to a comfortable max-width rather than running
 * full-bleed.
 *
 * The composer's server action revalidates the machine routes, so the timeline
 * and the overview "Recent activity" section refresh once the sheet closes.
 */
export function MachineNoteComposerSheet({
  machineId,
  machineName,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Plus className="size-4" />
          New Note
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2 md:rounded-t-xl"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>New note</SheetTitle>
          <SheetDescription>
            Jot what you did to {machineName}. Tap{" "}
            <span className="font-semibold">Aa</span> for headings, lists, and
            links.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <MachineTimelineComposer
            machineId={machineId}
            autoFocus
            onCancel={() => {
              setOpen(false);
            }}
            onPosted={() => {
              setOpen(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
