"use client";

import { Box, Grid, useTheme, useMediaQuery } from "@mui/material";
import * as React from "react";

import { IssueCreateForm } from "./IssueCreateForm";
import { RecentIssuesSidebar } from "./RecentIssuesSidebar";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";

interface IssueCreateViewProps {
  user: PinPointSupabaseUser | null;
  initialMachineId?: string | undefined;
}

export function IssueCreateView({
  user,
  initialMachineId,
}: IssueCreateViewProps): React.JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [selectedMachineId, setSelectedMachineId] = React.useState<
    string | null
  >(initialMachineId ?? null);

  if (isMobile) {
    // Mobile: Full width form, no sidebar
    return (
      <Box>
        <IssueCreateForm
          user={user}
          initialMachineId={initialMachineId}
          onMachineChange={setSelectedMachineId}
        />
      </Box>
    );
  }

  // Desktop: 2/3 form + 1/3 sidebar layout
  return (
    <Grid container spacing={4}>
      {/* Main Form - 2/3 width */}
      <Grid size={{ xs: 12, md: 8 }}>
        <IssueCreateForm
          user={user}
          initialMachineId={initialMachineId}
          onMachineChange={setSelectedMachineId}
        />
      </Grid>

      {/* Sidebar - 1/3 width */}
      <Grid size={{ xs: 12, md: 4 }}>
        <RecentIssuesSidebar
          selectedMachineId={selectedMachineId}
          user={user}
        />
      </Grid>
    </Grid>
  );
}
