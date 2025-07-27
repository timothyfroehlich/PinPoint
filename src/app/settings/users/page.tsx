"use client";

import { People } from "@mui/icons-material";
import { Alert, Box, Paper, Snackbar, Typography } from "@mui/material";
import { useState } from "react";

import { UserRoleDialog } from "./_components/UserRoleDialog";
import { UserTable } from "./_components/UserTable";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import { api } from "~/trpc/react";

export default function UsersPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const {
    data: users = [],
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = api.admin.getUsers.useQuery();

  const canManageUsers = hasPermission(PERMISSIONS.USER_MANAGE);

  const handleEditUser = (userId: string): void => {
    setEditingUser(userId);
  };

  const handleCloseDialog = (): void => {
    setEditingUser(null);
  };

  const handleSuccess = (message: string): void => {
    setSuccessMessage(message);
    void refetchUsers();
    handleCloseDialog();
  };

  const handleCloseSuccessMessage = (): void => {
    setSuccessMessage("");
  };

  if (!canManageUsers) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Access Denied
        </Typography>
        <Typography color="text.secondary">
          You don't have permission to manage users.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 4 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 3,
          }}
        >
          <People sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h4" component="h1">
            User Management
          </Typography>
        </Box>

        <Typography
          variant="body1"
          color="text.secondary"
          component="p"
          sx={{ mb: 3 }}
        >
          Manage user roles and permissions within your organization.
        </Typography>

        <UserTable
          users={users}
          loading={usersLoading}
          onEdit={handleEditUser}
          onSuccess={handleSuccess}
        />
      </Paper>

      <UserRoleDialog
        open={!!editingUser}
        userId={editingUser}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
      />

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSuccessMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseSuccessMessage}
          severity="success"
          className="success-message"
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
