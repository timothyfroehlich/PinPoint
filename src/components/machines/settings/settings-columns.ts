import type { SettingsTableColumn } from "~/components/machines/settings/EditableSettingsTable";
import type { SoftwareSetting } from "~/lib/machines/settings-types";

/**
 * The ID / Setting / Value column triplet shared by Software Settings and the
 * generic Table section — the same three-column editable grid, differing only
 * in the ID column's hint text (a software setting reads "S-…", a generic table
 * just "ID"). Centralizing it keeps the two tables from drifting.
 */
export function idNameValueColumns(
  onUpdate: (
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ) => void,
  opts: { idPlaceholder: string; idAriaLabel: string }
): SettingsTableColumn<SoftwareSetting>[] {
  return [
    {
      key: "id",
      header: "ID",
      kind: "text",
      mono: true,
      // ID strings ("S-12", "A1") are codes — keep autocorrect/caps/spellcheck off.
      codeLike: true,
      read: (r) => r.id,
      commit: (r, v) => {
        onUpdate(r._key, "id", v);
      },
      placeholder: opts.idPlaceholder,
      ariaLabel: opts.idAriaLabel,
      headClassName: "w-24 max-md:h-8 max-md:w-px max-md:pl-0 max-md:pr-1",
      cellClassName:
        "font-mono text-sm text-muted-foreground max-md:pl-0 max-md:pr-1 max-md:py-1 max-md:text-xs",
    },
    {
      key: "name",
      header: "Setting",
      kind: "text",
      read: (r) => r.name,
      commit: (r, v) => {
        onUpdate(r._key, "name", v);
      },
      placeholder: "Setting name",
      ariaLabel: "Setting name",
      headClassName: "md:w-2/3 max-md:h-8 max-md:px-1",
      cellClassName:
        "min-w-28 whitespace-normal text-sm text-foreground max-md:px-1 max-md:py-1 max-md:text-[13px]",
    },
    {
      key: "value",
      header: "Value",
      kind: "text",
      read: (r) => r.value,
      commit: (r, v) => {
        onUpdate(r._key, "value", v);
      },
      placeholder: "Value",
      ariaLabel: "Setting value",
      headClassName:
        "md:w-1/3 max-md:h-8 max-md:w-auto max-md:pl-1 max-md:pr-0",
      cellClassName:
        "min-w-24 whitespace-normal text-sm text-foreground max-md:pl-1 max-md:pr-0 max-md:py-1 max-md:text-[13px]",
    },
  ];
}
