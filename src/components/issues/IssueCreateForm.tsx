"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  Alert,
  Link,
  MenuItem,
  Select,
  InputLabel,
  Chip,
} from "@mui/material";
import * as React from "react";
import { useState } from "react";

import { MachineSelector } from "./MachineSelector";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";

import { PermissionGate } from "~/components/permissions";
import { usePermissions } from "~/hooks/usePermissions";
import { api } from "~/trpc/react";

interface IssueCreateFormProps {
  user: PinPointSupabaseUser | null;
  initialMachineId?: string | undefined;
  onMachineChange: (machineId: string | null) => void;
}

interface FormData {
  machineId: string;
  title: string;
  description: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  priorityId: string;
  assignedToId: string;
  reporterEmail: string;
  submitterName: string;
}

export function IssueCreateForm({
  user: _user,
  initialMachineId,
  onMachineChange,
}: IssueCreateFormProps): React.JSX.Element {
  const { hasPermission, isAuthenticated } = usePermissions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    machineId: initialMachineId ?? "",
    title: "",
    description: "",
    severity: "Medium",
    priorityId: "",
    assignedToId: "",
    reporterEmail: "",
    submitterName: "",
  });

  // Mock data for now - TODO: Replace with actual API calls
  const priorities = [
    { id: "1", name: "Low", order: 1 },
    { id: "2", name: "Medium", order: 2 },
    { id: "3", name: "High", order: 3 },
    { id: "4", name: "Critical", order: 4 },
  ];

  const users = [
    { id: "1", name: "John Doe", email: "john@example.com" },
    { id: "2", name: "Jane Smith", email: "jane@example.com" },
  ];

  // Mutations
  const createIssueMutation = api.issue.core.create.useMutation();
  const createPublicIssueMutation = api.issue.core.publicCreate.useMutation();

  const handleMachineChange = (machineId: string | null): void => {
    setFormData((prev) => ({ ...prev, machineId: machineId ?? "" }));
    onMachineChange(machineId);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.machineId) {
        throw new Error("Please select a machine");
      }

      if (!formData.title.trim()) {
        throw new Error("Please enter a title for the issue");
      }

      if (isAuthenticated) {
        // Authenticated user - use full create endpoint
        const payload: {
          title: string;
          description?: string;
          severity: "Low" | "Medium" | "High" | "Critical";
          machineId: string;
          priorityId?: string;
          assignedToId?: string;
        } = {
          title: formData.title.trim(),
          severity: formData.severity,
          machineId: formData.machineId,
        };

        if (formData.description.trim()) {
          payload.description = formData.description.trim();
        }

        if (formData.priorityId && hasPermission("issue:create")) {
          payload.priorityId = formData.priorityId;
        }

        if (formData.assignedToId && hasPermission("issue:assign")) {
          payload.assignedToId = formData.assignedToId;
        }

        await createIssueMutation.mutateAsync(payload);
      } else {
        // Anonymous user - use public endpoint
        const payload: {
          title: string;
          description?: string;
          machineId: string;
          reporterEmail?: string;
          submitterName?: string;
        } = {
          title: formData.title.trim(),
          machineId: formData.machineId,
        };

        if (formData.description.trim()) {
          payload.description = formData.description.trim();
        }

        if (formData.reporterEmail.trim()) {
          payload.reporterEmail = formData.reporterEmail.trim();
        }

        if (formData.submitterName.trim()) {
          payload.submitterName = formData.submitterName.trim();
        }

        await createPublicIssueMutation.mutateAsync(payload);
      }

      setSuccess(true);
      // Reset form
      setFormData({
        machineId: initialMachineId ?? "",
        title: "",
        description: "",
        severity: "Medium",
        priorityId: "",
        assignedToId: "",
        reporterEmail: "",
        submitterName: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h5" color="success.main" gutterBottom>
            ✅ Issue Created Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Your issue has been reported and the appropriate team members have
            been notified.
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              setSuccess(false);
            }}
            sx={{ mr: 2 }}
          >
            Create Another Issue
          </Button>
          <Button variant="outlined" href="/issues">
            View All Issues
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => {
              setError(null);
            }}
          >
            {error}
          </Alert>
        )}

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          {/* Machine Selection */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Select Machine
            </Typography>
            <MachineSelector
              value={formData.machineId}
              onChange={handleMachineChange}
              required
            />
          </Box>

          {/* Issue Details */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Issue Details
            </Typography>

            <TextField
              fullWidth
              label="Issue Title"
              value={formData.title}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, title: e.target.value }));
              }}
              required
              sx={{ mb: 3 }}
              placeholder="Brief description of the problem"
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              value={formData.description}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }));
              }}
              multiline
              rows={4}
              sx={{ mb: 3 }}
              placeholder="Detailed description of the issue, steps to reproduce, etc."
            />

            {/* Severity - Available to everyone */}
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">Severity</FormLabel>
              <RadioGroup
                row
                value={formData.severity}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    severity: e.target.value as FormData["severity"],
                  }));
                }}
              >
                <FormControlLabel value="Low" control={<Radio />} label="Low" />
                <FormControlLabel
                  value="Medium"
                  control={<Radio />}
                  label="Medium"
                />
                <FormControlLabel
                  value="High"
                  control={<Radio />}
                  label="High"
                />
                <FormControlLabel
                  value="Critical"
                  control={<Radio />}
                  label="Critical"
                />
              </RadioGroup>
            </FormControl>
          </Box>

          {/* Advanced Options - Only for users with permissions */}
          <PermissionGate
            permission="issue:create"
            hasPermission={hasPermission}
          >
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Advanced Options
                <Chip
                  label="Full Permissions"
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Typography>

              {/* Priority Selection */}
              {priorities.length > 0 && (
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priorityId || ""}
                    label="Priority"
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        priorityId: e.target.value,
                      }));
                    }}
                  >
                    <MenuItem value="">
                      <em>Use Default Priority</em>
                    </MenuItem>
                    {priorities.map(
                      (priority: { id: string; name: string }) => (
                        <MenuItem key={priority.id} value={priority.id}>
                          {priority.name}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              )}

              {/* Assignment - Only for users with issue:assign */}
              <PermissionGate
                permission="issue:assign"
                hasPermission={hasPermission}
              >
                {users.length > 0 && (
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Assign To</InputLabel>
                    <Select
                      value={formData.assignedToId || ""}
                      label="Assign To"
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          assignedToId: e.target.value,
                        }));
                      }}
                    >
                      <MenuItem value="">
                        <em>Unassigned</em>
                      </MenuItem>
                      {users.map(
                        (user: { id: string; name: string; email: string }) => (
                          <MenuItem key={user.id} value={user.id}>
                            {user.name || user.email || "Unknown User"}
                          </MenuItem>
                        ),
                      )}
                    </Select>
                  </FormControl>
                )}
              </PermissionGate>
            </Box>
          </PermissionGate>

          {/* Anonymous User Email Field */}
          {!isAuthenticated && (
            <>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Get Email Updates
                </Typography>

                <TextField
                  fullWidth
                  label="Your Name (Optional)"
                  value={formData.submitterName}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      submitterName: e.target.value,
                    }));
                  }}
                  sx={{ mb: 2 }}
                  placeholder="How would you like to be identified?"
                />

                <TextField
                  fullWidth
                  type="email"
                  label="Your Email (Optional)"
                  value={formData.reporterEmail}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      reporterEmail: e.target.value,
                    }));
                  }}
                  sx={{ mb: 2 }}
                  placeholder="Get notified when your issue is resolved"
                />

                <Alert severity="info" sx={{ mb: 3 }}>
                  💡{" "}
                  <Link href="/api/auth/signin" sx={{ fontWeight: "medium" }}>
                    Sign in
                  </Link>{" "}
                  to track your issues, get notifications, and access additional
                  features.
                </Alert>
              </Box>
            </>
          )}

          {/* Submit Button */}
          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button type="button" variant="outlined" href="/issues">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || !formData.machineId || !formData.title}
            >
              {isSubmitting ? "Creating..." : "Create Issue"}
            </Button>
          </Box>
        </form>
      </CardContent>
    </Card>
  );
}
