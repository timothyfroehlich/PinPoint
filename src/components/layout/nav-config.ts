import { LayoutDashboard, AlertTriangle, Gamepad2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly title: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

export const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Issues", href: "/issues", icon: AlertTriangle },
  { title: "Machines", href: "/m", icon: Gamepad2 },
] as const satisfies readonly NavItem[];
