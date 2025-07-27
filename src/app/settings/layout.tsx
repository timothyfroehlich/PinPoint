"use client";

import { Box, Container, Typography } from "@mui/material";
import { type ReactNode } from "react";

import { PermissionGate } from "~/components/permissions/PermissionGate";
import { Breadcrumbs } from "~/components/ui/Breadcrumbs";
import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({
  children,
}: SettingsLayoutProps): ReactNode {
  const { hasPermission } = usePermissions();

  return (
    <PermissionGate
      permission={PERMISSIONS.ORGANIZATION_MANAGE}
      hasPermission={hasPermission}
      fallback={
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don't have permission to access organization settings.
          </Typography>
        </Container>
      }
      showFallback
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Breadcrumbs />
          <Typography variant="h4" component="h1" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your organization settings, roles, and permissions.
          </Typography>
        </Box>
        {children}
      </Container>
    </PermissionGate>
  );
}
