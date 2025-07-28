"use client";

import {
  Person as PersonIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip,
  Grid,
  TextField,
  InputAdornment,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

import type { RouterOutputs } from "~/trpc/react";

type MachineWithDetails =
  RouterOutputs["location"]["getById"]["machines"][number];

interface MachineGridProps {
  machines: MachineWithDetails[];
}

export function MachineGrid({
  machines,
}: MachineGridProps): React.ReactElement {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter machines based on search query
  const filteredMachines = useMemo(() => {
    if (!searchQuery.trim()) return machines;

    const query = searchQuery.toLowerCase();
    return machines.filter((machine) => {
      const machineName = (machine.name || machine.model.name).toLowerCase();
      const modelName = machine.model.name.toLowerCase();
      const manufacturer = machine.model.manufacturer?.toLowerCase() ?? "";

      return (
        machineName.includes(query) ||
        modelName.includes(query) ||
        manufacturer.includes(query)
      );
    });
  }, [machines, searchQuery]);

  const handleMachineClick = (machineId: string): void => {
    router.push(`/machines/${machineId}`);
  };

  if (machines.length === 0) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        py={6}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Machines
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This location doesn't have any machines yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Search Bar */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search machines, models, or manufacturers..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
        }}
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Results Count */}
      {searchQuery.trim() && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {filteredMachines.length} of {machines.length} machines
        </Typography>
      )}

      {/* Machine Grid */}
      {filteredMachines.length === 0 ? (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={6}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Matches Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search terms.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredMachines.map((machine) => {
            const machineName = machine.name || machine.model.name;

            return (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={machine.id}>
                <Card
                  onClick={() => {
                    handleMachineClick(machine.id);
                  }}
                  sx={{
                    borderLeft: 4,
                    borderColor: "#667eea",
                    cursor: "pointer",
                    height: "100%",
                    "&:hover": {
                      backgroundColor: "rgba(255,255,255,0.08)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Machine Name */}
                    <Typography variant="h6" fontWeight="medium" sx={{ mb: 1 }}>
                      {machineName}
                    </Typography>

                    {/* Model Name (if different from machine name) */}
                    {machine.name && machine.name !== machine.model.name && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {machine.model.name}
                      </Typography>
                    )}

                    {/* Manufacturer */}
                    {machine.model.manufacturer && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {machine.model.manufacturer}
                        {machine.model.year &&
                          ` (${String(machine.model.year)})`}
                      </Typography>
                    )}

                    {/* Owner */}
                    {machine.owner && (
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{ mb: 2 }}
                      >
                        <PersonIcon
                          sx={{ fontSize: 16, color: "text.secondary" }}
                        />
                        <Avatar
                          {...(machine.owner.image && {
                            src: machine.owner.image,
                          })}
                          sx={{ width: 20, height: 20 }}
                          alt={machine.owner.name ?? "Owner"}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {machine.owner.name}
                        </Typography>
                      </Box>
                    )}

                    {/* Bottom Row: Model Type and Issue Count */}
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mt: 2 }}
                    >
                      <Chip
                        label={machine.model.name}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.75rem" }}
                      />

                      {/* Issue Count Badge - TODO: Add actual issue count when available */}
                      {/* For now, this is a placeholder - real implementation would come from the API */}
                      {/* <Badge color="warning" badgeContent={0} max={99}>
                        <WarningIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                      </Badge> */}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
