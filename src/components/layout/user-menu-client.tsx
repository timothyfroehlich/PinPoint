"use client";

import React from "react";
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
  /** Override the trigger's data-testid. Useful when rendered in multiple layout regions. */
  testId?: string;
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
  testId = "user-menu-button",
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
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-primary hover:text-on-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        data-testid={testId}
      >
        <div className="flex items-center gap-1.5">
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
          <p className="text-sm font-semibold text-on-surface">{userName}</p>
        </div>
        <DropdownMenuSeparator className="bg-outline-variant" />

        {/* Profile - future implementation */}
        <DropdownMenuItem
          disabled
          className="cursor-not-allowed opacity-50 text-on-surface-variant"
        >
          <User className="mr-2 size-4" />
          <span>Profile</span>
          <span className="ml-auto text-xs">(Soon)</span>
        </DropdownMenuItem>

        {/* Settings */}
        <DropdownMenuItem asChild>
          <a href="/settings" className="flex items-center cursor-pointer">
            <Settings className="mr-2 size-4" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-outline-variant" />

        {/* Sign Out */}
        <DropdownMenuItem
          className="text-error hover:text-error focus:text-error cursor-pointer"
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
