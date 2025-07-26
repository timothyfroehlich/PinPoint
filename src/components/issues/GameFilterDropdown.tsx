"use client";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
} from "@mui/material";
import { useState, useEffect } from "react";

import { api } from "~/trpc/react";

interface GameFilterDropdownProps {
  value: string;
  onChange: (machineId: string) => void;
  label?: string;
}

interface MachineOption {
  id: string;
  name: string;
  modelName: string;
  displayName: string;
}

export function GameFilterDropdown({
  value,
  onChange,
  label = "Machine/Game",
}: GameFilterDropdownProps): React.JSX.Element {
  const { data: machines, isLoading } = api.machine.core.getAll.useQuery();
  const [options, setOptions] = useState<MachineOption[]>([]);

  // Transform machines into display options
  useEffect(() => {
    if (machines) {
      const transformedOptions: MachineOption[] = machines.map((machine) => {
        // Use machine name if different from model name, otherwise just model name
        const displayName =
          machine.name !== machine.model.name
            ? `${machine.name} (${machine.model.name})`
            : machine.model.name;

        return {
          id: machine.id,
          name: machine.name,
          modelName: machine.model.name,
          displayName,
        };
      });

      // Sort by display name for better UX
      transformedOptions.sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );

      setOptions(transformedOptions);
    }
  }, [machines]);

  const handleChange = (event: SelectChangeEvent): void => {
    onChange(event.target.value);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="game-filter-label">{label}</InputLabel>
      <Select
        labelId="game-filter-label"
        value={value}
        onChange={handleChange}
        label={label}
        disabled={isLoading}
      >
        <MenuItem value="">
          <em>All Machines</em>
        </MenuItem>
        {options.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.displayName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
