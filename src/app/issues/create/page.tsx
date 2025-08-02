import { Home as HomeIcon, Build as BuildIcon } from "@mui/icons-material";
import { Container, Box, Typography, Breadcrumbs, Link } from "@mui/material";
import { type Metadata } from "next";
import * as React from "react";

import { IssueCreateView } from "~/components/issues/IssueCreateView";
import { getSupabaseUser } from "~/server/auth/supabase";

interface CreateIssuePageProps {
  searchParams: Promise<{
    machineId?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Create Issue - PinPoint",
  description: "Report a new issue with a pinball machine",
  openGraph: {
    title: "Create Issue - PinPoint",
    description: "Report a new issue with a pinball machine",
    type: "website",
  },
};

export default async function CreateIssuePage({
  searchParams,
}: CreateIssuePageProps): Promise<React.JSX.Element> {
  const user = await getSupabaseUser();
  const resolvedSearchParams = await searchParams;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          color="inherit"
          href="/"
          sx={{ display: "flex", alignItems: "center" }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Home
        </Link>
        <Link
          color="inherit"
          href="/issues"
          sx={{ display: "flex", alignItems: "center" }}
        >
          <BuildIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Issues
        </Link>
        <Typography color="text.primary">Create</Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Issue
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Report a problem with a pinball machine to help keep the games running
          smoothly.
        </Typography>
      </Box>

      {/* Main Issue Creation View */}
      <IssueCreateView
        user={user}
        initialMachineId={resolvedSearchParams.machineId}
      />
    </Container>
  );
}
