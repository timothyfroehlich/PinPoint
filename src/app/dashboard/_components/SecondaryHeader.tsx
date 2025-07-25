"use client";

import SettingsIcon from "@mui/icons-material/Settings";
import { Toolbar, Typography, Box } from "@mui/material";

import type { JSX } from "react";

import { PermissionButton } from "~/components/permissions/PermissionButton";
import { usePermissions } from "~/hooks/usePermissions";

const SecondaryHeader = (): JSX.Element => {
  const { hasPermission } = usePermissions();

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography variant="h5" fontWeight="bold">
          Dashboard
        </Typography>
        <PermissionButton
          permission="organization:admin"
          hasPermission={hasPermission}
          variant="outlined"
          startIcon={<SettingsIcon />}
          sx={{
            borderColor: "rgba(255,255,255,0.3)",
            color: "text.secondary",
            textTransform: "none",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.5)",
              bgcolor: "rgba(255,255,255,0.05)",
            },
          }}
          tooltipText="Customize dashboard layout and settings"
          showWhenDenied={false}
        >
          Customize
        </PermissionButton>
      </Toolbar>
    </Box>
  );
};

export default SecondaryHeader;
