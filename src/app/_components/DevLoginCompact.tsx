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
import { signIn } from "next-auth/react";
import { useState } from "react";

interface DevLoginCompactProps {
  onLogin?: () => void;
}

export function DevLoginCompact({
  onLogin: _onLogin,
}: DevLoginCompactProps): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mock test users for now - in real implementation this would fetch from API
  const testUsers = [
    { id: "1", name: "Test Admin", email: "admin@test.com", role: "admin" },
    { id: "2", name: "Test Member", email: "member@test.com", role: "member" },
    { id: "3", name: "Test Player", email: "player@test.com", role: "player" },
  ];

  async function handleLogin(email: string): Promise<void> {
    setIsLoading(true);
    try {
      console.log("Dev login as:", email);

      // Use NextAuth signIn with Credentials provider
      const result = await signIn("credentials", {
        email,
        redirect: false, // Don't redirect automatically
      });

      if (result.error) {
        console.error("Login failed:", result.error);
        alert(`Login failed: ${result.error}`);
      } else if (result.ok) {
        console.log("Login successful");
        // Refresh the page to show authenticated content
        window.location.reload();
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed - check console for details");
    } finally {
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

  // Only show in development or preview environments
  // In local dev: localhost
  // In preview: vercel.app domains
  // Hide in production deployments
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalDev =
      hostname === "localhost" || hostname.includes("127.0.0.1");
    const isPreview =
      hostname.includes("vercel.app") &&
      !hostname.includes("pin-point.vercel.app");

    if (!isLocalDev && !isPreview) {
      return null;
    }
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
                    void handleLogin(testUser.email);
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
