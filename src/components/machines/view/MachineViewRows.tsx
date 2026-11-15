import type React from "react";
import { ListRows } from "~/components/list-view/ListRow";
import type { MachineViewRow } from "~/lib/types";
import {
  MachineListEntry,
  type MachineRowAction,
  type MachineSelectionHandler,
} from "./MachineListEntry";

/**
 * The machine rows (machine-views §5.3, §5.9): the same two lines per
 * machine at every width, showing the same fields on every Surface.
 */
export function MachineViewRows({
  rows,
  onMachineSelect,
  rowAction,
}: {
  rows: readonly MachineViewRow[];
  onMachineSelect?: MachineSelectionHandler | undefined;
  rowAction?: MachineRowAction | undefined;
}): React.JSX.Element {
  return (
    <ListRows label="Machines list">
      {rows.map((row) => (
        <MachineListEntry
          key={row.id}
          row={row}
          onMachineSelect={onMachineSelect}
          rowAction={rowAction}
        />
      ))}
    </ListRows>
  );
}
