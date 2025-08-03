"use client";

import { Google } from "@mui/icons-material";
import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  Container,
  Stack,
  Divider,
} from "@mui/material";
import { type User, type Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { useAuth } from "~/app/auth-provider";
import { authenticateDevUser, getAuthResultMessage } from "~/lib/auth/dev-auth";
import { isDevAuthAvailable } from "~/lib/environment-client";
import { createClient } from "~/lib/supabase/client";

type UserWithRole = User & { role: Role | null };

// Check if dev features are available
const shouldShowDevLogin = isDevAuthAvailable();

export default function SignInPage(): React.ReactElement | null {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const isAuthenticated = !loading && !!user;

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (shouldShowDevLogin) {
      async function fetchTestUsers(): Promise<void> {
        setIsLoadingUsers(true);
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
        } finally {
          setIsLoadingUsers(false);
        }
      }

      void fetchTestUsers();
    }
  }, []);

  async function handleGoogleSignIn(): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        console.error("Google sign in failed:", error.message);
      }
    } catch (error) {
      console.error("Google sign in failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevLogin(email: string): Promise<void> {
    setIsLoading(true);
    try {
      console.log("Dev immediate login as:", email);

      // Find the user to get their role
      const testUser = users.find((u) => u.email === email);
      const supabase = createClient();

      const userData: { email: string; name?: string; role?: string } = {
        email,
      };
      if (testUser?.name) userData.name = testUser.name;
      if (testUser?.role?.name) userData.role = testUser.role.name;

      const result = await authenticateDevUser(supabase, userData);

      const message = getAuthResultMessage(result);

      if (result.success) {
        console.log("Dev login successful:", result.method);
        alert(message);
        // Refresh the page to update auth state
        window.location.reload();
      } else {
        console.error("Login failed:", result.error);
        alert(message);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Dev login failed:", errorMessage);
      alert(`Login failed: ${errorMessage}`);
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
    if (!role) return "default";
    switch (role.name.toLowerCase()) {
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

  if (isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Sign In to PinPoint
        </Typography>

        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          sx={{ mb: 4 }}
        >
          Welcome back! Please sign in to continue.
        </Typography>

        <Stack spacing={3}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Google />}
            onClick={() => void handleGoogleSignIn()}
            disabled={isLoading}
            fullWidth
            sx={{ py: 1.5 }}
          >
            Sign in with Google
          </Button>

          {shouldShowDevLogin && (
            <>
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Development Mode
                </Typography>
              </Divider>

              <Box>
                <Typography variant="body1" gutterBottom>
                  Quick Login (Dev Only)
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Skip authentication and login as a test user
                </Typography>

                <Stack spacing={1}>
                  {isLoadingUsers ? (
                    <Typography variant="body2" color="text.secondary">
                      Loading test users...
                    </Typography>
                  ) : (
                    users.map((testUser) => (
                      <Box
                        key={testUser.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 0.5,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                        }}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={isLoading}
                          onClick={() =>
                            void handleDevLogin(testUser.email ?? "")
                          }
                          sx={{
                            justifyContent: "flex-start",
                            textTransform: "none",
                            flex: 1,
                            fontSize: "0.75rem",
                            py: 0.5,
                          }}
                        >
                          {testUser.name}
                        </Button>
                        {testUser.role && (
                          <Chip
                            label={testUser.role.name.toUpperCase()}
                            size="small"
                            color={getRoleColor(testUser.role)}
                            sx={{ fontSize: "0.6rem", height: "18px" }}
                          />
                        )}
                      </Box>
                    ))
                  )}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
