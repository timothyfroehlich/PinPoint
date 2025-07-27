"use client";

import { Add } from "@mui/icons-material";
import { Alert, Box, Button, Paper, Snackbar, Typography } from "@mui/material";
import { useState } from "react";

import { RoleDialog } from "./_components/RoleDialog";
import { RoleTable } from "./_components/RoleTable";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import { api } from "~/trpc/react";

export default function RolesPage(): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const {
    data: roles = [],
    isLoading: rolesLoading,
    refetch: refetchRoles,
  } = api.admin.getRoles.useQuery();

  const canManageRoles = hasPermission(PERMISSIONS.ROLE_MANAGE);

  const handleCreateRole = (): void => {
    setEditingRole(null);
    setDialogOpen(true);
  };

  const handleEditRole = (roleId: string): void => {
    setEditingRole(roleId);
    setDialogOpen(true);
  };

  const handleCloseDialog = (): void => {
    setDialogOpen(false);
    setEditingRole(null);
  };

  const handleSuccess = (message: string): void => {
    setSuccessMessage(message);
    void refetchRoles();
    handleCloseDialog();
  };

  const handleCloseSuccessMessage = (): void => {
    setSuccessMessage("");
  };

  if (!canManageRoles) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Access Denied
        </Typography>
        <Typography color="text.secondary">
          You don't have permission to manage roles and permissions.
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
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1">
            Roles & Permissions
          </Typography>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateRole}
          >
            Create Role
          </Button>
        </Box>

        <Typography
          variant="body1"
          color="text.secondary"
          component="p"
          sx={{ mb: 2 }}
        >
          Manage roles and their permissions. System roles (Admin, User,
          Technician) cannot be modified or deleted.
        </Typography>

        <RoleTable
          roles={roles}
          loading={rolesLoading}
          onEdit={handleEditRole}
          onSuccess={handleSuccess}
        />
      </Paper>

      <RoleDialog
        open={dialogOpen}
        roleId={editingRole}
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
