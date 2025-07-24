"use client";

import { AccountCircle } from "@mui/icons-material";
import PlaceIcon from "@mui/icons-material/Place";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { signOut, signIn, useSession } from "next-auth/react";
import { useState } from "react";

import type { JSX } from "react";

import { PermissionButton } from "~/components/permissions/PermissionButton";
import { usePermissions } from "~/hooks/usePermissions";

const PrimaryAppBar = (): JSX.Element => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const { hasPermission } = usePermissions();

  // Responsive design: hide navigation items on mobile to make room for user menu
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const handleMenu = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      handleClose();
      await signOut({ redirect: false });
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
      router.push("/");
    }
  };

  const handleLogin = (): void => {
    void signIn();
  };

  return (
    <AppBar position="fixed" sx={{ bgcolor: "background.paper" }}>
      <Toolbar
        sx={{ justifyContent: "space-between", minHeight: { xs: 56, sm: 64 } }}
      >
        {/* Logo & Branding */}
        <Box
          component="a"
          sx={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
          }}
          href="/"
        >
          <PlaceIcon sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6" noWrap component="div">
            PinPoint
          </Typography>
        </Box>

        {/* Primary Navigation - Hidden on mobile to make room for user menu */}
        {!isMobile && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              color="inherit"
              href="/"
              sx={{
                borderRadius: 2,
                px: 3,
                textTransform: "none",
                fontWeight: "medium",
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              Home
            </Button>

            {/* Authenticated navigation */}
            {session && (
              <>
                <PermissionButton
                  permission="issue:view"
                  hasPermission={hasPermission}
                  showWhenDenied={false}
                  color="inherit"
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    textTransform: "none",
                    fontWeight: "medium",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                  tooltipText="View and manage issues"
                >
                  Issues
                </PermissionButton>
                <PermissionButton
                  permission="machine:view"
                  hasPermission={hasPermission}
                  showWhenDenied={false}
                  color="inherit"
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    textTransform: "none",
                    fontWeight: "medium",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                  tooltipText="View and manage games"
                >
                  Games
                </PermissionButton>
              </>
            )}
          </Box>
        )}

        {/* Authentication Controls */}
        <Box>
          {status === "loading" ? (
            <IconButton color="inherit" disabled>
              <AccountCircle />
            </IconButton>
          ) : session ? (
            // Authenticated state - show user menu
            <div>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                {session.user.image ? (
                  <Avatar
                    src={session.user.image}
                    alt={session.user.name ?? "User"}
                    sx={{ width: 32, height: 32 }}
                  />
                ) : (
                  <Avatar
                    sx={{ bgcolor: "primary.main", width: 32, height: 32 }}
                  >
                    {session.user.name?.charAt(0) ?? "U"}
                  </Avatar>
                )}
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                open={open}
                onClose={handleClose}
              >
                <MenuItem
                  onClick={() => {
                    void handleLogout();
                  }}
                >
                  Logout
                </MenuItem>
              </Menu>
            </div>
          ) : (
            // Unauthenticated state - show login button
            <Button
              color="inherit"
              onClick={handleLogin}
              sx={{
                borderRadius: 2,
                px: 3,
                textTransform: "none",
                fontWeight: "medium",
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              Sign In
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default PrimaryAppBar;
