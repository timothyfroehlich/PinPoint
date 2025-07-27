"use client";

import { Alert, Box, CircularProgress, Typography } from "@mui/material";

import { api } from "~/trpc/react";

export interface MachineContextProps {
  machineId: string;
  className?: string;
}

export function MachineContext({
  machineId,
  className,
}: MachineContextProps): React.ReactElement {
  const {
    data: machineData,
    isLoading,
    error,
  } = api.machine.core.getById.useQuery({ id: machineId });

  // Handle className properly for strictest TypeScript
  const containerProps: { className?: string } = {};
  if (className) {
    containerProps.className = className;
  }

  if (isLoading) {
    return (
      <Box {...containerProps} display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    const alertProps: { severity: "error"; className?: string } = {
      severity: "error",
    };
    if (className) {
      alertProps.className = className;
    }
    return <Alert {...alertProps}>Failed to load machine information</Alert>;
  }

  if (!machineData) {
    const alertProps: { severity: "warning"; className?: string } = {
      severity: "warning",
    };
    if (className) {
      alertProps.className = className;
    }
    return <Alert {...alertProps}>Machine not found</Alert>;
  }

  return (
    <Box
      {...containerProps}
      sx={{
        p: 2,
        bgcolor: "grey.50",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "grey.200",
      }}
    >
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Machine Information
      </Typography>

      <Typography variant="h6" fontWeight="medium" gutterBottom>
        {machineData.name || machineData.model.name}
      </Typography>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Model: {machineData.model.name}
        {machineData.model.manufacturer &&
          ` • ${machineData.model.manufacturer}`}
        {machineData.model.year && ` • ${String(machineData.model.year)}`}
      </Typography>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Location: {machineData.location.name}
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Machine ID: {machineData.id}
      </Typography>
    </Box>
  );
}
