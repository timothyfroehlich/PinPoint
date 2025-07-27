import { Home as HomeIcon, Build as BuildIcon } from "@mui/icons-material";
import { Container, Box, Typography, Breadcrumbs, Link } from "@mui/material";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { IssueReportForm } from "~/components/issues/IssueReportForm";
import { MachineContext } from "~/components/machines/MachineContext";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

interface ReportIssuePageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: ReportIssuePageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;

    // Try to get machine details for metadata
    const machine = await api.machine.core.getById({ id: resolvedParams.id });
    const machineName = machine.name || machine.model.name;

    return {
      title: `Report Issue - ${machineName} - PinPoint`,
      description: `Report an issue with ${machine.model.name} at ${machine.location.name}`,
      openGraph: {
        title: `Report Issue - ${machineName}`,
        description: `Report an issue with ${machine.model.name} at ${machine.location.name}`,
        type: "website",
      },
    };
  } catch {
    return {
      title: "Report Issue - PinPoint",
      description: "Report an issue with this machine",
    };
  }
}

export default async function ReportIssuePage({
  params,
}: ReportIssuePageProps): Promise<React.JSX.Element> {
  const session = await auth();
  const resolvedParams = await params;

  // Check if machine exists by trying to fetch it
  try {
    // Use public endpoint to verify machine exists in the organization
    await api.machine.core.getByIdPublic({ id: resolvedParams.id });
  } catch {
    // Machine doesn't exist or doesn't belong to this organization
    notFound();
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
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
          href={`/machines/${resolvedParams.id}`}
          sx={{ display: "flex", alignItems: "center" }}
        >
          <BuildIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Machine Details
        </Link>
        <Typography color="text.primary">Report Issue</Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Report an Issue
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Help us keep the machines running smoothly by reporting any issues you
          encounter.
        </Typography>
      </Box>

      {/* Machine Context */}
      <Box sx={{ mb: 4 }}>
        <MachineContext machineId={resolvedParams.id} />
      </Box>

      {/* Issue Report Form */}
      <IssueReportForm
        machineId={resolvedParams.id}
        onSuccess={() => {
          // Could redirect or show additional success actions
          console.log("Issue reported successfully");
        }}
      />

      {/* Additional Information for Anonymous Users */}
      {!session && (
        <Box
          sx={{
            mt: 4,
            p: 3,
            bgcolor: "info.light",
            color: "info.contrastText",
            borderRadius: 1,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Want to track your issues?
          </Typography>
          <Typography variant="body2">
            <Link
              href="/api/auth/signin"
              color="inherit"
              sx={{ textDecoration: "underline" }}
            >
              Sign in
            </Link>{" "}
            to track your reported issues, get notifications when they're
            resolved, and access additional features.
          </Typography>
        </Box>
      )}
    </Container>
  );
}
