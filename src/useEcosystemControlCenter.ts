import { useCallback, useEffect, useState } from "react";
import {
  fetchEcosystemStatus,
  isApiPersistenceConfigured,
  updateEcosystemConnection,
} from "./apiStorage";
import type {
  ConnectionChange,
  EcosystemStatus,
} from "./ecosystem-control-center";

export function useEcosystemControlCenter() {
  const enabled = isApiPersistenceConfigured();
  const [status, setStatus] = useState<EcosystemStatus | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setError("Configure VITE_OLYSTATE_API_URL and run the local API to view live ecosystem status.");
      return;
    }
    setLoading(true);
    try {
      setStatus(await fetchEcosystemStatus());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Live ecosystem status is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const setConnection = useCallback(
    async (change: ConnectionChange) => {
      if (!status) return;
      const settings = await updateEcosystemConnection(status, change);
      setStatus((current) =>
        current
          ? {
              ...current,
              connections: [
                ...current.connections.filter((report) => report.app !== "olyStatePro"),
                {
                  app: "olyStatePro",
                  settings,
                  reportedAt:
                    typeof settings.updatedAt === "string"
                      ? settings.updatedAt
                      : new Date().toISOString(),
                },
              ],
            }
          : current
      );
    },
    [status]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { enabled, status, loading, error, refresh, setConnection };
}
