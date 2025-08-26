"use client";

import {
  Person as PersonIcon,
  Place as PlaceIcon,
  QrCode as QrCodeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip,
  Button,
  Grid,
  Divider,
  Link,
} from "@mui/material";
import NextLink from "next/link";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { MachineResponse } from "~/lib/types/api";

import { PermissionGate } from "~/components/permissions";
import { usePermissions } from "~/hooks/usePermissions";

interface MachineDetailViewProps {
  machine: MachineResponse;
  user: PinPointSupabaseUser | null;
  machineId: string;
}

export function MachineDetailView({
  machine,
  user: _user,
  machineId,
}: MachineDetailViewProps): React.ReactElement {
  const { hasPermission } = usePermissions();
  const machineName = machine.name || machine.model.name || "Unknown Machine";

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
          <Typography variant="h4" component="h1" gutterBottom>
            {machineName}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            {machine.model.name}
            {machine.model.manufacturer && ` • ${machine.model.manufacturer}`}
            {machine.model.year && ` • ${String(machine.model.year)}`}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box display="flex" gap={2}>
          <PermissionGate
            permission="machine:edit"
            hasPermission={hasPermission}
          >
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => {
                // TODO: Navigate to edit page
                console.log("Edit machine:", machineId);
              }}
            >
              Edit
            </Button>
          </PermissionGate>

          <PermissionGate
            permission="machine:delete"
            hasPermission={hasPermission}
          >
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                // TODO: Show delete confirmation
                console.log("Delete machine:", machineId);
              }}
            >
              Delete
            </Button>
          </PermissionGate>
        </Box>
      </Box>

      <Grid container spacing={4}>
        {/* Main Information Card */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Machine Information
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2}>
                  {/* Location */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={1}
                      sx={{ mb: 2 }}
                    >
                      <PlaceIcon
                        sx={{ fontSize: 20, color: "text.secondary" }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Location
                      </Typography>
                    </Box>
                    <Link
                      component={NextLink}
                      href={`/locations/${machine.location.id}`}
                      variant="body1"
                      fontWeight="medium"
                      sx={{
                        textDecoration: "none",
                        "&:hover": {
                          textDecoration: "underline",
                        },
                      }}
                    >
                      {machine.location.name}
                    </Link>
                    {machine.location.street && (
                      <Typography variant="body2" color="text.secondary">
                        {machine.location.street}
                        {machine.location.city && `, ${machine.location.city}`}
                        {machine.location.state &&
                          `, ${machine.location.state}`}
                      </Typography>
                    )}
                  </Grid>

                  {/* Owner */}
                  {machine.owner && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{ mb: 2 }}
                      >
                        <PersonIcon
                          sx={{ fontSize: 20, color: "text.secondary" }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Owner
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          {...(machine.owner.image && {
                            src: machine.owner.image,
                          })}
                          sx={{ width: 32, height: 32 }}
                          alt={machine.owner.name ?? "Owner"}
                        />
                        <Typography variant="body1" fontWeight="medium">
                          {machine.owner.name}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Model Details */}
              <Typography variant="h6" gutterBottom>
                Model Details
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Name
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {machine.model.name}
                  </Typography>
                </Grid>

                {machine.model.manufacturer && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Manufacturer
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {machine.model.manufacturer}
                    </Typography>
                  </Grid>
                )}

                {machine.model.year && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Year
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {machine.model.year}
                    </Typography>
                  </Grid>
                )}

                {machine.model.machineType && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Type
                    </Typography>
                    <Chip
                      label={machine.model.machineType}
                      size="small"
                      variant="outlined"
                    />
                  </Grid>
                )}
              </Grid>

              {/* External Links */}
              {(machine.model.ipdbLink ??
                machine.model.opdbImgUrl ??
                machine.model.kineticistUrl) && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" gutterBottom>
                    External Links
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {machine.model.ipdbLink && (
                      <Button
                        variant="outlined"
                        size="small"
                        href={machine.model.ipdbLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        IPDB
                      </Button>
                    )}
                    {machine.model.opdbImgUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        href={machine.model.opdbImgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        OPDB
                      </Button>
                    )}
                    {machine.model.kineticistUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        href={machine.model.kineticistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Kineticist
                      </Button>
                    )}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* QR Code Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: "center" }}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={1}
                mb={2}
              >
                <QrCodeIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                <Typography variant="h6">QR Code</Typography>
              </Box>

              {machine.qrCodeUrl ? (
                <Box>
                  <Box
                    component="img"
                    src={machine.qrCodeUrl}
                    alt={`QR Code for ${machineName}`}
                    sx={{
                      width: "100%",
                      maxWidth: 200,
                      height: "auto",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      mb: 2,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Scan to report issues
                  </Typography>
                  {machine.qrCodeGeneratedAt && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Generated{" "}
                      {new Date(machine.qrCodeGeneratedAt).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    QR code not available
                  </Typography>
                  <PermissionGate
                    permission="machine:edit"
                    hasPermission={hasPermission}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        // TODO: Generate QR code
                        console.log("Generate QR code for:", machineId);
                      }}
                    >
                      Generate QR Code
                    </Button>
                  </PermissionGate>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Machine Stats Card */}
          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {/* TODO: Add machine statistics */}
                Statistics coming soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
