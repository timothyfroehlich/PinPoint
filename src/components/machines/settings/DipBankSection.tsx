"use client";

import type React from "react";
import {
  EditableSettingsTable,
  type SettingsTableColumn,
} from "~/components/machines/settings/EditableSettingsTable";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { SECTION_TITLE_CLASS } from "~/components/machines/settings/styles";
import { cn } from "~/lib/utils";
import type {
  DipSwitchBank,
  DipSwitchEntry,
} from "~/lib/machines/settings-types";

interface DipBankSectionProps {
  bank: DipSwitchBank;
  canEdit: boolean;
  reserveEditUi?: boolean;
  onRenameBank: (name: string) => void;
  onAddSwitch: () => string | undefined;
  onUpdateSwitch: (
    switchKey: string,
    field: "switch" | "position" | "note",
    value: string
  ) => void;
  onDeleteSwitch: (switchKey: string) => void;
}

/**
 * One DIP-switch bank, rendered as a single reorderable section. Bank deletion
 * is handled by the surrounding SortableSection; this component owns the
 * editable bank name and the per-switch table.
 */
export function DipBankSection({
  bank,
  canEdit,
  reserveEditUi = false,
  onRenameBank,
  onAddSwitch,
  onUpdateSwitch,
  onDeleteSwitch,
}: DipBankSectionProps): React.JSX.Element {
  // Column roles mirror the ID / Setting / Value tables so stacked sections
  // read consistently: Switch↔ID (left), the note field shown as "Setting"
  // (flexible middle), Position↔Value (right). Position therefore takes Value's
  // width so the two line up across sections.
  const columns: SettingsTableColumn<DipSwitchEntry>[] = [
    {
      key: "switch",
      header: "Switch",
      kind: "text",
      mono: true,
      // Switch designators ("DS-1", "SW3") are codes — no autocorrect/caps/spellcheck.
      codeLike: true,
      read: (s) => s.switch,
      commit: (s, v) => {
        onUpdateSwitch(s._key, "switch", v);
      },
      placeholder: "DS-…",
      ariaLabel: "Switch number",
      headClassName: "w-24 max-md:h-8 max-md:w-px max-md:pl-0 max-md:pr-1",
      cellClassName:
        "font-mono text-sm text-muted-foreground max-md:pl-0 max-md:pr-1 max-md:py-1 max-md:text-xs",
    },
    {
      key: "note",
      header: "Setting",
      kind: "text",
      read: (s) => s.note,
      commit: (s, v) => {
        onUpdateSwitch(s._key, "note", v);
      },
      placeholder: "Setting",
      ariaLabel: "Switch setting",
      // whitespace-normal overrides the Table default nowrap — setting text is
      // sentence-length and must wrap instead of forcing horizontal scroll.
      headClassName: "md:w-2/3 max-md:h-8 max-md:px-1",
      cellClassName:
        "min-w-36 whitespace-normal text-sm text-foreground max-md:px-1 max-md:py-1 max-md:text-[13px]",
    },
    {
      key: "position",
      header: "Position",
      kind: "toggle",
      read: (s) => s.position,
      commit: (s, v) => {
        onUpdateSwitch(s._key, "position", v);
      },
      ariaLabel: (s) => `${s.switch || "Switch"} position (toggle on/off)`,
      headClassName:
        "md:w-1/3 max-md:h-8 max-md:w-auto max-md:pl-1 max-md:pr-0",
      cellClassName: "max-md:pl-1 max-md:pr-0 max-md:py-1",
    },
  ];

  return (
    <div className="py-2.5 max-md:py-1.5">
      {/* pr-14 in edit mode keeps the title input clear of SortableSection's
          floating grip/delete cluster at the row's right end. */}
      <div className={cn("mb-1.5", canEdit && "pr-14")}>
        <span className={SECTION_TITLE_CLASS}>
          <InlineEditableText
            value={bank.name}
            canEdit={canEdit}
            onValueChange={onRenameBank}
            placeholder="Bank name"
            ariaLabel="bank name"
            inputClassName="h-7 text-sm font-semibold"
          />
        </span>
      </div>
      {/* Section content hangs indented under the heading so headings read as the structural landmarks. */}
      <div className="pl-2">
        <EditableSettingsTable
          rows={bank.switches}
          columns={columns}
          canEdit={canEdit}
          reserveEditUi={reserveEditUi}
          onAddRow={onAddSwitch}
          onDeleteRow={onDeleteSwitch}
          tableAriaLabel={`Switches for ${bank.name || "DIP"} bank`}
          addLabel="Add switch"
          deleteAriaLabel={(s) => `Delete switch ${s.switch || "row"}`}
          sheetTitle="Edit switch"
          sheetSubtitle={bank.name || "DIP bank"}
          emptyState={
            <p className="py-1 text-xs italic text-muted-foreground">
              No switches in this bank yet.
            </p>
          }
        />
      </div>
    </div>
  );
}
