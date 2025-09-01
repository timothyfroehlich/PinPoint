/**
 * External API Types
 *
 * TypeScript interfaces for external service API responses.
 * Centralized location for all third-party API type definitions.
 */

// ============================================
// OPDB (Open Pinball Database) API Types
// ============================================

export interface OPDBSearchResult {
  id: string;
  text: string;
  // Additional fields from OPDB search response
}

export interface OPDBMachine {
  id: string;
  name: string;
  manufacturer?: string;
  year?: number;
  type?: string;
  description?: string;
  images?: string[];
  // Additional OPDB fields
}

export interface OPDBParsedId {
  groupId: string;
  machineId?: string | undefined;
  aliasId?: string | undefined;
}

export interface OPDBAPIResponse<T> {
  data: T | null;
  success: boolean;
  error?: string;
}

export interface OPDBSearchResponse {
  results: OPDBSearchResult[];
  total: number;
}

export interface OPDBMachineDetails extends OPDBMachine {
  // Extended machine details from individual machine endpoint
  aliases?: string[];
  features?: string[];
  playfield_image?: string;
  backglass_image?: string;
  cabinet_image?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OPDBExportResponse {
  machines: OPDBMachine[];
  total: number;
  page: number;
  per_page: number;
}

// ============================================
// PinballMap API Types
// ============================================

export interface PinballMapMachine {
  id: number;
  name: string; // Display name from API
  machine_name?: string; // Alternative name field (optional)
  year?: number;
  manufacturer?: string;
  ipdb_link?: string | null;
  ipdb_id?: number | null; // Number from API, will be converted to string
  kineticist_url?: string;
  opdb_id?: string | null;

  // Enhanced fields from PinballMap API analysis
  machine_type?: string; // "em", "ss", "digital"
  machine_display?: string; // "reels", "dmd", "lcd", "alphanumeric"
  is_active?: boolean;
  opdb_img?: string; // Image URL from OPDB
}

export interface PinballMapMachineDetailsResponse {
  machines: PinballMapMachine[];
}

export interface PinballMapLocation {
  id: number;
  name: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  lat?: string;
  lon?: string;
  website?: string;
  description?: string;
  machine_count: number;
  location_machine_xrefs?: LocationMachineXref[];
}

export interface LocationMachineXref {
  id: number;
  created_at: string;
  updated_at: string;
  location_id: number;
  machine_id: number;
  user_id?: number | null;
  machine_score_xrefs_count?: number | null;
  ic_enabled?: boolean | null;
  last_updated_by_username?: string;
  machine_conditions?: MachineCondition[];
  machine_score_xrefs?: MachineScoreXref[];
}

export interface MachineCondition {
  id: number;
  comment: string;
  location_machine_xref_id: number;
  created_at: string;
  updated_at: string;
  user_id: number;
  username: string;
}

export interface MachineScoreXref {
  id: number;
  location_machine_xref_id: number;
  score: number;
  created_at: string;
  updated_at: string;
  user_id: number;
  rank?: number | null;
  username: string;
}
