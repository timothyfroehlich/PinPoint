"use client";

import React from "react";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Gamepad2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { logoutAction } from "~/app/(auth)/actions";
import type { UserRole } from "~/lib/types/user";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

interface UserMenuProps {
  userName: string;
  /** Override the trigger's data-testid. Useful when rendered in multiple layout regions. */
  testId?: string;
  /** User role — when "admin", shows the User Management and Integrations links in the dropdown. */
  role?: UserRole | undefined;
  /** Authenticated user's id — enables the "My Machines" collection link. */
  userId?: string | undefined;
}

/**
 * User Menu Component (Client Component)
 *
 * Dropdown menu with user avatar and menu items:
 * - Profile (public profile page)
 * - My Machines
 * - Settings
 * - Sign Out
 */
export function UserMenu({
  userName,
  testId = "user-menu-button",
  role,
  userId,
}: UserMenuProps): React.JSX.Element {
  // Get user initials for avatar fallback
  const initials = userName
    .split(" ")
    .filter((n) => n.length > 0) // Filter out empty strings
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User menu"
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-primary hover:text-on-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        data-testid={testId}
      >
        <div className="flex items-center gap-1.5">
          {/* sm-structural-allow: top navigation bar is always full-viewport-width, viewport breakpoint is correct */}
          <div className="hidden sm:block text-right">
            <p
              className="text-sm font-medium text-on-primary-container leading-tight"
              data-testid="user-menu-name"
            >
              {userName.split(" ")[0]}
            </p>
          </div>
          <Avatar className="size-7 bg-primary text-on-primary">
            <AvatarFallback className="bg-primary text-on-primary font-semibold text-[10px]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="size-3.5 text-on-primary-container" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 bg-surface-variant">
        {/* User Info Header */}
        <div className="flex flex-col px-2 py-1.5 outline-none">
          <p className="text-sm font-semibold text-foreground">{userName}</p>
        </div>
        <DropdownMenuSeparator className="bg-outline-variant" />

        {/* Profile — the user's own public profile page (PinPoint-5r7). */}
        {userId && (
          <DropdownMenuItem asChild>
            <a
              href={`/u/${userId}`}
              className="flex items-center cursor-pointer"
              data-testid="user-menu-profile"
            >
              <User className="mr-2 size-4" />
              <span>Profile</span>
            </a>
          </DropdownMenuItem>
        )}

        {/* My Machines — the user's own collection view (PP-slrd.1).
            Always shown when authenticated; the collection page's empty
            state covers non-owners. */}
        {userId && (
          <DropdownMenuItem asChild>
            <a
              href={`/c/owner/${userId}`}
              className="flex items-center cursor-pointer"
              data-testid="user-menu-my-machines"
            >
              <Gamepad2 className="mr-2 size-4" />
              <span>My Machines</span>
            </a>
          </DropdownMenuItem>
        )}

        {/* Settings — completes the user-specific group (Profile, My
            Machines, Settings). */}
        <DropdownMenuItem asChild>
          <a
            href="/settings"
            className="flex items-center cursor-pointer"
            data-testid="user-menu-settings"
          >
            <Settings className="mr-2 size-4" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>

        {/* Admin group — visible to admins only, kept together and separated
            from the user-specific items above. */}
        {checkPermission("admin.access", getAccessLevel(role)) && (
          <>
            <DropdownMenuSeparator className="bg-outline-variant" />
            <DropdownMenuItem asChild>
              <a
                href="/admin/users"
                className="flex items-center cursor-pointer"
                data-testid="user-menu-admin"
              >
                <Shield className="mr-2 size-4" />
                <span>User Management</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href="/admin/integrations/discord"
                className="flex items-center cursor-pointer"
                data-testid="user-menu-admin-integrations"
              >
                <Shield className="mr-2 size-4" />
                <span>Integrations</span>
              </a>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="bg-outline-variant" />

        {/* Sign Out */}
        <DropdownMenuItem
          className="text-error hover:text-error focus:text-error cursor-pointer"
          data-testid="user-menu-signout"
          onSelect={async (event) => {
            event.preventDefault();
            await logoutAction();
          }}
        >
          <LogOut className="mr-2 size-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
