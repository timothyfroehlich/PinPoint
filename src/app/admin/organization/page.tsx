"use client";

import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import type { Organization } from "@prisma/client";

import { OrganizationLogoUpload } from "~/app/_components/organization-logo-upload";
import { api } from "~/trpc/react";

export default function OrganizationAdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(null);

  const {
    data: orgData,
    isLoading: orgIsLoading,
    error: orgError,
  } = api.organization.getCurrent.useQuery(undefined, {
    enabled: status === "authenticated",
  });

  const updateOrganization = api.organization.update.useMutation({
    onSuccess: (updatedOrg: Organization) => {
      setOrganization(updatedOrg);
      alert("Organization updated successfully!");
    },
    onError: (error) => {
      alert(`Error updating organization: ${error.message}`);
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin");
    }
    if (session?.user.role !== "admin") {
      // Or redirect to an unauthorized page
      // For now, just push to home
      router.push("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (orgData) {
      setOrganization(orgData);
      setName(orgData.name);
      setLogoUrl(orgData.logoUrl);
    }
  }, [orgData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    updateOrganization.mutate({ name, logoUrl: logoUrl ?? undefined });
  };

  if (status === "loading" || orgIsLoading) {
    return (
      <Container>
        <CircularProgress />
      </Container>
    );
  }

  if (orgError) {
    return (
      <Container>
        <Alert severity="error">
          Error loading organization data: {orgError.message}
        </Alert>
      </Container>
    );
  }

  if (!organization) {
    return (
      <Container>
        <Alert severity="warning">No organization data found.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Manage Organization
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Organization Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            margin="normal"
            required
          />

          <OrganizationLogoUpload
            currentLogoUrl={logoUrl}
            onUploadComplete={(newUrl) => setLogoUrl(newUrl)}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={updateOrganization.isPending}
          >
            {updateOrganization.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Box>
    </Container>
  );
}
