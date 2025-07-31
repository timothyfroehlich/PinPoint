"use client";

import {
  LocationOn as LocationIcon,
  VideogameAsset as GamesIcon,
} from "@mui/icons-material";
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
} from "@mui/material";
import { useRouter } from "next/navigation";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";
import type { RouterOutputs } from "~/trpc/react";

type LocationWithMachineCount = RouterOutputs["location"]["getPublic"][number];

interface LocationListProps {
  locations: LocationWithMachineCount[];
  user: PinPointSupabaseUser | null;
}

export function LocationList({
  locations,
  user: _user,
}: LocationListProps): React.ReactElement {
  const router = useRouter();

  const handleLocationClick = (locationId: string): void => {
    router.push(`/locations/${locationId}`);
  };

  if (locations.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={8}
        >
          <LocationIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No Locations Found
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            There are no locations available to display.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <LocationIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h4" component="h1">
            Locations
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary">
          {locations.length} location{locations.length !== 1 ? "s" : ""} with
          pinball machines
        </Typography>
      </Box>

      {/* Location Grid */}
      <Grid container spacing={3}>
        {locations.map((location) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={location.id}>
            <Card
              onClick={() => {
                handleLocationClick(location.id);
              }}
              sx={{
                cursor: "pointer",
                height: "100%",
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ p: 3, height: "100%" }}>
                {/* Location Name */}
                <Typography
                  variant="h6"
                  fontWeight="medium"
                  sx={{ mb: 2 }}
                  noWrap
                >
                  {location.name}
                </Typography>

                {/* Machine Count */}
                <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                  <GamesIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {location._count.machines} machine
                    {location._count.machines !== 1 ? "s" : ""}
                  </Typography>
                </Box>

                {/* Sample Machines (first few) */}
                {location.machines.length > 0 && (
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Machines:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {location.machines.slice(0, 3).map((machine) => (
                        <Chip
                          key={machine.id}
                          label={machine.name || machine.model.name}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: "0.75rem" }}
                        />
                      ))}
                      {location.machines.length > 3 && (
                        <Chip
                          label={`+${String(location.machines.length - 3)} more`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ fontSize: "0.75rem" }}
                        />
                      )}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
