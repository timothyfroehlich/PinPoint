"use client";

import { Box, Container, Paper } from "@mui/material";

import { Breadcrumbs } from "./_components/Breadcrumbs";
import { SettingsNavigation } from "./_components/SettingsNavigation";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({
  children,
}: SettingsLayoutProps): React.JSX.Element {
  const { hasPermission } = usePermissions();

  // Check if user has permission to access settings
  const hasOrgManagePermission = hasPermission(PERMISSIONS.ORGANIZATION_MANAGE);
  const hasRoleManagePermission = hasPermission(PERMISSIONS.ROLE_MANAGE);
  const hasUserManagePermission = hasPermission(PERMISSIONS.USER_MANAGE);

  // User needs at least one of these permissions to access settings
  const canAccessSettings =
    hasOrgManagePermission ||
    hasRoleManagePermission ||
    hasUserManagePermission;

  if (!canAccessSettings) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 3, textAlign: "center" }}>
          You don't have permission to access organization settings.
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs />

      <Box sx={{ display: "flex", gap: 3, mt: 3 }}>
        <SettingsNavigation />

        <Box sx={{ flex: 1 }}>{children}</Box>
      </Box>
    </Container>
  );
}
