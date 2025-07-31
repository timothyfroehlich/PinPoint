"use client";

import {
  Edit as EditIcon,
  LocationOn as LocationIcon,
} from "@mui/icons-material";
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
} from "@mui/material";

import { MachineGrid } from "./MachineGrid";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";
import type { RouterOutputs } from "~/trpc/react";

import { PermissionGate } from "~/components/permissions";
import { usePermissions } from "~/hooks/usePermissions";

type LocationWithDetails = RouterOutputs["location"]["getById"];

interface LocationDetailViewProps {
  location: LocationWithDetails;
  user: PinPointSupabaseUser | null;
  locationId: string;
}

export function LocationDetailView({
  location,
  user: _user,
  locationId,
}: LocationDetailViewProps): React.ReactElement {
  const { hasPermission } = usePermissions();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
      >
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <LocationIcon sx={{ fontSize: 28, color: "text.secondary" }} />
            <Typography variant="h4" component="h1">
              {location.name}
            </Typography>
          </Box>
          <Typography variant="h6" color="text.secondary">
            {location.machines.length} machine
            {location.machines.length !== 1 ? "s" : ""}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box display="flex" gap={2}>
          <PermissionGate
            permission="location:edit"
            hasPermission={hasPermission}
          >
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => {
                // TODO: Navigate to edit page or open edit dialog
                console.log("Edit location:", locationId);
              }}
            >
              Edit Location
            </Button>
          </PermissionGate>

          <PermissionGate
            permission="organization:manage"
            hasPermission={hasPermission}
          >
            <Button
              variant="outlined"
              onClick={() => {
                // TODO: Show PinballMap sync dialog
                console.log("Sync with PinballMap:", locationId);
              }}
            >
              Sync PinballMap
            </Button>
          </PermissionGate>
        </Box>
      </Box>

      <Grid container spacing={4}>
        {/* Location Information Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Location Information
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Name
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {location.name}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Machines
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {location.machines.length}
                </Typography>
              </Box>

              {/* TODO: Add additional location details when available */}
              {/* Address, contact info, hours, etc. */}
            </CardContent>
          </Card>
        </Grid>

        {/* Machine Grid Section */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Typography variant="h6">Machines</Typography>
              </Box>

              <MachineGrid machines={location.machines} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
