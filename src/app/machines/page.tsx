"use client";

import { Add as AddIcon } from "@mui/icons-material";
import { Container, Typography, Button, Box } from "@mui/material";

import { MachineList } from "./components/MachineList";

import { usePermissions } from "~/hooks/usePermissions";

export default function MachinesPage(): React.ReactElement {
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
        <Typography variant="h4" component="h1" fontWeight="bold">
          Machines
        </Typography>

        {hasPermission("machines:create") && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              backgroundColor: "#667eea",
              "&:hover": {
                backgroundColor: "#5a67d8",
              },
            }}
          >
            Add Machine
          </Button>
        )}
      </Box>

      {/* Machine List */}
      <MachineList />
    </Container>
  );
}
