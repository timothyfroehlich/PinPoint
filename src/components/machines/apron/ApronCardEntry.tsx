"use client";

import type React from "react";
import { useState } from "react";
import { AlertTriangle, CreditCard } from "lucide-react";

import { Button } from "~/components/ui/button";
import { APRON_CARD_SIZES } from "~/lib/machines/apron-card";
import {
  ApronCardEditor,
  draftContent,
  type ApronCardDraft,
  type ApronCardIdentity,
} from "./ApronCardEditor";
import { ApronCardExportMenu } from "./ApronCardExportMenu";
import { ApronCardPreview } from "./ApronCardPreview";

export interface ApronCardEntryProps {
  /** `rail`: Service tab block. `row`: Manage tab row. Same editor (§3.1). */
  variant: "rail" | "row";
  machineId: string;
  machineInitials: string;
  identity: ApronCardIdentity;
  mainDescription: string;
  saved: ApronCardDraft;
  savedAt: string | null;
  scanUrl: string;
  canEdit: boolean;
  canExport: boolean;
}

function summary(saved: ApronCardDraft): string | null {
  if (saved.size === null) return null;
  return [
    APRON_CARD_SIZES[saved.size].label,
    saved.useCustomDescription ? "card description" : "machine description",
    saved.tipEnabled ? "tip on" : "tip off",
  ].join(" · ");
}

/**
 * Entry point to a machine's apron card: a thumbnail of the saved card, its
 * settings in one line, Edit card (editors) and Export (members, spec §9.3).
 */
export function ApronCardEntry({
  variant,
  canEdit,
  canExport,
  ...card
}: ApronCardEntryProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  // The saved card can stop fitting after it was saved (e.g. the machine's
  // main description grew on the Info tab), so re-check it here: a card that
  // does not fit cannot be exported (spec §3.5).
  const [overflowing, setOverflowing] = useState(false);
  const { saved, savedAt } = card;
  const savedContent = draftContent(card.identity, card.mainDescription, saved);
  const exportable = savedAt !== null && saved.size !== null && !overflowing;

  const thumbnail =
    saved.size === null ? (
      <div className="flex aspect-[529/283] w-full items-center justify-center rounded-lg border border-dashed border-outline-variant text-xs text-muted-foreground">
        No card size set
      </div>
    ) : (
      <div className="overflow-hidden rounded-lg border border-outline-variant">
        <ApronCardPreview
          content={savedContent}
          size={saved.size}
          scanUrl={card.scanUrl}
          onOverflowChange={setOverflowing}
        />
      </div>
    );

  const overflowNotice =
    overflowing && saved.size !== null ? (
      <p className="flex items-center gap-1.5 text-xs text-warning">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Text too long for the card
      </p>
    ) : null;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(true);
          }}
        >
          Edit card
        </Button>
      ) : null}
      {canExport ? (
        <ApronCardExportMenu
          machineInitials={card.machineInitials}
          content={savedContent}
          size={saved.size}
          scanUrl={card.scanUrl}
          disabled={!exportable}
        />
      ) : null}
    </div>
  );

  return (
    <>
      {variant === "rail" ? (
        <section
          className="rounded-xl border border-outline-variant bg-card p-4"
          aria-labelledby="apron-card-heading"
          data-testid="apron-card-entry"
        >
          <h2
            id="apron-card-heading"
            className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
          >
            <CreditCard className="size-3.5 text-primary" aria-hidden="true" />
            Apron card
          </h2>
          {thumbnail}
          {summary(saved) ? (
            <p className="mt-2.5 text-xs text-muted-foreground">
              {summary(saved)}
            </p>
          ) : null}
          {overflowNotice ? (
            <div className="mt-1.5">{overflowNotice}</div>
          ) : null}
          <div className="mt-2.5">{actions}</div>
        </section>
      ) : (
        <section
          className="space-y-4 border-t border-outline-variant pt-6"
          aria-labelledby="section-apron-card"
          data-testid="apron-card-entry"
        >
          <h2 id="section-apron-card" className="text-base font-semibold">
            Apron card
          </h2>
          <div className="@container">
            <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:gap-4">
              <div className="w-full shrink-0 @lg:w-56">{thumbnail}</div>
              <div className="flex min-w-0 flex-col gap-2.5">
                {summary(saved) ? (
                  <p className="text-sm text-muted-foreground">
                    {summary(saved)}
                  </p>
                ) : null}
                {overflowNotice}
                {actions}
              </div>
            </div>
          </div>
        </section>
      )}
      {canEdit ? (
        <ApronCardEditor
          open={open}
          onOpenChange={setOpen}
          canExport={canExport}
          {...card}
        />
      ) : null}
    </>
  );
}
