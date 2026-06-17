import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Eye,
  FileText,
  Pencil,
  Plus,
  Settings,
  Star,
  StickyNote,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import type { MachineTimelineEventKind } from "~/lib/timeline/machine-event-types";

/**
 * Per-kind icon + color for system rows on the machine timeline.
 *
 * This is design-layer config (design bible §1 exception): the choice of
 * lucide shape and semantic-token color IS the design decision being
 * expressed. Component code reads `MACHINE_EVENT_ICONS[kind]` and renders;
 * it does not hand-pick icons or colors at call sites.
 *
 * Color hierarchy:
 *   - `text-primary`            — landmark creation event (machine_added)
 *   - `text-success`            — positive resolution (issue_closed)
 *   - `text-secondary`          — active issue work (open/status/assign/move)
 *   - `text-muted-foreground`   — incremental metadata edits
 *
 * Every entry is also covered by an exhaustive Record<kind, …>, so adding a
 * new `MachineTimelineEventKind` produces a typecheck error here and forces
 * the visual choice to be made deliberately.
 */
export const MACHINE_EVENT_ICONS: Record<
  MachineTimelineEventKind,
  { Icon: LucideIcon; colorClass: string }
> = {
  // Lifecycle landmarks
  machine_added: { Icon: Plus, colorClass: "text-primary" },

  // Lifecycle — ownership
  owner_set: { Icon: UserPlus, colorClass: "text-muted-foreground" },
  owner_changed: { Icon: UserCog, colorClass: "text-muted-foreground" },

  // Lifecycle — metadata edits
  name_changed: { Icon: Pencil, colorClass: "text-muted-foreground" },
  presence_changed: { Icon: Eye, colorClass: "text-muted-foreground" },
  description_updated: { Icon: FileText, colorClass: "text-muted-foreground" },
  owner_requirements_updated: {
    Icon: ClipboardList,
    colorClass: "text-muted-foreground",
  },
  owner_notes_updated: {
    Icon: StickyNote,
    colorClass: "text-muted-foreground",
  },

  // Settings sets (PP-43q3)
  settings_set_created: { Icon: Settings, colorClass: "text-muted-foreground" },
  settings_set_updated: { Icon: Settings, colorClass: "text-muted-foreground" },
  settings_set_deleted: { Icon: Trash2, colorClass: "text-muted-foreground" },
  settings_set_preferred: { Icon: Star, colorClass: "text-warning" },

  // Issue events
  issue_opened: { Icon: CircleDot, colorClass: "text-secondary" },
  issue_closed: { Icon: CheckCircle2, colorClass: "text-success" },
  issue_status_changed: { Icon: ArrowRight, colorClass: "text-secondary" },
  issue_assigned: { Icon: UserCheck, colorClass: "text-secondary" },
  issue_unassigned: { Icon: UserMinus, colorClass: "text-secondary" },
  issue_reassigned_out: {
    Icon: ArrowUpRight,
    colorClass: "text-secondary",
  },
  issue_reassigned_in: {
    Icon: ArrowDownLeft,
    colorClass: "text-secondary",
  },
};
