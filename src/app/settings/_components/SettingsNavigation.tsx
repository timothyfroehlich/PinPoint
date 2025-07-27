"use client";

import { AdminPanelSettings, People } from "@mui/icons-material";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission: string;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Roles & Permissions",
    href: "/settings/roles",
    icon: <AdminPanelSettings />,
    permission: PERMISSIONS.ROLE_MANAGE,
  },
  {
    label: "Users",
    href: "/settings/users",
    icon: <People />,
    permission: PERMISSIONS.USER_MANAGE,
  },
];

export function SettingsNavigation(): React.JSX.Element {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();

  const visibleItems = navigationItems.filter((item) =>
    hasPermission(item.permission),
  );

  return (
    <Paper sx={{ width: 280, flexShrink: 0 }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="h2">
          Settings
        </Typography>
      </Box>

      <List>
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                component={NextLink}
                href={item.href}
                selected={isActive}
                sx={{
                  "&.Mui-selected": {
                    backgroundColor: "primary.light",
                    color: "primary.contrastText",
                    "&:hover": {
                      backgroundColor: "primary.main",
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? "inherit" : "action.active",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
}
