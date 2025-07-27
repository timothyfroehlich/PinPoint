"use client";

import { Person as PersonIcon, Place as PlaceIcon } from "@mui/icons-material";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip,
} from "@mui/material";
import { useRouter } from "next/navigation";

import type { RouterOutputs } from "~/trpc/react";

type MachineWithRelations = RouterOutputs["machine"]["core"]["getAll"][number];

interface MachineCardProps {
  machine: MachineWithRelations;
}

export function MachineCard({ machine }: MachineCardProps): React.ReactElement {
  const router = useRouter();
  const machineName = machine.name || machine.model.name;

  const handleClick = (): void => {
    router.push(`/machines/${machine.id}`);
  };

  return (
    <Card
      onClick={handleClick}
      sx={{
        borderLeft: 4,
        borderColor: "#667eea",
        cursor: "pointer",
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {machine.model.name}
          </Typography>
        )}

        {/* Location */}
        <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
          <PlaceIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          <Typography variant="body2" color="text.secondary">
            {machine.location.name}
          </Typography>
        </Box>

        {/* Owner */}
        {machine.owner && (
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <PersonIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Avatar
              {...(machine.owner.image && { src: machine.owner.image })}
              sx={{ width: 20, height: 20 }}
              alt={machine.owner.name ?? "Owner"}
            />
            <Typography variant="body2" color="text.secondary">
              {machine.owner.name}
            </Typography>
          </Box>
        )}

        {/* Model Info */}
        <Box display="flex" justifyContent="flex-end">
          <Chip
            label={machine.model.name}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.75rem" }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
