"use client";

import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useState, useEffect, useCallback } from "react";

import { api } from "~/trpc/react";

interface StatusCategoryOption {
  id: string;
  name: string;
  category: "NEW" | "IN_PROGRESS" | "RESOLVED";
  group: string;
}

interface StatusCategoryMultiSelectProps {
  value: string[];
  onChange: (statusIds: string[]) => void;
  label?: string;
}

// Helper function to get group label
const getGroupLabel = (category: string): string => {
  switch (category) {
    case "NEW":
      return "New Issues";
    case "IN_PROGRESS":
      return "In Progress";
    case "RESOLVED":
      return "Resolved";
    default:
      return "Other";
  }
};

export function StatusCategoryMultiSelect({
  value,
  onChange,
  label = "Status & Category",
}: StatusCategoryMultiSelectProps): React.JSX.Element {
  const { data: statuses, isLoading } = api.issueStatus.getAll.useQuery();
  const [options, setOptions] = useState<StatusCategoryOption[]>([]);

  // Transform statuses into grouped options
  useEffect(() => {
    if (statuses) {
      const transformedOptions: StatusCategoryOption[] = statuses.map(
        (status) => ({
          id: status.id,
          name: status.name,
          category: status.category,
          group: getGroupLabel(status.category),
        }),
      );
      setOptions(transformedOptions);
    }
  }, [statuses]);

  // Set default value to exclude resolved issues if no value provided
  useEffect(() => {
    if (value.length === 0 && options.length > 0) {
      const nonResolvedStatuses = options
        .filter((option) => option.category !== "RESOLVED")
        .map((option) => option.id);
      onChange(nonResolvedStatuses);
    }
  }, [value.length, options, onChange]);

  // Get selected options for display
  const selectedOptions = options.filter((option) => value.includes(option.id));

  const handleChange = useCallback(
    (
      _event: React.SyntheticEvent,
      newValue: readonly StatusCategoryOption[],
    ): void => {
      const newStatusIds = newValue.map((option) => option.id);
      onChange(newStatusIds);
    },
    [onChange],
  );

  return (
    <Autocomplete
      multiple
      value={selectedOptions}
      onChange={handleChange}
      options={options}
      getOptionLabel={(option) => option.name}
      groupBy={(option) => option.group}
      loading={isLoading}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderInput={(params) => {
        const { InputLabelProps, ...cleanParams } = params;
        return (
          <TextField
            {...cleanParams}
            label={label}
            size="small"
            slotProps={{
              inputLabel: {
                className: InputLabelProps.className ?? "",
              },
            }}
          />
        );
      }}
      renderGroup={(params) => (
        <Box key={params.key}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              px: 2,
              py: 1,
              backgroundColor: "grey.100",
              fontWeight: "bold",
              color: "text.secondary",
            }}
          >
            {params.group}
          </Typography>
          {params.children}
        </Box>
      )}
      sx={{
        minWidth: 200,
        "& .MuiAutocomplete-tag": {
          maxWidth: "150px",
        },
      }}
      slotProps={{
        chip: {
          variant: "outlined",
          size: "small",
          color: "primary",
        },
        popper: {
          sx: {
            "& .MuiAutocomplete-groupLabel": {
              backgroundColor: "grey.100",
              fontWeight: "bold",
            },
          },
        },
      }}
    />
  );
}
