import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "somhonesto_integrations_enabled";
const DB_SETTINGS_KEY = "integrations_enabled";

export type IntegrationId = "elevenlabs" | "mubert" | "musicgen" | "acestep" | "local" | "openai" | "gemini" | "lovable" | "revelator" | "fuga" | "distrokid";

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
  // Sync to database so edge functions can read integration status
  syncToDatabase(state);
}

/** Persist the full integrations state to site_settings for server-side access */
async function syncToDatabase(state: Record<string, boolean>) {
  try {
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", DB_SETTINGS_KEY)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("site_settings")
        .update({ value: state as any, updated_at: new Date().toISOString() })
        .eq("key", DB_SETTINGS_KEY);
    } else {
      await supabase
        .from("site_settings")
        .insert({ key: DB_SETTINGS_KEY, value: state as any });
    }
  } catch {
    // Silent fail — localStorage is the primary source, DB is for edge functions
  }
}
