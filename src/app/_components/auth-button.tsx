"use client";

import {
  Button,
  Box,
  Typography,
  Menu,
  MenuItem,
  IconButton,
  Divider,
} from "@mui/material";
import { AccountCircle, Settings, ExitToApp } from "@mui/icons-material";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserAvatar } from "./user-avatar";
import { useCurrentUser } from "~/lib/hooks/use-current-user";

export function AuthButton() {
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    handleMenuClose();
    router.push("/profile");
  };

  const handleSignOut = () => {
    handleMenuClose();
    void signOut();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="body2" color="inherit">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (isAuthenticated && user) {
    const displayUser = {
      id: user.id,
      name: user.name,
      profilePicture: user.image,
    };

    return (
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <IconButton
          onClick={handleMenuOpen}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "inherit",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.08)",
            },
          }}
        >
          <UserAvatar user={displayUser} size="small" showTooltip={false} />
          <Typography variant="body2" color="inherit" sx={{ ml: 1 }}>
            {displayUser.name ?? user.email ?? "Unknown User"}
          </Typography>
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 180,
            },
          }}
        >
          <MenuItem onClick={handleProfile}>
            <AccountCircle sx={{ mr: 2 }} />
            Profile
          </MenuItem>
          <MenuItem onClick={handleMenuClose} disabled>
            <Settings sx={{ mr: 2 }} />
            Settings
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleSignOut}>
            <ExitToApp sx={{ mr: 2 }} />
            Sign Out
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  return (
    <Button component={Link} href="/api/auth/signin" color="inherit">
      Sign In
    </Button>
  );
}
