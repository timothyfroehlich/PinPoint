"use client";

import { Google } from "@mui/icons-material";
import {
  Box,
  Card,
  Typography,
  Button,
  Divider,
  Container,
  Alert,
} from "@mui/material";
import { signIn, getProviders } from "next-auth/react";
import { useEffect, useState } from "react";

import type { ProviderId } from "@auth/core/providers";

import { DevLoginCompact } from "~/app/_components/DevLoginCompact";

// Define the provider type based on NextAuth v5's actual interface
interface Provider {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
}

export default function SignInPage(): React.JSX.Element {
  const [providers, setProviders] = useState<Record<
    ProviderId,
    Provider
  > | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders(): Promise<void> {
      try {
        const availableProviders = await getProviders();
        setProviders(availableProviders);
      } catch (err) {
        console.error("Failed to fetch providers:", err);
        setError("Failed to load authentication providers");
      }
    }
    void fetchProviders();
  }, []);

  async function handleSignIn(providerId: string): Promise<void> {
    try {
      setIsLoading(providerId);
      setError(null);

      const result = await signIn(providerId, {
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result.error) {
        setError(`Authentication failed: ${result.error}`);
      } else if (result.ok) {
        // Redirect will happen automatically via NextAuth
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Sign-in error:", err);
      setError("An unexpected error occurred during sign-in");
    } finally {
      setIsLoading(null);
    }
  }

  function getProviderIcon(providerId: string): React.ReactNode {
    switch (providerId) {
      case "google":
        return <Google />;
      default:
        return null;
    }
  }

  function getProviderLabel(provider: Provider): string {
    switch (provider.id) {
      case "google":
        return "Continue with Google";
      case "credentials":
        return provider.name || "Continue with Email";
      default:
        return `Continue with ${provider.name}`;
    }
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
        }}
      >
        <Card sx={{ p: 4, width: "100%" }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Welcome to PinPoint
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to access your pinball machine management dashboard
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {providers ? (
              Object.values(providers)
                .filter((provider) => provider.id !== "credentials") // Show OAuth providers first
                .map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outlined"
                    size="large"
                    fullWidth
                    disabled={isLoading === provider.id}
                    startIcon={getProviderIcon(provider.id)}
                    onClick={() => {
                      void handleSignIn(provider.id);
                    }}
                    sx={{
                      py: 1.5,
                      textTransform: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {isLoading === provider.id
                      ? "Signing in..."
                      : getProviderLabel(provider)}
                  </Button>
                ))
            ) : (
              <Button
                variant="outlined"
                size="large"
                fullWidth
                disabled
                sx={{ py: 1.5 }}
              >
                Loading authentication options...
              </Button>
            )}

            {/* Show credentials provider separately if available */}
            {providers &&
              Object.values(providers).find((p) => p.id === "credentials") && (
                <>
                  <Divider sx={{ my: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Development
                    </Typography>
                  </Divider>
                  <Button
                    variant="text"
                    size="large"
                    fullWidth
                    disabled={isLoading === "credentials"}
                    onClick={() => {
                      void handleSignIn("credentials");
                    }}
                    sx={{
                      py: 1.5,
                      textTransform: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {isLoading === "credentials"
                      ? "Signing in..."
                      : getProviderLabel(
                          Object.values(providers).find(
                            (p) => p.id === "credentials",
                          ) ?? {
                            id: "credentials",
                            name: "Credentials",
                            type: "credentials",
                            signinUrl: "",
                            callbackUrl: "",
                          },
                        )}
                  </Button>
                </>
              )}
          </Box>

          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              By signing in, you agree to our terms of service and privacy
              policy.
            </Typography>
          </Box>
        </Card>
      </Box>

      {/* Development quick login component */}
      <DevLoginCompact />
    </Container>
  );
}
