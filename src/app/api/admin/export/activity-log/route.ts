/**
 * Activity Log CSV Export API Route
 * Phase 4B.4: Download activity log as CSV file
 */

import { exportActivityLogAction } from "~/lib/actions/admin-actions";

export async function GET(): Promise<Response> {
  return await exportActivityLogAction();
}
