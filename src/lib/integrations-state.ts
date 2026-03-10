import { supabase } from "@/integrations/supabase/client";

const DB_SETTINGS_KEY = "integrations_enabled";
const LOCAL_CACHE_KEY = "somhonesto_integrations_cache";

export type IntegrationId = "elevenlabs" | "mubert" | "musicgen" | "acestep" | "local" | "openai" | "gemini" | "lovable" | "revelator" | "fuga" | "distrokid";

/** In-memory cache updated from DB. Falls back to localStorage cache for offline/startup. */
let memoryCache: Record<string, boolean> | null = null;
let fetchPromise: Promise<Record<string, boolean>> | null = null;

function getLocalCache(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalCache(state: Record<string, boolean>) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/** Fetch state from database (cached in memory after first call) */
export async function fetchIntegrationsState(): Promise<Record<string, boolean>> {
  if (memoryCache) return memoryCache;

  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", DB_SETTINGS_KEY)
          .maybeSingle();

        if (error) throw error;
        const state = (data?.value as Record<string, boolean>) || {};
        memoryCache = state;
        setLocalCache(state);
        return state;
      } catch {
        // Fallback to local cache
        const cached = getLocalCache();
        memoryCache = cached;
        return cached;
      } finally {
        fetchPromise = null;
      }
    })();
  }

  return fetchPromise;
}

/** Synchronous check — uses memory/local cache. Call fetchIntegrationsState() first when possible. */
export function isIntegrationEnabled(id: IntegrationId): boolean {
  const state = memoryCache ?? getLocalCache();
  return state[id] !== false;
}

/** Update integration toggle — writes to DB (source of truth), updates caches */
export async function setIntegrationEnabled(id: IntegrationId, enabled: boolean) {
  // Optimistic update
  const current = memoryCache ?? getLocalCache();
  const updated = { ...current, [id]: enabled };
  memoryCache = updated;
  setLocalCache(updated);

  // Persist to database
  try {
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", DB_SETTINGS_KEY)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("site_settings")
        .update({ value: updated as any, updated_at: new Date().toISOString() })
        .eq("key", DB_SETTINGS_KEY);
    } else {
      await supabase
        .from("site_settings")
        .insert({ key: DB_SETTINGS_KEY, value: updated as any });
    }
  } catch {
    // DB write failed — local cache is still updated for this session
  }
}

/** Invalidate in-memory cache (e.g. after navigation or refetch) */
export function invalidateIntegrationsCache() {
  memoryCache = null;
}
