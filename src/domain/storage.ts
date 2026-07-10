import { initialDataSet } from "./sampleData";
import type { OlyStateDataSet } from "./types";

const STORAGE_KEY = "olystate-pro:data:v1";

export function loadDataSet(): OlyStateDataSet {
  if (typeof localStorage === "undefined") {
    return initialDataSet;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return initialDataSet;
  }

  try {
    const parsed = JSON.parse(raw) as OlyStateDataSet;
    if (!Array.isArray(parsed.athletes) || !Array.isArray(parsed.sessions)) {
      return initialDataSet;
    }
    return {
      athletes: parsed.athletes,
      sessions: parsed.sessions,
      plannedSessions: parsed.plannedSessions ?? [],
      observations: parsed.observations ?? []
    };
  } catch {
    return initialDataSet;
  }
}

export function saveDataSet(dataSet: OlyStateDataSet): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataSet));
}

export function resetDataSet(): OlyStateDataSet {
  localStorage.removeItem(STORAGE_KEY);
  return initialDataSet;
}

export function exportDataSet(dataSet: OlyStateDataSet): void {
  const blob = new Blob([JSON.stringify(dataSet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `olystate-pro-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
