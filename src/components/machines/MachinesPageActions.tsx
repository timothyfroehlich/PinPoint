"use client";

import type React from "react";
import { MapPin, Plus } from "lucide-react";
import {
  PageActions,
  usePageExportEntry,
  type PageAction,
  type PageMenuEntry,
} from "~/components/list-view";

interface MachinesPageActionsProps {
  /** People who can open the Pinball Map lineup page (pinballmap-lineup §2.2). */
  canViewLineup: boolean;
  /** People machine-views 6.1 allows to add a machine. */
  canCreateMachine: boolean;
  /** People who can print apron cards (apron-cards §12.1). */
  canPrintApronCards: boolean;
  /** Cards in the member's apron print queue (apron-cards §13.4). */
  apronQueueCount: number;
}

/**
 * The Machines page's actions (machine-views §6.6–§6.8): Pinball Map, Add
 * Machine in its filled primary style, then ⋯ holding Export, Print
 * settings sheets, and Print apron cards with the print-queue count on that
 * entry only. Pinball Map folds into ⋯ first and Add Machine last.
 */
export function MachinesPageActions({
  canViewLineup,
  canCreateMachine,
  canPrintApronCards,
  apronQueueCount,
}: MachinesPageActionsProps): React.JSX.Element {
  const exportEntry = usePageExportEntry();
  const actions: PageAction[] = [];
  if (canViewLineup) {
    actions.push({
      key: "pinball-map",
      label: "Pinball Map",
      icon: MapPin,
      href: "/m/pinball-map",
      testId: "pinball-map-lineup-button",
    });
  }
  if (canCreateMachine) {
    actions.push({
      key: "add-machine",
      label: "Add Machine",
      icon: Plus,
      href: "/m/new",
      primary: true,
      testId: "add-machine-button",
    });
  }
  // Settings sheets are open to everyone (settings-sheets §2.1).
  const print: PageMenuEntry[] = [
    {
      key: "settings-sheets",
      label: "Print settings sheets",
      href: "/m/settings-sheets",
    },
  ];
  if (canPrintApronCards) {
    const queued = apronQueueCount > 0;
    print.push({
      key: "apron-cards",
      label: "Print apron cards",
      href: "/m/apron-cards",
      count: queued ? apronQueueCount : undefined,
      accessibleLabel: queued
        ? `Print apron cards, ${String(apronQueueCount)} in your print queue`
        : undefined,
    });
  }
  return (
    <PageActions
      actions={actions}
      menu={exportEntry ? [[exportEntry], print] : [print]}
      foldSteps={[["pinball-map"], ["add-machine"]]}
    />
  );
}
