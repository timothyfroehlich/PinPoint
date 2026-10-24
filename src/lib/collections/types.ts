import type { MachinePresenceStatus } from "~/lib/machines/presence";

/**
 * A machine group member's identity: what a Collection's or Tag's tabs and
 * edit controls scope by (spec collections-and-tags §4).
 */
export interface CollectionMachine {
  id: string;
  initials: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
}
