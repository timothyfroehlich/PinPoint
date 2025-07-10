"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { type User, type Role } from "@prisma/client";
import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { Box, Button, Typography, Paper, Chip } from "@mui/material";
import { env } from "~/env.js";

type UserWithRole = User & { role: Role | null };

export function DevLogin() {
  const { user, isAuthenticated } = useCurrentUser();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchTestUsers() {
      try {
        const res = await fetch("/api/dev/users");
        if (!res.ok) {
          console.error(
            "Failed to fetch dev users:",
            res.status,
            res.statusText,
          );
          return;
        }
        const { users } = (await res.json()) as { users: UserWithRole[] };
        setUsers(users);
      } catch (error) {
        console.error("Error fetching dev users:", error);
      }
    }

    void fetchTestUsers();
  }, []);

  async function handleLogin(email: string) {
    setIsLoading(true);
    try {
      await signIn("credentials", {
        email,
        redirect: false,
      });
      // The page will refresh automatically when session changes
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function getRoleColor(
    role: Role | null,
  ):
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning" {
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

  if (env.NEXT_PUBLIC_NODE_ENV !== "development") {
    return null;
  }

  if (isAuthenticated && user) {
    return (
      <Paper
        elevation={1}
        sx={{
          position: "fixed",
          bottom: 16,
          left: 16,
          p: 2,
          backgroundColor: "success.light",
          color: "success.contrastText",
          minWidth: 250,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
          Dev Mode: Logged in as
        </Typography>
        <Typography variant="body2">
          {user.name} ({user.email ?? "No email"})
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        position: "fixed",
        bottom: 16,
        left: 16,
        p: 2,
        backgroundColor: "warning.light",
        color: "warning.contrastText",
        minWidth: 250,
        maxHeight: 400,
        overflow: "auto",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>
        Dev Mode: Quick Login
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {users.map((testUser) => (
          <Box
            key={testUser.id}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <Button
              variant="contained"
              size="small"
              disabled={isLoading}
              onClick={() => void handleLogin(testUser.email ?? "")}
              sx={{
                justifyContent: "flex-start",
                textTransform: "none",
                fontSize: "0.75rem",
                flex: 1,
              }}
            >
              {testUser.name}
            </Button>
            {testUser.role && (
              <Chip
                label={testUser.role.toUpperCase()}
                size="small"
                color={getRoleColor(testUser.role)}
                sx={{ fontSize: "0.6rem", height: "20px" }}
              />
            )}
          </Box>
        ))}

        {users.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Loading test users...
          </Typography>
        )}
      </Box>

      <Typography
        variant="caption"
        sx={{ mt: 2, display: "block", opacity: 0.8 }}
      >
        Development only - click to login as test user
      </Typography>
    </Paper>
  );
}
