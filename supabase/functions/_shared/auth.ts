import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const authCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type AuthResult =
  | { ok: true; userId: string | null; internal: boolean }
  | { ok: false; response: Response };

function deny(status: number, error: string): AuthResult {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...authCorsHeaders, "Content-Type": "application/json" },
    }),
  };
}

/**
 * Authorize a request.
 * - Service-role bearer token => trusted internal caller.
 * - x-cron-secret header matching internal_secrets.cron_secret => trusted scheduled job (if allowCron).
 * - Otherwise requires a signed-in user; with admin=true the user must have the admin role.
 */
export async function authorize(
  req: Request,
  opts: { admin?: boolean; allowCron?: boolean } = {},
): Promise<AuthResult> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

  if (token && token === serviceKey) return { ok: true, userId: null, internal: true };

  const sb = createClient(url, serviceKey);

  if (opts.allowCron) {
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret) {
      const { data } = await sb.from("internal_secrets").select("value").eq("key", "cron_secret").maybeSingle();
      if (data?.value && data.value === cronSecret) return { ok: true, userId: null, internal: true };
      return deny(401, "Unauthorized");
    }
  }

  if (!token) return deny(401, "Unauthorized");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return deny(401, "Unauthorized");

  if (opts.admin) {
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return deny(403, "Admin access required");
  }
  return { ok: true, userId: user.id, internal: false };
}

/** Allow only public http(s) URLs (blocks private/loopback/link-local hosts). */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return false;
  }
  if (h.includes(":")) {
    if (h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:")) return false;
  }
  return true;
}

/** Fetch with a byte cap; throws if the body exceeds maxBytes. */
export async function fetchLimited(url: string, maxBytes: number, init?: RequestInit): Promise<{ res: Response; bytes: Uint8Array }> {
  const res = await fetch(url, { ...init, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) throw new Error("Redirects are not allowed");
  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > maxBytes) throw new Error("File too large");
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel(); throw new Error("File too large"); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  return { res, bytes };
}
