"use client";

import { ExpandMore, FilterList } from "@mui/icons-material";
import {
  Button,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Typography,
  Divider,
  type SelectChangeEvent,
} from "@mui/material";
import { useState } from "react";

import { api } from "~/trpc/react";

interface AdvancedFiltersDropdownProps {
  assigneeId: string;
  reporterId: string;
  ownerId: string;
  onAssigneeChange: (assigneeId: string) => void;
  onReporterChange: (reporterId: string) => void;
  onOwnerChange: (ownerId: string) => void;
}

export function AdvancedFiltersDropdown({
  assigneeId,
  reporterId,
  ownerId,
  onAssigneeChange,
  onReporterChange,
  onOwnerChange,
}: AdvancedFiltersDropdownProps): React.JSX.Element {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { data: users, isLoading } = api.user.getAllInOrganization.useQuery();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleAssigneeChange = (event: SelectChangeEvent): void => {
    onAssigneeChange(event.target.value);
  };

  const handleReporterChange = (event: SelectChangeEvent): void => {
    onReporterChange(event.target.value);
  };

  const handleOwnerChange = (event: SelectChangeEvent): void => {
    onOwnerChange(event.target.value);
  };

  // Show active filter count
  const activeFilters = [assigneeId, reporterId, ownerId].filter(
    (filter) => filter !== "",
  ).length;

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleClick}
        endIcon={<ExpandMore />}
        startIcon={<FilterList />}
        size="small"
        sx={{
          minWidth: 120,
          color: activeFilters > 0 ? "primary.main" : "text.secondary",
          borderColor: activeFilters > 0 ? "primary.main" : "grey.300",
        }}
      >
        Filters
        {activeFilters > 0 && (
          <Typography
            component="span"
            variant="caption"
            sx={{
              ml: 0.5,
              px: 0.5,
              py: 0.25,
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              borderRadius: "50%",
              minWidth: "16px",
              fontSize: "0.625rem",
              lineHeight: 1,
            }}
          >
            {activeFilters}
          </Typography>
        )}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              minWidth: 280,
              p: 2,
            },
          },
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: "bold" }}>
            Advanced Filters
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel id="assignee-filter-label">Assignee</InputLabel>
            <Select
              labelId="assignee-filter-label"
              value={assigneeId}
              onChange={handleAssigneeChange}
              label="Assignee"
              disabled={isLoading}
            >
              <MenuItem value="">
                <em>Any Assignee</em>
              </MenuItem>
              <MenuItem value="unassigned">
                <em>Unassigned</em>
              </MenuItem>
              <Divider />
              {users?.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name ?? "Unknown User"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel id="reporter-filter-label">Reporter</InputLabel>
            <Select
              labelId="reporter-filter-label"
              value={reporterId}
              onChange={handleReporterChange}
              label="Reporter"
              disabled={isLoading}
            >
              <MenuItem value="">
                <em>Any Reporter</em>
              </MenuItem>
              {users?.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name ?? "Unknown User"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="owner-filter-label">Machine Owner</InputLabel>
            <Select
              labelId="owner-filter-label"
              value={ownerId}
              onChange={handleOwnerChange}
              label="Machine Owner"
              disabled={isLoading}
            >
              <MenuItem value="">
                <em>Any Owner</em>
              </MenuItem>
              {users?.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name ?? "Unknown User"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" onClick={handleClose}>
              Done
            </Button>
          </Box>
        </Box>
      </Menu>
    </>
  );
}
