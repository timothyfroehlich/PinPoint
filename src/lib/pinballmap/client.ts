/**
 * PinballMap API client
 * Handles interactions with the PinballMap.com API
 */

import type { PinballMapLocation, PinballMapMachineDetailsResponse } from './types';

const API_BASE_URL = 'https://pinballmap.com/api/v1';

export class PinballMapError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'PinballMapError';
  }
}

export class PinballMapClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch location details including basic information
   */
  async fetchLocationDetails(locationId: number): Promise<PinballMapLocation> {
    const url = `${this.baseUrl}/locations/${locationId}.json`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new PinballMapError(
          `Failed to fetch location ${locationId}: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json() as PinballMapLocation;
      return data;
    } catch (error) {
      if (error instanceof PinballMapError) {
        throw error;
      }
      throw new PinballMapError(
        `Network error fetching location ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetch machine details for a specific location
   * This is the primary endpoint we'll use for syncing
   */
  async fetchLocationMachineDetails(locationId: number): Promise<PinballMapMachineDetailsResponse> {
    const url = `${this.baseUrl}/locations/${locationId}/machine_details.json`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new PinballMapError(
          `Failed to fetch machine details for location ${locationId}: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json() as PinballMapMachineDetailsResponse;
      return data;
    } catch (error) {
      if (error instanceof PinballMapError) {
        throw error;
      }
      throw new PinballMapError(
        `Network error fetching machine details for location ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Default client instance
export const pinballMapClient = new PinballMapClient();

// Convenience functions using the default client
export const fetchLocationDetails = (locationId: number) => 
  pinballMapClient.fetchLocationDetails(locationId);

export const fetchLocationMachineDetails = (locationId: number) => 
  pinballMapClient.fetchLocationMachineDetails(locationId);