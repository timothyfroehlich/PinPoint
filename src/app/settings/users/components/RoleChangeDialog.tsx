/**
 * Role Change Dialog Client Island
 * Phase 4B.2: User role management functionality with Server Actions
 */

"use client";

import { useState, useActionState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ShieldIcon, LoaderIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { updateUserRoleAction } from "~/lib/actions/admin-actions";

interface RoleChangeDialogProps {
  user: {
    userId: string;
    name: string;
    email: string;
    role: {
      id: string;
      name: string;
      isSystem: boolean;
    };
  };
  availableRoles: { 
    id: string; 
    name: string; 
    description?: string;
    isSystem: boolean;
  }[];
  children?: React.ReactNode;
}

export function RoleChangeDialog({ user, availableRoles, children }: RoleChangeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(user.role.id);
  const [state, formAction, isPending] = useActionState(updateUserRoleAction, null);

  // Handle successful role change
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message || "User role updated successfully!");
      setIsOpen(false);
    } else if (state && !state.success) {
      // Handle field errors or general error
      if (state.fieldErrors) {
        Object.entries(state.fieldErrors).forEach(([field, errors]) => {
          if (Array.isArray(errors)) {
            errors.forEach(error => toast.error(`${field}: ${error}`));
          }
        });
      } else if (state.message) {
        toast.error(state.message);
      }
    }
  }, [state]);

  // Filter out roles that shouldn't be assignable
  const assignableRoles = availableRoles.filter(role => 
    // Allow all roles for now, but you could add logic here
    // For example: !role.isSystem || role.id === user.role.id
    true
  );

  const selectedRole = assignableRoles.find(role => role.id === selectedRoleId);
  const hasRoleChanged = selectedRoleId !== user.role.id;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <ShieldIcon className="mr-2 h-4 w-4" />
            Change Role
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Update the role for {user.name || user.email}. This will change their permissions immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Information */}
          <div className="flex items-center space-x-3 p-3 border rounded-lg bg-muted/50">
            <UserIcon className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{user.name || "Unnamed User"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                Current role: <span className="font-medium">{user.role.name}</span>
              </p>
            </div>
          </div>

          <form action={formAction} className="space-y-4">
            {/* Hidden fields */}
            <input type="hidden" name="userId" value={user.userId} />
            
            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="roleId">New Role</Label>
              <Select 
                name="roleId" 
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{role.name}</span>
                        {role.description && (
                          <span className="text-xs text-muted-foreground">
                            {role.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state?.fieldErrors?.roleId && (
                <p className="text-xs text-destructive">{state.fieldErrors.roleId[0]}</p>
              )}
            </div>

            {/* Role Change Warning */}
            {hasRoleChanged && selectedRole && (
              <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
                <p className="text-sm font-medium text-yellow-800">
                  Role Change Confirmation
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  {user.name || user.email} will be changed from "{user.role.name}" to "{selectedRole.name}". 
                  This change takes effect immediately.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedRoleId(user.role.id);
                  setIsOpen(false);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isPending || !hasRoleChanged}
              >
                {isPending ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <ShieldIcon className="mr-2 h-4 w-4" />
                    Update Role
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}