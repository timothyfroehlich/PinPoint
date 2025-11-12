"use client";

import type React from "react";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { logoutAction } from "~/app/(auth)/actions";

interface UserMenuProps {
  userName: string;
  userEmail: string;
}

/**
 * User Menu Component (Client Component)
 *
 * Dropdown menu with user avatar and menu items:
 * - Profile (future)
 * - Settings (future)
 * - Sign Out
 */
export function UserMenu({
  userName,
  userEmail,
}: UserMenuProps): React.JSX.Element {
  // Get user initials for avatar fallback
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary hover:text-on-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-on-primary-container">
              {userName}
            </p>
            <p className="text-xs text-on-primary-container/70">{userEmail}</p>
          </div>
          <Avatar className="size-9 bg-primary text-on-primary">
            <AvatarFallback className="bg-primary text-on-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="size-4 text-on-primary-container" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 bg-surface-variant">
        {/* Profile - future implementation */}
        <DropdownMenuItem
          disabled
          className="cursor-not-allowed opacity-50 text-on-surface-variant"
        >
          <User className="mr-2 size-4" />
          <span>Profile</span>
          <span className="ml-auto text-xs">(Soon)</span>
        </DropdownMenuItem>

        {/* Settings - future implementation */}
        <DropdownMenuItem
          disabled
          className="cursor-not-allowed opacity-50 text-on-surface-variant"
        >
          <Settings className="mr-2 size-4" />
          <span>Settings</span>
          <span className="ml-auto text-xs">(Soon)</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-outline-variant" />

        {/* Sign Out */}
        <DropdownMenuItem asChild>
          <form
            action={async () => {
              await logoutAction();
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center text-error hover:text-error focus:text-error cursor-pointer"
            >
              <LogOut className="mr-2 size-4" />
              <span>Sign Out</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
