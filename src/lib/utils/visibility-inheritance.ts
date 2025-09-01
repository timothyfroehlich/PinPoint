/**
 * Visibility Inheritance Utilities
 * Implementation of §6 visibility inheritance rules per RLS assertions
 * 
 * Hierarchy: Organization (required) → Location → Machine → Issue
 */

export interface VisibilityChain {
  organization: { is_public: boolean; public_issue_default: string };
  location?: { is_public: boolean | null } | undefined;
  machine?: { is_public: boolean | null } | undefined;
  issue?: { is_public: boolean | null } | undefined;
}

/**
 * Calculate effective visibility per §6 RLS assertions
 * 
 * Algorithm:
 * 1. If org private ⇒ private
 * 2. Walk Location → Machine → Issue: first explicit FALSE ⇒ private; first explicit TRUE remembered
 * 3. If no explicit FALSE and at least one TRUE ⇒ public
 * 4. If no explicit TRUE/FALSE ⇒ use public_issue_default (org must be public)
 */
export function calculateEffectiveVisibility(chain: VisibilityChain): boolean {
  // 1. If organization is private, everything is private
  if (!chain.organization.is_public) {
    return false;
  }

  // 2. Walk the chain looking for explicit values
  const explicitValues: boolean[] = [];
  
  // Collect explicit (non-null) values from the chain
  if (chain.location?.is_public !== null && chain.location?.is_public !== undefined) {
    explicitValues.push(chain.location.is_public);
  }
  if (chain.machine?.is_public !== null && chain.machine?.is_public !== undefined) {
    explicitValues.push(chain.machine.is_public);
  }
  if (chain.issue?.is_public !== null && chain.issue?.is_public !== undefined) {
    explicitValues.push(chain.issue.is_public);
  }

  // If any explicit FALSE found, result is private
  if (explicitValues.includes(false)) {
    return false;
  }

  // If any explicit TRUE found (and no FALSE), result is public
  if (explicitValues.includes(true)) {
    return true;
  }

  // No explicit values found - use organization's default for issues
  return chain.organization.public_issue_default === 'public';
}

/**
 * Calculate effective visibility for a machine (stops at machine level)
 */
export function calculateEffectiveMachineVisibility(
  organization: { is_public: boolean },
  location: { is_public: boolean | null } | null,
  machine: { is_public: boolean | null }
): boolean {
  // If organization is private, machine is private
  if (!organization.is_public) {
    return false;
  }

  // Check explicit machine value first
  if (machine.is_public !== null) {
    return machine.is_public;
  }

  // Check explicit location value
  if (location?.is_public !== null && location?.is_public !== undefined) {
    return location.is_public;
  }

  // No explicit values - inherit organization public status
  return organization.is_public;
}

/**
 * Calculate effective visibility for a location
 */
export function calculateEffectiveLocationVisibility(
  organization: { is_public: boolean },
  location: { is_public: boolean | null }
): boolean {
  // If organization is private, location is private
  if (!organization.is_public) {
    return false;
  }

  // Check explicit location value
  if (location.is_public !== null) {
    return location.is_public;
  }

  // No explicit value - inherit organization public status
  return organization.is_public;
}

/**
 * Determine if an entity should be visible to anonymous users
 * Per §7: Guests see only public data
 */
export function isVisibleToAnonymous(effectivelyPublic: boolean): boolean {
  return effectivelyPublic;
}

/**
 * Determine if an entity should be visible to authenticated non-members
 * Per §7: Non-members see only public data
 */
export function isVisibleToNonMember(effectivelyPublic: boolean): boolean {
  return effectivelyPublic;
}

/**
 * Helper to build visibility chain from database results
 * Handles cases where parent entities might be missing
 */
export function buildVisibilityChain(
  organization: { is_public: boolean; public_issue_default: string },
  location?: { is_public: boolean | null } | null,
  machine?: { is_public: boolean | null } | null,
  issue?: { is_public: boolean | null } | null
): VisibilityChain {
  return {
    organization,
    location: location ?? undefined,
    machine: machine ?? undefined,
    issue: issue ?? undefined,
  };
}