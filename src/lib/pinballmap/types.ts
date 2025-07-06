/**
 * TypeScript interfaces for PinballMap API responses
 */

export interface PinballMapMachine {
  id: number;
  name: string;
  year?: number;
  manufacturer?: string;
  ipdb_link?: string | null;
  ipdb_id?: number | null;
  kineticist_url?: string;
  opdb_id?: string | null;
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