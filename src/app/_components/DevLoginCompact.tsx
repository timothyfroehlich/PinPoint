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
import { useState, useEffect } from "react";

import {
  authenticateDevUser,
  getAuthResultMessage,
  isDevAuthAvailable,
} from "~/lib/auth/dev-auth";
import { createClient } from "~/lib/supabase/client";

interface DevUser {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
}

interface DevLoginCompactProps {
  onLogin?: () => void;
}

export function DevLoginCompact({
  onLogin: _onLogin,
}: DevLoginCompactProps): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testUsers, setTestUsers] = useState<DevUser[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  // Fetch test users from API
  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      setFetchingUsers(true);
      try {
        const response = await fetch("/api/dev/users");
        if (response.ok) {
          const data = (await response.json()) as { users: DevUser[] };
          setTestUsers(data.users);
        } else {
          console.warn("Failed to fetch dev users, using fallback");
          // Fallback to some basic users if API fails
          setTestUsers([
            {
              id: "1",
              name: "Test Admin",
              email: "admin@test.com",
              role: "admin",
            },
            {
              id: "2",
              name: "Test Member",
              email: "member@test.com",
              role: "member",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching dev users:", error);
        // Fallback users
        setTestUsers([
          {
            id: "1",
            name: "Test Admin",
            email: "admin@test.com",
            role: "admin",
          },
          {
            id: "2",
            name: "Test Member",
            email: "member@test.com",
            role: "member",
          },
        ]);
      } finally {
        setFetchingUsers(false);
      }
    };

    void fetchUsers();
  }, []);

  async function handleLogin(email: string): Promise<void> {
    setIsLoading(true);
    try {
      console.log("Dev immediate login as:", email);

      // Find the user to get their role
      const user = testUsers.find((u) => u.email === email);
      const supabase = createClient();

      const userData: { email: string; name?: string; role?: string } = {
        email,
      };
      if (user?.name) userData.name = user.name;
      if (user?.role) userData.role = user.role;

      const result = await authenticateDevUser(supabase, userData);

      const message = getAuthResultMessage(result);

      if (result.success) {
        console.log("Dev login successful:", result.method);
        // Only use browser APIs if running in browser
        if (typeof window !== "undefined") {
          alert(message);
          // Refresh the page to update auth state
          window.location.reload();
        }
      } else {
        console.error("Login failed:", result.error);
        if (typeof window !== "undefined") {
          alert(message);
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Login failed:", errorMessage);
      if (typeof window !== "undefined") {
        alert(`Login failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function getRoleColor(
    role: string | null,
  ): "error" | "primary" | "success" | "default" {
    switch (role?.toLowerCase()) {
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

  // Only show when dev authentication is available
  if (!isDevAuthAvailable()) {
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
          {fetchingUsers ? (
            <Typography
              variant="caption"
              sx={{ textAlign: "center", display: "block", py: 1 }}
            >
              Loading users...
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {testUsers.map((testUser) => (
                <Box
                  key={testUser.id}
                  sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                >
                  <Button
                    variant="contained"
                    size="small"
                    disabled={isLoading || fetchingUsers}
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
                    {testUser.name ?? testUser.email}
                  </Button>
                  <Chip
                    label={(testUser.role?.charAt(0) ?? "U").toUpperCase()}
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
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
