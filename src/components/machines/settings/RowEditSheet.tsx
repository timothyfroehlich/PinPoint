"use client";

import type React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
  /** Identity of the row being edited. Reused as a render `key` so swapping
   *  rows without closing remounts the inputs against the new row's values. */
  rowKey: string | null;
  fields: RowEditField[];
  /**
   * Called on every field edit with the single changed field. The value is
   * persisted immediately through the same per-field auto-save path the desktop
   * inline cells use (debounced by the tab) — there is no buffered "Save".
   */
  onFieldChange: (key: string, value: string) => void;
  /**
   * Called when the sheet closes so the caller can flush any still-debounced
   * edit (e.g. a value typed an instant before dismiss). Toggle edits are
   * flushed eagerly by the caller, but text edits ride the debounce until this.
   */
  onClose?: (() => void) | undefined;
}

/**
 * Mobile per-row editor for the Machine Settings tab. Renders the row's fields
 * stacked, one per line, with visible labels at 16px (`text-base`) — large
 * enough to avoid iOS's <16px focus-zoom.
 *
 * Auto-save (PP-43q3): there is no buffered draft and no "Save" button. Every
 * field edit persists live through `onFieldChange`, routed into the same
 * per-field auto-save chokepoint the desktop inline cells use; closing the
 * sheet flushes any in-flight debounce via `onClose`. The "Done" button only
 * dismisses — edits are already saved.
 *
 * Keyboard-aware (PP-43q3 / PP-jn45): the sheet caps at `100dvh` and its fields
 * region scrolls (`overflow-y-auto`), and each input gets `scroll-margin` plus
 * a `scrollIntoView` on focus so the focused field rides above the on-screen
 * keyboard instead of being occluded.
 *
 * Desktop keeps inline cell editing and never mounts this sheet open.
 */
export function RowEditSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  rowKey,
  fields,
  onFieldChange,
  onClose,
}: RowEditSheetProps): React.JSX.Element {
  function handleFocus(e: React.FocusEvent<HTMLElement>): void {
    // Pull the focused field above the keyboard. `scroll-margin` (set on the
    // wrapper) reserves the gap; `scrollIntoView` triggers the scroll once the
    // keyboard has resized the content area.
    e.currentTarget.scrollIntoView({ block: "nearest" });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        // Cap at the dynamic viewport height and let the body scroll so the
        // focused field can rise above the on-screen keyboard. With
        // `interactive-widget=resizes-content`, the keyboard shrinks the visual
        // viewport and `100dvh` follows it.
        className="max-h-[100dvh] gap-0"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {subtitle ? <SheetDescription>{subtitle}</SheetDescription> : null}
        </SheetHeader>

        {/* Scrollable fields region. `overscroll-contain` keeps scroll momentum
            inside the sheet rather than leaking to the inert page behind it. */}
        <div
          key={rowKey ?? "none"}
          className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-1"
        >
          {fields.map((field) => {
            const fieldId = `row-edit-${field.key}`;
            const value = field.value;

            if (field.kind === "toggle") {
              const on = value === "ON";
              return (
                <div
                  key={field.key}
                  className="flex scroll-mt-4 scroll-mb-4 flex-col gap-2"
                >
                  <Label htmlFor={fieldId} className="text-base">
                    {field.label}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={fieldId}
                      checked={on}
                      onFocus={handleFocus}
                      onCheckedChange={(checked) => {
                        onFieldChange(field.key, checked ? "ON" : "OFF");
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
              <div
                key={field.key}
                className="flex scroll-mt-4 scroll-mb-4 flex-col gap-2"
              >
                <Label htmlFor={fieldId} className="text-base">
                  {field.label}
                </Label>
                <Input
                  id={fieldId}
                  value={value}
                  className={cn("text-base", field.mono && "font-mono")}
                  onFocus={handleFocus}
                  onChange={(e) => {
                    onFieldChange(field.key, e.target.value);
                  }}
                />
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
