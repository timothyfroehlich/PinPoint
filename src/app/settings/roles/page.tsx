"use client";

import { Add as AddIcon } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/material";
import { useState, type ReactElement } from "react";

import { RoleDialog } from "./_components/RoleDialog";
import { RoleTable } from "./_components/RoleTable";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";

export default function RolesPage(): ReactElement {
  const { hasPermission } = usePermissions();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const canManageRoles = hasPermission(PERMISSIONS.ROLE_MANAGE);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Roles & Permissions
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage roles and permissions for your organization members.
          </Typography>
        </Box>

        {canManageRoles && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setIsCreateDialogOpen(true);
            }}
          >
            Create Role
          </Button>
        )}
      </Box>

      <RoleTable />

      <RoleDialog
        open={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
        }}
        mode="create"
      />
    </Box>
  );
}
