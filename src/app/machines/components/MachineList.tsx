"use client";

import { Grid, Typography, Box, CircularProgress } from "@mui/material";

import { MachineCard } from "./MachineCard";

import { api } from "~/trpc/react";
import type { MachineResponse } from "~/lib/types/api";

export function MachineList(): React.ReactElement {
  const {
    data: machines,
    isLoading,
    error,
  } = api.machine.core.getAll.useQuery();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Typography variant="body1" color="error">
          Error loading machines: {error.message}
        </Typography>
      </Box>
    );
  }

  if (!machines || machines.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Typography variant="body1" color="text.secondary">
          No machines found. Add your first machine to get started.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {machines.map((machine: MachineResponse) => {
        return (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={machine.id}>
            <MachineCard machine={machine} />
          </Grid>
        );
      })}
    </Grid>
  );
}
