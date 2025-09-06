/**
 * User Table Actions Client Island
 * Phase 4B.2: User management actions dropdown with integrated dialogs
 */

"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  MoreHorizontalIcon,
  UserIcon,
  ShieldIcon,
  MailIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";
import { RoleChangeDialog } from "./RoleChangeDialog";

interface UserTableActionsProps {
  user: {
    userId: string;
    email: string;
    name: string;
    membershipId: string;
    role: {
      id: string;
      name: string;
      isSystem: boolean;
    };
    emailVerified: Date | null;
  };
  currentUserCanManage: boolean;
  availableRoles?: {
    id: string;
    name: string;
    description?: string;
    isSystem: boolean;
  }[];
}

export function UserTableActions({
  user,
  currentUserCanManage,
  availableRoles = [],
}: UserTableActionsProps): JSX.Element | null {
  const [isLoading, setIsLoading] = useState(false);

  const handleResendInvitation = (): void => {
    setIsLoading(true);
    try {
      // TODO: Implement resend invitation
      toast.info("Resend invitation coming soon");
    } catch {
      toast.error("Failed to resend invitation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUser = (): void => {
    setIsLoading(true);
    try {
      // TODO: Implement user removal with confirmation dialog
      toast.info("User removal coming soon");
    } catch {
      toast.error("Failed to remove user");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUserCanManage) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isLoading}>
          <MoreHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>User Actions</DropdownMenuLabel>

        <DropdownMenuSeparator />

        <RoleChangeDialog user={user} availableRoles={availableRoles}>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
            }} // Prevent dropdown from closing
            className="cursor-pointer"
          >
            <ShieldIcon className="mr-2 h-4 w-4" />
            Change Role
          </DropdownMenuItem>
        </RoleChangeDialog>

        {!user.emailVerified && (
          <DropdownMenuItem onClick={handleResendInvitation}>
            <MailIcon className="mr-2 h-4 w-4" />
            Resend Invitation
          </DropdownMenuItem>
        )}

        <DropdownMenuItem>
          <UserIcon className="mr-2 h-4 w-4" />
          View Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {!user.role.isSystem && (
          <DropdownMenuItem
            onClick={handleRemoveUser}
            className="text-destructive focus:text-destructive"
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Remove User
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
