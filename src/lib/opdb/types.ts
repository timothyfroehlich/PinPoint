/**
 * OPDB API Types
 *
 * TypeScript interfaces for Open Pinball Database API responses
 */

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
  machineId?: string;
  aliasId?: string;
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
