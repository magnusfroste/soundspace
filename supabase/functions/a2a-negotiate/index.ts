import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ── In-memory rate limiter (30 req/min per IP) ─────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Auth: validate Bearer token against site_settings ──────────────────
async function validateToken(
  authHeader: string | null,
  supabaseUrl: string
): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (!token) return false;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", "module:api_tokens")
    .maybeSingle();

  if (!data?.value) return false;

  const settings = data.value as Record<string, unknown>;
  const storedKey = settings.a2a_api_key as string | undefined;

  if (!storedKey) return false;
  return token === storedKey;
}

// ── Skill registry ─────────────────────────────────────────────────────
const SKILLS: Record<string, { name: string; description: string }> = {
  generate_track: {
    name: "Generate Track",
    description: "Generate custom AI music tracks",
  },
};

// ── GET handler: return agent card (public discovery) ──────────────────
async function handleGet(supabaseUrl: string): Promise<Response> {
  // Redirect to agent-card function for canonical card
  const res = await fetch(`${supabaseUrl}/functions/v1/agent-card`);
  const card = await res.json();
  return new Response(JSON.stringify(card, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── POST handler: dispatch by message type ─────────────────────────────
async function handlePost(
  req: Request,
  supabaseUrl: string
): Promise<Response> {
  // Auth check for POST
  const isValid = await validateToken(
    req.headers.get("Authorization"),
    supabaseUrl
  );
  if (!isValid) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        hint: "Provide a valid Bearer token (stored in site_settings module:api_tokens → a2a_api_key)",
      }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const type = body.type as string;

  switch (type) {
    case "ping":
      return handlePing();
    case "query":
      return handleQuery(body);
    case "task":
      return await handleTask(body, supabaseUrl);
    default:
      return new Response(
        JSON.stringify({
          error: `Unknown message type: "${type}"`,
          accepted: ["ping", "query", "task"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}

// ── ping ────────────────────────────────────────────────────────────────
function handlePing(): Response {
  return new Response(
    JSON.stringify({ type: "pong", agent: "SoundSpace", timestamp: new Date().toISOString() }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── query ───────────────────────────────────────────────────────────────
function handleQuery(body: Record<string, unknown>): Response {
  const skillId = body.skill_id as string | undefined;

  if (skillId) {
    const skill = SKILLS[skillId];
    if (skill) {
      return new Response(
        JSON.stringify({ type: "query_result", skill_id: skillId, available: true, ...skill }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ type: "query_result", skill_id: skillId, available: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // List all skills
  return new Response(
    JSON.stringify({ type: "query_result", skills: Object.entries(SKILLS).map(([id, s]) => ({ id, ...s })) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── task: generate_track ────────────────────────────────────────────────
async function handleTask(
  body: Record<string, unknown>,
  supabaseUrl: string
): Promise<Response> {
  const skillId = body.skill_id as string;

  if (skillId !== "generate_track") {
    return new Response(
      JSON.stringify({
        status: "error",
        error: `Unknown skill: "${skillId}"`,
        available_skills: Object.keys(SKILLS),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const input = (body.input || {}) as Record<string, unknown>;
  const prompt = input.prompt as string;
  const duration = input.duration as number | undefined;
  const context = input.context as Record<string, unknown> | undefined;

  if (!prompt) {
    return new Response(
      JSON.stringify({ status: "error", error: "input.prompt is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build enriched prompt with context
  let enrichedPrompt = prompt;
  if (context) {
    const parts: string[] = [];
    if (context.venue) parts.push(`Venue: ${context.venue}`);
    if (context.time_of_day) parts.push(`Time of day: ${context.time_of_day}`);
    if (context.energy) parts.push(`Energy level: ${context.energy}`);
    if (parts.length) {
      enrichedPrompt = `${prompt}\n\nContext: ${parts.join(", ")}`;
    }
  }

  console.log(`[a2a] Task: generate_track — prompt: "${enrichedPrompt.slice(0, 80)}...", duration: ${duration || 180}s`);

  // Call existing generate-music edge function
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const genResponse = await fetch(`${supabaseUrl}/functions/v1/generate-music`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      prompt: enrichedPrompt,
      duration: duration || 180,
    }),
  });

  if (!genResponse.ok) {
    const errText = await genResponse.text();
    console.error(`[a2a] generate-music failed: ${genResponse.status}`, errText);
    return new Response(
      JSON.stringify({ status: "error", error: `Music generation failed: ${genResponse.status}`, detail: errText }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const genData = await genResponse.json();
  const audioBase64 = genData.audio as string;
  const lyrics = genData.lyrics as string | null;
  const compositionPlan = genData.compositionPlan as Record<string, unknown> | null;

  if (!audioBase64) {
    return new Response(
      JSON.stringify({ status: "error", error: "No audio returned from generation" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Decode base64 to bytes
  const binaryStr = atob(audioBase64);
  const audioBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    audioBytes[i] = binaryStr.charCodeAt(i);
  }

  // Upload to storage bucket "songs"
  const sb = createClient(supabaseUrl, serviceKey);
  const fileName = `a2a/a2a-${crypto.randomUUID()}.mp3`;

  const { error: uploadError } = await sb.storage
    .from("songs")
    .upload(fileName, audioBytes, {
      contentType: "audio/mpeg",
      upsert: false,
    });

  if (uploadError) {
    console.error("[a2a] Storage upload failed:", uploadError.message);
    return new Response(
      JSON.stringify({ status: "error", error: "Failed to store audio: " + uploadError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: publicUrl } = sb.storage.from("songs").getPublicUrl(fileName);

  // Extract genre from composition plan if available
  let genre: string | null = null;
  let title: string | null = null;
  if (compositionPlan) {
    genre = (compositionPlan.genre as string) || null;
    title = (compositionPlan.title as string) || null;
  }

  const result = {
    status: "completed",
    result: {
      audio_url: publicUrl.publicUrl,
      title: title || prompt.slice(0, 60),
      genre: genre || null,
      duration: duration || 180,
      lyrics: lyrics || null,
      storage_path: fileName,
    },
  };

  console.log(`[a2a] Task completed — audio: ${publicUrl.publicUrl}`);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Request logging ─────────────────────────────────────────────────────
async function logRequest(
  supabaseUrl: string,
  type: string,
  skillId: string | null,
  ip: string,
  status: string,
  error?: string,
  resultSummary?: Record<string, unknown>
) {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    await sb.from("a2a_request_logs").insert({
      type,
      skill_id: skillId,
      ip_address: ip,
      status,
      error: error || null,
      result_summary: resultSummary || {},
    });
  } catch (e) {
    console.error("[a2a] Failed to log request:", e);
  }
}

// ── Main handler ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!checkRateLimit(clientIp)) {
    await logRequest(supabaseUrl, "rate_limited", null, clientIp, "rejected", "Rate limit exceeded");
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded (30 req/min)" }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }

  if (req.method === "GET") {
    await logRequest(supabaseUrl, "discovery", null, clientIp, "completed");
    return handleGet(supabaseUrl);
  }

  if (req.method === "POST") {
    const response = await handlePost(req, supabaseUrl);
    // Log POST requests with parsed info
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      const type = body.type || "task";
      const status = response.status >= 400 ? "error" : "completed";
      await logRequest(supabaseUrl, type, body.skill_id || body.result?.title || null, clientIp, status, body.error, body.result ? { title: body.result.title, genre: body.result.genre } : undefined);
    } catch { /* ignore logging failures */ }
    return response;
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
