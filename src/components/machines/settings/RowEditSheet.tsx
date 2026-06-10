"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

export interface RowEditField {
  /** Stable identity for this field within the row (e.g. "id", "value"). */
  key: string;
  label: string;
  value: string;
  /** Render the input/value in a monospace font. */
  mono?: boolean;
  /**
   * "text" → a labeled text Input. "toggle" → the shadcn Switch + ON/OFF text,
   * storing the literal strings "ON"/"OFF" so callers can round-trip the value.
   */
  kind: "text" | "toggle";
}

interface RowEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** Identity of the row being edited — the draft reseeds when it changes,
   *  so swapping rows without closing the sheet can't show a stale draft. */
  rowKey: string | null;
  fields: RowEditField[];
  /** Called on Save with the full set of (possibly edited) field values. */
  onSave: (values: Record<string, string>) => void;
}

function seedDraft(fields: RowEditField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.value]));
}

/**
 * Mobile per-row editor for the Machine Settings tab. Renders the row's fields
 * stacked, one per line, with visible labels at 16px (`text-base`) — large
 * enough to avoid iOS's <16px focus-zoom. Save commits every field through the
 * caller's `onSave`; Cancel/dismiss discards. Desktop keeps inline cell editing
 * and never mounts this sheet open.
 */
export function RowEditSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  rowKey,
  fields,
  onSave,
}: RowEditSheetProps): React.JSX.Element {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    seedDraft(fields)
  );

  // Reseed from the incoming row when the sheet opens or the target row
  // changes. We read `fields` through a ref so the effect doesn't depend on
  // it — reseeding on every parent re-render would clobber in-progress edits,
  // and depending on `fields` (a fresh array each render) would do exactly that.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  useEffect(() => {
    if (open) {
      setDraft(seedDraft(fieldsRef.current));
    }
  }, [open, rowKey]);

  function setField(key: string, value: string): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(): void {
    onSave(draft);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {subtitle ? <SheetDescription>{subtitle}</SheetDescription> : null}
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-2">
          {fields.map((field) => {
            const fieldId = `row-edit-${field.key}`;
            const value = draft[field.key] ?? "";

            if (field.kind === "toggle") {
              const on = value === "ON";
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label htmlFor={fieldId} className="text-base">
                    {field.label}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={fieldId}
                      checked={on}
                      onCheckedChange={(checked) => {
                        setField(field.key, checked ? "ON" : "OFF");
                      }}
                      aria-label={`${field.label} (toggle on/off)`}
                    />
                    <span className="text-sm font-semibold text-muted-foreground">
                      {on ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={field.key} className="flex flex-col gap-2">
                <Label htmlFor={fieldId} className="text-base">
                  {field.label}
                </Label>
                <Input
                  id={fieldId}
                  value={value}
                  className={cn("text-base", field.mono && "font-mono")}
                  onChange={(e) => {
                    setField(field.key, e.target.value);
                  }}
                />
              </div>
            );
          })}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
