/**
 * Durable persistence via the local API (osp-exportable-persistence).
 * Opt-in: set VITE_OLYSTATE_API_URL (e.g. http://localhost:8788) and run
 * `npm run server:dev`. localStorage stays the always-on fallback so the app
 * remains fully standalone (ecosystem rule 1). All API calls are fail-silent.
 *
 * Lives outside src/domain/ because the domain tree is compiled to CommonJS
 * for the node:test harness, where `import.meta` is not allowed.
 */
import type { OlyStateDataSet } from "./domain/types";
import type {
  ConnectionChange,
  EcosystemStatus,
} from "./ecosystem-control-center";

const importMetaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
const API_URL = importMetaEnv?.VITE_OLYSTATE_API_URL?.replace(/\/$/, "");

export function isApiPersistenceConfigured(): boolean {
  return Boolean(API_URL);
}

export async function fetchEcosystemStatus(): Promise<EcosystemStatus> {
  if (!API_URL) throw new Error("The OlyState local API is not configured.");
  const response = await fetch(`${API_URL}/ecosystem/status`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Status request failed (${response.status}).`
    );
  }
  return body as EcosystemStatus;
}

export async function updateEcosystemConnection(
  status: EcosystemStatus,
  change: ConnectionChange
): Promise<Record<string, unknown>> {
  if (!API_URL) throw new Error("The OlyState local API is not configured.");
  const current =
    status.connections.find((report) => report.app === "olyStatePro")?.settings ?? {
      version: 1,
      outbound: {},
      inbound: {},
      updatedAt: "1970-01-01T00:00:00.000Z",
    };
  const direction =
    typeof current[change.direction] === "object" && current[change.direction] !== null
      ? (current[change.direction] as Record<string, unknown>)
      : {};
  const response = await fetch(`${API_URL}/ecosystem/connections`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...current,
      [change.direction]: {
        ...direction,
        [change.payloadType]: change.state,
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Settings update failed (${response.status}).`
    );
  }
  return body as Record<string, unknown>;
}

export async function loadDataSetFromApi(): Promise<OlyStateDataSet | undefined> {
  if (!API_URL) return undefined;
  try {
    const response = await fetch(`${API_URL}/dataset`);
    if (!response.ok) return undefined;
    const parsed = (await response.json()) as OlyStateDataSet;
    if (!Array.isArray(parsed.athletes) || !Array.isArray(parsed.sessions)) return undefined;
    return {
      athletes: parsed.athletes,
      sessions: parsed.sessions,
      plannedSessions: parsed.plannedSessions ?? [],
      observations: parsed.observations ?? []
    };
  } catch {
    return undefined;
  }
}

export function persistDataSetToApi(dataSet: OlyStateDataSet): void {
  if (!API_URL) return;
  void fetch(`${API_URL}/dataset`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dataSet)
  }).catch(() => undefined);
}
