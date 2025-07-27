"use client";

import { PersonAdd as PersonAddIcon } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/material";
import { useState, type ReactElement } from "react";

import { InviteUserDialog } from "./_components/InviteUserDialog";
import { UserTable } from "./_components/UserTable";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";

export default function UsersPage(): ReactElement {
  const { hasPermission } = usePermissions();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const canManageUsers = hasPermission(PERMISSIONS.USER_MANAGE);

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
            Users
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage organization members and their role assignments.
          </Typography>
        </Box>

        {canManageUsers && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              setIsInviteDialogOpen(true);
            }}
          >
            Invite User
          </Button>
        )}
      </Box>

      <UserTable />

      <InviteUserDialog
        open={isInviteDialogOpen}
        onClose={() => {
          setIsInviteDialogOpen(false);
        }}
      />
    </Box>
  );
}
