"use client";

import { Container, Typography, CircularProgress, Alert } from "@mui/material";
import React from "react";

import { IssueSubmissionForm } from "~/app/_components/issue-submission-form";
import { api } from "~/trpc/react";

// Simplified homepage - only shows issue submission form

export default function Home() {
  // API queries - only need game instances for the issue form (public endpoint)
  const {
    data: machines,
    isLoading: isLoadingInstances,
    error: instanceError,
  } = api.machine.getAllForIssues.useQuery();

  // No mutations needed for the public issue form

  const isLoading = isLoadingInstances;
  const hasError = instanceError;

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading...
        </Typography>
      </Container>
    );
  }

  if (hasError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading data: {instanceError?.message}
        </Alert>
      </Container>
    );
  }

  // Only show the issue submission form (besides the top bar)
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <IssueSubmissionForm machines={machines ?? []} />
    </Container>
  );
}
