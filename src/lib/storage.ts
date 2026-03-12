import { logError } from "./errorLog";
import type { LocalState } from "./types";
import { invoke, isWails } from "./wailsapi";

const STORAGE_KEY = "multi-database-browsing.state";

const defaultState: LocalState = {
  profiles: [],
  secrets: {}
};

export async function loadState(): Promise<LocalState> {
  try {
    let raw: string | null = null;

    // Try to load from Wails backend first
    if (isWails()) {
      try {
        raw = await invoke<string>("load_state");
      } catch (error) {
        logError(error, {
          source: "storage.loadState",
          message: "Failed to load state from backend, falling back to localStorage"
        });
        // Fall back to localStorage
        raw = localStorage.getItem(STORAGE_KEY);
      }
    } else {
      // Web environment - use localStorage only
      raw = localStorage.getItem(STORAGE_KEY);
    }

    if (!raw) {
      return { ...defaultState };
    }

    const data = JSON.parse(raw) as LocalState & { cachedIndicesByConnection?: unknown; history?: unknown };
    const { cachedIndicesByConnection: _legacyCache, history: _legacyHistory, ...rest } = data;
    return { ...defaultState, ...rest };
  } catch (error) {
    logError(error, {
      source: "storage.loadState",
      message: "Failed to load persisted application state"
    });
    return { ...defaultState };
  }
}

export async function saveState(state: LocalState) {
  try {
    const payload = JSON.stringify(state, null, 2);

    // Try to save via Wails backend first
    if (isWails()) {
      try {
        await invoke("save_state", { data: payload });
        return;
      } catch (error) {
        logError(error, {
          source: "storage.saveState",
          message: "Failed to save state to backend, falling back to localStorage"
        });
        // Fall back to localStorage
      }
    }

    // Web environment or backend failed - use localStorage
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    logError(error, {
      source: "storage.saveState",
      message: "Failed to persist application state"
    });
    throw error;
  }
}
