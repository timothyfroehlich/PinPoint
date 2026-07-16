import {
  LayoutDashboard,
  AlertTriangle,
  Gamepad2,
  Library,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly title: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /**
   * When true, this item is omitted from the mobile bottom tab bar (space is
   * tight there) and surfaced in the "More" sheet instead. Desktop nav shows
   * every item regardless.
   */
  readonly hideFromBottomBar?: boolean;
}

export const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Machines", href: "/m", icon: Gamepad2 },
  {
    title: "Collections",
    href: "/c/collections",
    icon: Library,
    hideFromBottomBar: true,
  },
  { title: "Issues", href: "/issues", icon: AlertTriangle },
] as const satisfies readonly NavItem[];
