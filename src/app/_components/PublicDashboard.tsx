"use client";

import { LocationOn, SportsEsports } from "@mui/icons-material";
import { Box, Typography, Card, CardContent, Grid, Chip } from "@mui/material";

import { api } from "~/trpc/react";

interface LocationCardProps {
  location: {
    id: string;
    name: string;
    _count: { machines: number };
    machines: {
      id: string;
      name: string;
      model: { name: string; manufacturer: string | null };
      _count: { issues: number };
    }[];
  };
}

function LocationCard({ location }: LocationCardProps): React.ReactNode {
  const totalIssues = location.machines.reduce(
    (sum, machine) => sum + machine._count.issues,
    0,
  );

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        "&:hover": { elevation: 4 },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <LocationOn sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6" component="h2">
            {location.name}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <SportsEsports sx={{ mr: 1, fontSize: "1.1rem" }} />
          <Typography variant="body2" color="text.secondary">
            {location._count.machines.toString()} machines
          </Typography>
        </Box>

        {totalIssues > 0 && (
          <Chip
            label={`${totalIssues.toString()} active issues`}
            size="small"
            color="warning"
            sx={{ mt: 1 }}
          />
        )}

        {/* Show popular machines */}
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 1, display: "block" }}
          >
            Featured Machines:
          </Typography>
          {location.machines.slice(0, 3).map((machine) => (
            <Typography
              key={machine.id}
              variant="caption"
              sx={{ display: "block", fontSize: "0.7rem" }}
            >
              • {machine.model.name}
            </Typography>
          ))}
          {location.machines.length > 3 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.7rem" }}
            >
              ... and {(location.machines.length - 3).toString()} more
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export function PublicDashboard(): React.ReactNode {
  const { data: organization, isLoading: orgLoading } =
    api.organization.getCurrent.useQuery();
  const { data: locations, isLoading: locationsLoading } =
    api.location.getPublic.useQuery();

  if (orgLoading || locationsLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="error">Organization not found</Typography>
      </Box>
    );
  }

  const totalMachines =
    locations?.reduce((sum, loc) => sum + loc._count.machines, 0) ?? 0;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      {/* Organization Header */}
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
          {organization.name}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          {(locations?.length ?? 0).toString()} locations •{" "}
          {totalMachines.toString()} pinball machines
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse our pinball locations and report issues to help keep the games
          running smoothly.
        </Typography>
      </Box>

      {/* Locations Grid */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 3 }}>
          Our Locations
        </Typography>

        {locations && locations.length > 0 ? (
          <Grid container spacing={3}>
            {locations.map((location) => (
              <Grid key={location.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <LocationCard location={location} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card sx={{ p: 3, textAlign: "center" }}>
            <Typography color="text.secondary">
              No locations available at this time.
            </Typography>
          </Card>
        )}
      </Box>
    </Box>
  );
}
