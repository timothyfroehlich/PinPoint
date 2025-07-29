"use client";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Avatar,
  CircularProgress,
} from "@mui/material";
import * as React from "react";

import { api } from "~/trpc/react";

interface MachineSelectorProps {
  value: string;
  onChange: (machineId: string | null) => void;
  required?: boolean;
}

interface MachineOption {
  id: string;
  name: string | null;
  model: {
    name: string;
  };
}

export function MachineSelector({
  value,
  onChange,
  required = false,
}: MachineSelectorProps): React.JSX.Element {
  const { data: machines, isLoading } =
    api.machine.core.getAllForIssues.useQuery();

  return (
    <FormControl fullWidth required={required}>
      <InputLabel>Select Machine</InputLabel>
      <Select
        value={value || ""}
        label="Select Machine"
        onChange={(e) => {
          onChange(e.target.value || null);
        }}
        disabled={isLoading}
        startAdornment={
          isLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : undefined
        }
        renderValue={(selectedValue) => {
          if (!selectedValue) return "";
          const machine = machines?.find((m) => m.id === selectedValue);
          return machine ? machine.name || machine.model.name : selectedValue;
        }}
      >
        <MenuItem value="">
          <em>Select a machine...</em>
        </MenuItem>
        {machines?.map((machine: MachineOption) => (
          <MenuItem key={machine.id} value={machine.id}>
            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  mr: 2,
                  bgcolor: "primary.main",
                  fontSize: "0.75rem",
                }}
              >
                🕹️
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight="medium">
                  {machine.name ?? machine.model.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {machine.model.name}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
