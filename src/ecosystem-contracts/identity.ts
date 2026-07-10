// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
import type { Rfc3339Timestamp, UUID } from './common';
import { SessionLinkType, SourceApp } from './enums';

/**
 * Canonical athlete identity (ratified INTEGRATION_PLAN.md Section 3.3).
 *
 * AthleteOS issues the canonical `sharedAthleteId` (UUID) and serves the link
 * registry. Every spoke app stores its own SharedAthleteLink rows mapping its
 * local athlete IDs to the canonical ID, and stamps every outbound envelope
 * payload with the canonical ID.
 */
export interface SharedAthleteLink {
  sharedAthleteId: UUID;
  sourceApp: SourceApp;
  sourceAthleteId: UUID;
  /** Stable non-UUID key (e.g. email hash) usable for first-time matching. */
  externalStableKey?: string;
  /** 0..1 confidence that this link maps the same human. 1 = explicit/manual. */
  matchConfidence: number;
  /** e.g. "manual", "email", "name+dob". */
  matchMethod: string;
  createdAt: Rfc3339Timestamp;
}

/**
 * Links a source-app session object (plan, response, or derived metrics) to a
 * shared session identity so consumers can correlate the same physical
 * session across apps. Matching is keyed by athlete + start time window.
 */
export interface SharedSessionLink {
  sharedAthleteId: UUID;
  sourceApp: SourceApp;
  sourceSessionId: UUID;
  sessionLinkType: SessionLinkType;
  sharedObjectId: UUID;
  linkedPlanId?: UUID;
  linkedResponseId?: UUID;
  revision: number;
  createdAt: Rfc3339Timestamp;
  updatedAt?: Rfc3339Timestamp;
}

/** Request body for POST /api/registry/athletes on the hub. */
export interface CanonicalAthleteCreateRequest {
  sourceApp: SourceApp;
  sourceAthleteId: UUID;
  externalStableKey?: string;
  displayName?: string;
}

/** Response from canonical athlete creation/lookup on the hub. */
export interface CanonicalAthleteRecord {
  sharedAthleteId: UUID;
  createdBy: SourceApp;
  createdAt: Rfc3339Timestamp;
  links: readonly SharedAthleteLink[];
}
