"use client";

import { AccountCircle, Menu as MenuIcon } from "@mui/icons-material";
import PlaceIcon from "@mui/icons-material/Place";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  useMediaQuery,
  useTheme,
  Drawer,
  List,
  ListItem,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import React, { useState } from "react";

import type { JSX } from "react";

import { PermissionButton } from "~/components/permissions/PermissionButton";
import { usePermissions } from "~/hooks/usePermissions";

const PrimaryAppBar = (): JSX.Element => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { hasPermission } = usePermissions();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Responsive design: show mobile drawer for navigation on small screens
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const handleLogin = (): void => {
    void signIn();
  };

  const handleMobileDrawerToggle = (): void => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  return (
    <AppBar position="fixed" sx={{ bgcolor: "background.paper" }}>
      <Toolbar
        sx={{ justifyContent: "space-between", minHeight: { xs: 56, sm: 64 } }}
      >
        {/* Mobile Menu Button */}
        {isMobile && session && (
          <IconButton
            color="inherit"
            aria-label="open navigation menu"
            edge="start"
            onClick={handleMobileDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

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
                  onClick={() => {
                    router.push("/issues");
                  }}
                >
                  Issues
                </PermissionButton>
                <PermissionButton
                  permission="machine:view"
                  hasPermission={hasPermission}
                  showWhenDenied={false}
                  color="inherit"
                  onClick={() => {
                    router.push("/machines");
                  }}
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
                <PermissionButton
                  permission="location:view"
                  hasPermission={hasPermission}
                  showWhenDenied={false}
                  color="inherit"
                  onClick={() => {
                    router.push("/locations");
                  }}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    textTransform: "none",
                    fontWeight: "medium",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                  tooltipText="View locations and their machines"
                >
                  Locations
                </PermissionButton>
                <PermissionButton
                  permission="organization:manage"
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
                  tooltipText="Manage organization settings"
                  onClick={() => {
                    router.push("/settings");
                  }}
                >
                  Settings
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
            // Authenticated state - navigate to profile on click
            <IconButton
              size="large"
              aria-label="account of current user"
              onClick={() => {
                router.push("/profile");
              }}
              color="inherit"
            >
              {session.user.image ? (
                <Avatar
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}>
                  {session.user.name?.charAt(0) ?? "U"}
                </Avatar>
              )}
            </IconButton>
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

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={handleMobileDrawerToggle}
        sx={{ display: { md: "none" } }}
      >
        <Box sx={{ width: 250, pt: 2 }}>
          <List>
            <ListItem>
              <Button
                fullWidth
                sx={{ justifyContent: "flex-start" }}
                onClick={() => {
                  router.push("/");
                  handleMobileDrawerToggle();
                }}
              >
                Home
              </Button>
            </ListItem>
            {session && hasPermission("issue:view") && (
              <ListItem>
                <Button
                  fullWidth
                  sx={{ justifyContent: "flex-start" }}
                  onClick={() => {
                    router.push("/issues");
                    handleMobileDrawerToggle();
                  }}
                >
                  Issues
                </Button>
              </ListItem>
            )}
            {session && hasPermission("machine:view") && (
              <ListItem>
                <Button
                  fullWidth
                  sx={{ justifyContent: "flex-start" }}
                  onClick={() => {
                    router.push("/machines");
                    handleMobileDrawerToggle();
                  }}
                >
                  Games
                </Button>
              </ListItem>
            )}
            {session && hasPermission("location:view") && (
              <ListItem>
                <Button
                  fullWidth
                  sx={{ justifyContent: "flex-start" }}
                  onClick={() => {
                    router.push("/locations");
                    handleMobileDrawerToggle();
                  }}
                >
                  Locations
                </Button>
              </ListItem>
            )}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
};

export default PrimaryAppBar;
