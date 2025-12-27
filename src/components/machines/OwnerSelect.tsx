"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";

interface User {
  id: string;
  name: string;
}

interface OwnerSelectProps {
  users: User[];
  defaultValue?: string | null;
  disabled?: boolean;
}

import React from "react";

export function OwnerSelect({
  users,
  defaultValue,
  disabled,
}: OwnerSelectProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label htmlFor="ownerId" className="text-on-surface">
        Machine Owner
      </Label>
      <Select
        name="ownerId"
        defaultValue={defaultValue ?? ""}
        disabled={!!disabled}
      >
        <SelectTrigger
          id="ownerId"
          className="border-outline bg-surface text-on-surface"
          aria-describedby="owner-help"
        >
          <SelectValue placeholder="Select an owner" />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="owner-help" className="text-xs text-on-surface-variant">
        The owner receives notifications for new issues on this machine.
      </p>
    </div>
  );
}
