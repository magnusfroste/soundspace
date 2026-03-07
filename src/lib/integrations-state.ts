const STORAGE_KEY = "somhonesto_integrations_enabled";

export type IntegrationId = "elevenlabs" | "mubert" | "musicgen" | "acestep" | "local";

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isIntegrationEnabled(id: IntegrationId): boolean {
  const state = load();
  // Default to true (enabled) if not explicitly set
  return state[id] !== false;
}

export function setIntegrationEnabled(id: IntegrationId, enabled: boolean) {
  const state = load();
  state[id] = enabled;
  save(state);
}
