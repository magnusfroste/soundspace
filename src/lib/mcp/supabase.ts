import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function requiredEnv(name: string): string {
  const value = runtimeEnv(name)?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// Service-role client: the MCP endpoint is protected by our own bearer token
// (site_settings.mcp_api_token), validated per request in requireAuth.
export function supabaseAdmin() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Validates the caller's bearer token against the configured MCP API token.
export async function requireAuth(ctx: ToolContext): Promise<void> {
  const token = ctx.getToken();
  if (!token) throw new Error("Missing bearer token");
  const { data, error } = await supabaseAdmin()
    .from("site_settings")
    .select("value")
    .eq("key", "mcp_api_token")
    .maybeSingle();
  if (error) throw new Error("Auth lookup failed: " + error.message);
  const configured = typeof data?.value === "string" ? data.value : data?.value?.token;
  if (!configured || configured !== token) throw new Error("Invalid MCP API token");
}
