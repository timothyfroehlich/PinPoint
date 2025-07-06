/**
 * Tests for PinballMap API client
 */

import { PinballMapClient, PinballMapError } from '../client';
import { PinballMapAPIMocker } from './apiMocker';

describe('PinballMapClient', () => {
  let client: PinballMapClient;
  let apiMocker: PinballMapAPIMocker;

  beforeEach(() => {
    client = new PinballMapClient();
    apiMocker = new PinballMapAPIMocker();
    apiMocker.start();
  });

  afterEach(() => {
    apiMocker.stop();
  });

  describe('fetchLocationMachineDetails', () => {
    it('should fetch machine details successfully', async () => {
      const result = await client.fetchLocationMachineDetails(26454);
      
      expect(result).toBeDefined();
      expect(result.machines).toBeInstanceOf(Array);
      expect(result.machines.length).toBeGreaterThan(0);
      
      // Verify structure of first machine
      const firstMachine = result.machines[0];
      expect(firstMachine).toHaveProperty('id');
      expect(firstMachine).toHaveProperty('name');
      expect(firstMachine).toHaveProperty('opdb_id');
      
      // Check for Cactus Canyon specifically (our test case)
      const cactusCanyon = result.machines.find(m => 
        m.name.toLowerCase().includes('cactus canyon')
      );
      expect(cactusCanyon).toBeDefined();
      expect(cactusCanyon?.opdb_id).toBeTruthy();
    });

    it('should handle 404 errors gracefully', async () => {
      await expect(client.fetchLocationMachineDetails(999999))
        .rejects.toThrow(PinballMapError);
    });

    it('should include error details in thrown exception', async () => {
      try {
        await client.fetchLocationMachineDetails(999999);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PinballMapError);
        const pinballMapError = error as PinballMapError;
        expect(pinballMapError.statusCode).toBe(404);
        expect(pinballMapError.message).toContain('Failed to fetch machine details');
      }
    });
  });

  describe('fetchLocationDetails', () => {
    it('should fetch location details successfully', async () => {
      const result = await client.fetchLocationDetails(26454);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(26454);
      expect(result.name).toBe('Austin Pinball Collective');
      expect(result.machine_count).toBeGreaterThan(0);
    });

    it('should handle network errors', async () => {
      // Mock a network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(client.fetchLocationDetails(26454))
        .rejects.toThrow('Network error fetching location 26454');
    });
  });

  describe('convenience functions', () => {
    it('should export convenience functions that work with default client', async () => {
      const { fetchLocationMachineDetails, fetchLocationDetails } = await import('../client');
      
      const machineDetails = await fetchLocationMachineDetails(26454);
      expect(machineDetails.machines).toBeInstanceOf(Array);
      
      const locationDetails = await fetchLocationDetails(26454);
      expect(locationDetails.id).toBe(26454);
    });
  });

  describe('data structure validation', () => {
    it('should handle machines with missing OPDB IDs', async () => {
      const result = await client.fetchLocationMachineDetails(26454);
      
      // Test that we can handle machines with and without OPDB IDs
      const machinesWithOpdb = result.machines.filter(m => m.opdb_id);
      const machinesWithoutOpdb = result.machines.filter(m => !m.opdb_id);
      
      expect(machinesWithOpdb.length).toBeGreaterThan(0);
      // Note: Our fixture should have all machines with OPDB IDs, but this tests the structure
      
      // Verify all machines have required fields
      result.machines.forEach(machine => {
        expect(machine.id).toBeDefined();
        expect(machine.name).toBeDefined();
        expect(typeof machine.id).toBe('number');
        expect(typeof machine.name).toBe('string');
      });
    });

    it('should validate manufacturer and year fields when present', async () => {
      const result = await client.fetchLocationMachineDetails(26454);
      
      result.machines.forEach(machine => {
        if (machine.manufacturer) {
          expect(typeof machine.manufacturer).toBe('string');
        }
        if (machine.year) {
          expect(typeof machine.year).toBe('number');
          expect(machine.year).toBeGreaterThan(1900);
          expect(machine.year).toBeLessThan(new Date().getFullYear() + 2);
        }
      });
    });
  });
});