/**
 * API mocker for PinballMap tests
 * Similar to DisPinMap's APIMocker pattern
 */

import type { PinballMapMachineDetailsResponse } from "../types";
import fixtureData from "./fixtures/api_responses/locations/location_26454_machine_details.json";

export class PinballMapAPIMocker {
  private originalFetch: typeof global.fetch;

  constructor() {
    this.originalFetch = global.fetch;
  }

  /**
   * Mock the fetch function to return fixture data
   */
  start(): void {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      // Mock machine details endpoint
      if (url.includes("/locations/26454/machine_details.json")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(fixtureData as PinballMapMachineDetailsResponse),
        } as Response);
      }

      // Mock location details endpoint
      if (url.includes("/locations/26454.json")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: 26454,
              name: "Austin Pinball Collective",
              machine_count: fixtureData.machines.length,
            }),
        } as Response);
      }

      // Mock 404 for unknown locations
      if (url.includes("/locations/999999")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response);
      }

      // Default: throw error for unmocked endpoints
      return Promise.reject(new Error(`Unmocked API call to: ${url}`));
    });
  }

  /**
   * Restore the original fetch function
   */
  stop(): void {
    global.fetch = this.originalFetch;
  }

  /**
   * Get the fixture data for testing
   */
  static getFixtureData(): PinballMapMachineDetailsResponse {
    return fixtureData as PinballMapMachineDetailsResponse;
  }
}
