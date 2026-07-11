// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Connection settings — the operator's per-flow switchboard (milestone
 * eco-connection-settings; Control Center ratification 2026-07-11,
 * decision 3: hybrid pair→flow toggles with three states).
 *
 * Semantics (enforced in every spoke's outbox/inbox workers):
 *  - 'on'    → enqueue AND transmit normally
 *  - 'pause' → keep ENQUEUEING locally (nothing is ever lost) but do not
 *              push/pull until flipped back
 *  - 'off'   → do not even enqueue (and do not pull)
 *
 * Defaults are OPEN ('on'): settings only ever REDUCE traffic, so the
 * standalone guarantee and rule 1 are untouched. Missing file/keys = 'on'.
 *
 * Storage is app-local (localStorage for browser apps, a JSON file next to
 * the server DB for local-API apps); each app mirrors its settings to the
 * hub (PUT /api/ecosystem/connections) so the Control Center can render
 * everyone's switchboard from one place.
 */
import type { Rfc3339Timestamp } from './common';
import { SyncPayloadType } from './enums';

export type ConnectionState = 'on' | 'pause' | 'off';

export interface ConnectionSettings {
  version: 1;
  /** Per outbound payload type this app produces; missing key = 'on'. */
  outbound: Partial<Record<SyncPayloadType, ConnectionState>>;
  /** Per inbound payload type this app consumes; missing key = 'on'. */
  inbound: Partial<Record<SyncPayloadType, ConnectionState>>;
  updatedAt: Rfc3339Timestamp;
}

export const DEFAULT_CONNECTION_SETTINGS: ConnectionSettings = {
  version: 1,
  outbound: {},
  inbound: {},
  updatedAt: '1970-01-01T00:00:00.000Z',
};

const VALID_STATES: readonly ConnectionState[] = ['on', 'pause', 'off'];

function normalizeState(value: unknown): ConnectionState {
  return VALID_STATES.includes(value as ConnectionState) ? (value as ConnectionState) : 'on';
}

/** Effective outbound state for a payload type (default-open). */
export function outboundState(
  settings: ConnectionSettings | undefined,
  payloadType: SyncPayloadType
): ConnectionState {
  return normalizeState(settings?.outbound?.[payloadType]);
}

/** Effective inbound state for a payload type (default-open). */
export function inboundState(
  settings: ConnectionSettings | undefined,
  payloadType: SyncPayloadType
): ConnectionState {
  return normalizeState(settings?.inbound?.[payloadType]);
}

/** 'pause' still queues; only 'off' stops local accumulation. */
export function shouldEnqueue(state: ConnectionState): boolean {
  return state !== 'off';
}

/** Only 'on' moves data over the wire (push or pull). */
export function shouldTransmit(state: ConnectionState): boolean {
  return state === 'on';
}

/**
 * Parses persisted JSON defensively: malformed input degrades to
 * default-open rather than throwing inside a sync worker.
 */
export function parseConnectionSettings(raw: unknown): ConnectionSettings {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return DEFAULT_CONNECTION_SETTINGS;
    }
  }
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CONNECTION_SETTINGS;
  const candidate = raw as Partial<ConnectionSettings>;

  const normalizeMap = (
    map: unknown
  ): Partial<Record<SyncPayloadType, ConnectionState>> => {
    if (typeof map !== 'object' || map === null) return {};
    const out: Partial<Record<SyncPayloadType, ConnectionState>> = {};
    for (const [key, value] of Object.entries(map)) {
      if ((Object.values(SyncPayloadType) as string[]).includes(key)) {
        out[key as SyncPayloadType] = normalizeState(value);
      }
    }
    return out;
  };

  return {
    version: 1,
    outbound: normalizeMap(candidate.outbound),
    inbound: normalizeMap(candidate.inbound),
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : DEFAULT_CONNECTION_SETTINGS.updatedAt,
  };
}
