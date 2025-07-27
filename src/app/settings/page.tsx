"use client";

import {
  Security as SecurityIcon,
  People as PeopleIcon,
  AdminPanelSettings as AdminIcon,
} from "@mui/icons-material";
import {
  Card,
  CardContent,
  Grid,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import Link from "next/link";
import { type ReactElement } from "react";

import { PermissionGate } from "~/components/permissions/PermissionGate";
import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";

interface SettingsMenuItem {
  title: string;
  description: string;
  href: string;
  icon: ReactElement;
  permission?: string;
}

const settingsMenuItems: SettingsMenuItem[] = [
  {
    title: "Roles & Permissions",
    description: "Manage roles and permissions for your organization",
    href: "/settings/roles",
    icon: <SecurityIcon />,
    permission: PERMISSIONS.ROLE_MANAGE,
  },
  {
    title: "Users",
    description: "Manage organization members and their roles",
    href: "/settings/users",
    icon: <PeopleIcon />,
    permission: PERMISSIONS.USER_MANAGE,
  },
  {
    title: "Organization",
    description: "Configure organization settings and preferences",
    href: "/settings/organization",
    icon: <AdminIcon />,
    permission: PERMISSIONS.ORGANIZATION_MANAGE,
  },
];

export default function SettingsPage(): ReactElement {
  const { hasPermission } = usePermissions();

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Organization Settings
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Configure your organization's settings, manage users, and set up
          permissions.
        </Typography>
      </Grid>

      {settingsMenuItems.map((item) => (
        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={item.href}>
          <PermissionGate
            permission={item.permission ?? ""}
            hasPermission={hasPermission}
          >
            <Card
              component={Link}
              href={item.href}
              sx={{
                textDecoration: "none",
                transition: "all 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: 2,
                },
              }}
            >
              <CardContent>
                <List disablePadding>
                  <ListItem disablePadding>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={item.description}
                      slotProps={{
                        primary: {
                          variant: "h6",
                          component: "h3",
                        },
                      }}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </PermissionGate>
        </Grid>
      ))}
    </Grid>
  );
}
