import { Card, Typography, Box } from "@mui/material";
import Link from "next/link";

import { PermissionGate } from "~/components/permissions";
import type { IssueStatus, IssuePriority } from "~/lib/types/api";

interface DetailedIssueCardProps {
  id: string;
  title: string;
  machineName: string;
  status: IssueStatus;
  priority: IssuePriority;
  hasPermission?: (permission: string) => boolean;
}

const getStatusColor = (status: IssueStatus): string => {
  // If status is an object, use its color if available
  if (typeof status === "object" && status.color) {
    return status.color;
  }

  // Get status name (whether it's a string or object)
  const statusName = typeof status === "string" ? status : status.name;

  // Fallback based on status name for backward compatibility
  switch (statusName.toLowerCase()) {
    case "new":
    case "reported":
      return "#60a5fa"; // Blue
    case "in progress":
    case "diagnosing":
      return "#60a5fa"; // Blue
    case "acknowledged":
    case "awaiting parts":
      return "#fbbf24"; // Yellow
    case "resolved":
    case "fixed":
      return "#10b981"; // Green
    default:
      return "#a0aec0"; // Gray
  }
};

const getPriorityBorderColor = (priority: IssuePriority): string => {
  // If priority is an object, use its color if available
  if (typeof priority === "object" && priority.color) {
    return priority.color;
  }

  // Get priority name (whether it's a string or object)
  const priorityName = typeof priority === "string" ? priority : priority.name;

  // Fallback based on priority name for backward compatibility
  switch (priorityName.toLowerCase()) {
    case "high":
    case "urgent":
      return "#f87171"; // Red
    case "medium":
    case "normal":
      return "#fbbf24"; // Yellow
    case "low":
      return "#6b7280"; // Gray
    default:
      return "#6b7280"; // Gray
  }
};

const DetailedIssueCard = ({
  id,
  title,
  machineName,
  status,
  priority,
  hasPermission = () => true,
}: DetailedIssueCardProps): React.ReactElement => {
  const cardContent = (
    <Card
      sx={{
        p: 3,
        mb: 2,
        borderLeft: 4,
        borderColor: getPriorityBorderColor(priority),
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        "&:hover": {
          backgroundColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      <Box>
        <Typography variant="h6" fontWeight="medium" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {machineName}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: getStatusColor(status),
          fontWeight: "medium",
          textTransform: "lowercase",
        }}
      >
        {typeof status === "string" ? status : status.name}
      </Typography>
    </Card>
  );

  return (
    <PermissionGate permission="issue:view" hasPermission={hasPermission}>
      <Link href={`/issues/${id}`} passHref style={{ textDecoration: "none" }}>
        {cardContent}
      </Link>
    </PermissionGate>
  );
};

export default DetailedIssueCard;
