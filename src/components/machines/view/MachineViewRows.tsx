import type React from "react";
import { ListRows } from "~/components/list-view/ListRow";
import type { MachineViewRow } from "~/lib/types";
import {
  MachineListEntry,
  type MachineRowAction,
  type MachineRowAge,
  type MachineSelectionHandler,
} from "./MachineListEntry";

/**
 * The machine rows (machine-views §5.3, §5.9): the same two lines per
 * machine at every width, showing the same fields on every Surface. Line 2
 * ends with the Last Serviced age, or the added age while the list is
 * sorted by Date Added (§5.15).
 */
export function MachineViewRows({
  rows,
  age = "lastServiced",
  onMachineSelect,
  rowAction,
}: {
  rows: readonly MachineViewRow[];
  age?: MachineRowAge;
  onMachineSelect?: MachineSelectionHandler | undefined;
  rowAction?: MachineRowAction | undefined;
}): React.JSX.Element {
  return (
    <ListRows label="Machines list">
      {rows.map((row) => (
        <MachineListEntry
          key={row.id}
          row={row}
          age={age}
          onMachineSelect={onMachineSelect}
          rowAction={rowAction}
        />
      ))}
    </ListRows>
  );
}
