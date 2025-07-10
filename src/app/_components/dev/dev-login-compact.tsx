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
import { type User, type Role } from "@prisma/client";
import { usePathname, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import { env } from "~/env.js";
import { useCurrentUser } from "~/lib/hooks/use-current-user";

type UserWithRole = User & { role: Role | null };

export function DevLoginCompact() {
  const { user, isAuthenticated } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
      const result = await signIn("credentials", {
        email,
        redirect: false,
      });

      if (result?.ok) {
        router.refresh();
      } else {
        console.error("Sign-in failed:", result?.error);
      }
      // The session will be refetched automatically by NextAuth's SessionProvider.
      // The useCurrentUser hook will then update, and the component will re-render.
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

  if (env.NEXT_PUBLIC_NODE_ENV !== "development" || pathname === "/sign-in") {
    return null;
  }

  if (isAuthenticated && user) {
    return (
      <Paper
        elevation={1}
        sx={{
          position: "fixed",
          bottom: 16,
          right: 16,
          p: 1.5,
          backgroundColor: "success.light",
          color: "success.contrastText",
          minWidth: 200,
          maxWidth: 250,
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: "bold", fontSize: "0.75rem" }}
        >
          Dev: {user.name}
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
        right: 16,
        backgroundColor: "warning.light",
        color: "warning.contrastText",
        width: 220,
        maxHeight: isExpanded ? 320 : "auto",
        overflow: "hidden",
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
        onClick={() => setIsExpanded(!isExpanded)}
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
            {users.map((testUser) => (
              <Box
                key={testUser.id}
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <Button
                  variant="contained"
                  size="small"
                  disabled={isLoading}
                  onClick={() => void handleLogin(testUser.email ?? "")}
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
                {testUser.role && (
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
                )}
              </Box>
            ))}

            {users.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: "0.65rem" }}
              >
                Loading...
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}
