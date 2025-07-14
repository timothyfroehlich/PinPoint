"use client";

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
} from "@mui/material";
import { useState } from "react";

const PrimaryAppBar = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <AppBar position="fixed" sx={{ bgcolor: "background.paper" }}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Logo & Branding */}
        <Box
          component="a"
          sx={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
          }}
          href="/dashboard"
        >
          <PlaceIcon sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6" noWrap component="div">
            PinPoint
          </Typography>
        </Box>

        {/* Primary Navigation */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            color="inherit"
            sx={{
              bgcolor: "primary.main",
              borderRadius: 2,
              px: 3,
              textTransform: "none",
              fontWeight: "medium",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            Dashboard
          </Button>
          <Button
            color="inherit"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: "none",
              fontWeight: "medium",
              "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            Issues
          </Button>
          <Button
            color="inherit"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: "none",
              fontWeight: "medium",
              "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            Games
          </Button>
        </Box>

        {/* User Profile Menu */}
        <div>
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar sx={{ bgcolor: "primary.main" }}>T</Avatar>
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
            <MenuItem onClick={handleClose}>Logout</MenuItem>
          </Menu>
        </div>
      </Toolbar>
    </AppBar>
  );
};

export default PrimaryAppBar;
