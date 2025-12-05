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
  currentRole: "guest" | "member" | "admin";
  currentUserId: string;
}

export function UserRoleSelect({
  userId,
  currentRole,
  currentUserId,
}: UserRoleSelectProps): React.JSX.Element {
  const [isPending, startTransition] = React.useTransition();

  const handleRoleChange = (newRole: "guest" | "member" | "admin"): void => {
    if (userId === currentUserId && newRole !== "admin") {
      toast.error("You cannot demote yourself.");
      return;
    }

    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole);
        toast.success("Role updated successfully");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update role"
        );
        // Ideally we would revert the optimistic update here if we were doing one manually,
        // but since we rely on revalidatePath and the Select value is controlled by the prop (which comes from server),
        // it might not visually revert immediately if we don't manage local state.
        // For now, the server revalidation will fix it.
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
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="guest">Guest</SelectItem>
        <SelectItem value="member">Member</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
