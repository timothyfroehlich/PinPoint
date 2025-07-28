"use client";

import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import * as React from "react";

import { api } from "~/trpc/react";

interface MachineSelectorProps {
  value: string;
  onChange: (machineId: string | null) => void;
  required?: boolean;
}

export function MachineSelector({
  value,
  onChange,
  required = false,
}: MachineSelectorProps): React.JSX.Element {
  // Get all machines for the current organization
  const { data: machines = [] } = api.machine.core.getAll.useQuery();

  const handleChange = (event: SelectChangeEvent): void => {
    const selectedValue = event.target.value;
    onChange(selectedValue === "" ? null : selectedValue);
  };

  return (
    <FormControl fullWidth required={required}>
      <InputLabel id="machine-selector-label">Select Machine</InputLabel>
      <Select
        labelId="machine-selector-label"
        value={value}
        label="Select Machine"
        onChange={handleChange}
      >
        <MenuItem value="">
          <em>Select a machine</em>
        </MenuItem>
        {machines.map((machine) => (
          <MenuItem key={machine.id} value={machine.id}>
            {machine.name} ({machine.model.name})
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
