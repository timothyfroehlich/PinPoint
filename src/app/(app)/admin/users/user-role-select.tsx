"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { updateUserRole } from "./actions";
import { toast } from "sonner";

interface UserRoleSelectProps {
  userId: string;
  userName: string;
  currentRole: "guest" | "member" | "technician" | "admin";
  currentUserId: string;
  userType?: "active" | "invited";
}

export function UserRoleSelect({
  userId,
  userName,
  currentRole,
  currentUserId,
  userType = "active",
}: UserRoleSelectProps): React.JSX.Element {
  const [isPending, startTransition] = React.useTransition();

  const handleRoleChange = (
    newRole: "guest" | "member" | "technician" | "admin"
  ): void => {
    if (
      userType === "active" &&
      userId === currentUserId &&
      newRole !== "admin"
    ) {
      toast.error("You cannot demote yourself.");
      return;
    }

    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole, userType);
        toast.success("Role updated successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update role"
        );
      }
    });
  };

  return (
    <Select
      key={currentRole}
      defaultValue={currentRole}
      onValueChange={handleRoleChange}
      disabled={
        isPending || (userId === currentUserId && currentRole === "admin")
      }
    >
      <SelectTrigger
        className="w-[120px]"
        aria-label={`Change role for ${userName}`}
      >
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="guest">Guest</SelectItem>
        <SelectItem value="member">Member</SelectItem>
        <SelectItem value="technician">Technician</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
