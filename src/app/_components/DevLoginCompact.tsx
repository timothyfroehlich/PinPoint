"use client";

import { ExpandMore, ExpandLess } from "@mui/icons-material";
import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  Collapse,
  IconButton,
} from "@mui/material";
import { useState } from "react";

interface DevLoginCompactProps {
  onLogin?: () => void;
}

export function DevLoginCompact({ onLogin }: DevLoginCompactProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mock test users for now - in real implementation this would fetch from API
  const testUsers = [
    { id: "1", name: "Test Admin", email: "admin@test.com", role: "admin" },
    { id: "2", name: "Test Member", email: "member@test.com", role: "member" },
    { id: "3", name: "Test Player", email: "player@test.com", role: "player" },
  ];

  function handleLogin(email: string): void {
    setIsLoading(true);
    try {
      console.log("Dev login as:", email);
      // Simulate login success and call the parent's onLogin
      setTimeout(() => {
        setIsLoading(false);
        if (onLogin) {
          onLogin();
        }
      }, 500);
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
    }
  }

  function getRoleColor(
    role: string,
  ): "error" | "primary" | "success" | "default" {
    switch (role) {
      case "admin":
        return "error";
      case "member":
        return "primary";
      case "player":
        return "success";
      default:
        return "default";
    }
  }

  // Only show in development
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    return null;
  }

  return (
    <Paper
      elevation={2}
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        backgroundColor: "warning.light",
        color: "warning.contrastText",
        width: 220,
        maxHeight: isExpanded ? 320 : "auto",
        overflow: "hidden",
        zIndex: 1400, // Higher than modal backdrop (1300)
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
          cursor: "pointer",
        }}
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: "bold", fontSize: "0.75rem" }}
        >
          Dev Quick Login
        </Typography>
        <IconButton size="small" sx={{ color: "inherit", p: 0.5 }}>
          {isExpanded ? (
            <ExpandLess fontSize="small" />
          ) : (
            <ExpandMore fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        <Box sx={{ p: 1, pt: 0, maxHeight: 260, overflow: "auto" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {testUsers.map((testUser) => (
              <Box
                key={testUser.id}
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <Button
                  variant="contained"
                  size="small"
                  disabled={isLoading}
                  onClick={() => {
                    handleLogin(testUser.email);
                  }}
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    fontSize: "0.65rem",
                    flex: 1,
                    py: 0.5,
                    minHeight: "auto",
                  }}
                >
                  {testUser.name}
                </Button>
                <Chip
                  label={testUser.role.charAt(0).toUpperCase()}
                  size="small"
                  color={getRoleColor(testUser.role)}
                  sx={{
                    fontSize: "0.5rem",
                    height: "16px",
                    minWidth: "20px",
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}
