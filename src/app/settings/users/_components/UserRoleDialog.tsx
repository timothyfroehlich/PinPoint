"use client";

import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { api } from "~/trpc/react";

interface UserRoleDialogProps {
  open: boolean;
  userId: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function UserRoleDialog({
  open,
  userId,
  onClose,
  onSuccess,
}: UserRoleDialogProps): React.JSX.Element {
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const { data: users = [] } = api.admin.getUsers.useQuery();
  const { data: roles = [] } = api.admin.getRoles.useQuery();

  const user = users.find((u) => u.id === userId);

  const updateUserRoleMutation = api.admin.updateUserRole.useMutation({
    onSuccess: () => {
      onSuccess("User role updated successfully");
      handleClose();
    },
    onError: (error) => {
      console.error("Failed to update user role:", error);
    },
  });

  useEffect(() => {
    if (user && open) {
      setSelectedRoleId(user.role.id);
    } else {
      setSelectedRoleId("");
    }
  }, [user, open]);

  const handleClose = (): void => {
    setSelectedRoleId("");
    onClose();
  };

  const handleSubmit = (): void => {
    if (!userId || !selectedRoleId) return;

    updateUserRoleMutation.mutate({
      userId,
      roleId: selectedRoleId,
    });
  };

  const hasChanges = selectedRoleId !== user?.role.id;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit User Role</DialogTitle>

      <DialogContent>
        {user && (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Avatar
                {...(user.profilePicture && { src: user.profilePicture })}
                sx={{ width: 56, height: 56 }}
              >
                {user.name?.[0]?.toUpperCase() ??
                  user.email?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6">{user.name ?? user.email}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
            </Box>

            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={selectedRoleId}
                onChange={(e) => {
                  setSelectedRoleId(e.target.value);
                }}
                label="Role"
                name="role"
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    <Box>
                      <Typography variant="body1">{role.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {role.permissionCount} permission(s)
                        {role.isSystem && " • System Role"}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={updateUserRoleMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            updateUserRoleMutation.isPending || !hasChanges || !selectedRoleId
          }
        >
          {updateUserRoleMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
