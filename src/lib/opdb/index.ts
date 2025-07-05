/**
 * OPDB Library
 *
 * Open Pinball Database integration for PinPoint
 */

// Export main client
export { OPDBClient, opdbClient } from './client';

// Export all types
export type {
  OPDBSearchResult,
  OPDBMachine,
  OPDBMachineDetails,
  OPDBParsedId,
  OPDBAPIResponse,
  OPDBSearchResponse,
  OPDBExportResponse,
} from './types';

// Export utilities
export {
  parseOPDBId,
  isValidOPDBId,
  getGroupIdFromOPDBId,
  buildOPDBId,
  getPreferredImageUrl,
  formatMachineName,
  normalizeDescription,
  generateCacheKey,
  isDataStale,
} from './utils';
