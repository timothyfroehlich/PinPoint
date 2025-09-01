/**
 * Next.js Context Mocking Pattern
 * Foundation Repair Plan Phase 2.3: Test Architecture Stabilization
 * 
 * Provides global Next.js mocking to resolve "headers called outside request scope" errors
 * Uses trusted subdomain pattern compatible with existing DAL test helpers
 */

import { vi } from 'vitest';

export function setupNextjsMocks() {
  vi.mock('next/headers', () => ({
    headers: vi.fn(() => new Headers({
      'x-organization-subdomain': 'test-org',
      'x-subdomain-verified': '1', // Trusted subdomain pattern
    })),
    cookies: vi.fn(() => new Map()),
  }));
}

// Auto-setup when imported as setupFile
setupNextjsMocks();