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

// ── Consume SSE stream from Sound Agent and extract results ────────────
async function consumeAgentStream(
  response: Response
): Promise<{ content: string; audioUrls: string[]; error?: string }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let content = "";
  let audioUrls: string[] = [];
  let currentEvent: string | null = null;

  const extractAudioUrls = (payload: any): string[] => {
    const direct =
      payload?.audio_urls ??
      payload?.audioUrls ??
      payload?.result?.audio_urls ??
      payload?.result?.audioUrls;

    if (Array.isArray(direct)) return direct.filter((u) => typeof u === "string");

    const single =
      payload?.audio_url ??
      payload?.audioUrl ??
      payload?.result?.audio_url ??
      payload?.result?.audioUrl;

    if (typeof single === "string") return [single];
    return [];
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nlIdx: number;
    while ((nlIdx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);

      if (line.startsWith("event:")) {
        currentEvent = line.slice("event:".length).trim() || null;
        continue;
      }

      if (!line.startsWith("data:")) continue;

      const jsonStr = line.slice("data:".length).trim();
      if (!jsonStr || jsonStr === "[DONE]") {
        currentEvent = null;
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // partial JSON; keep buffering
        continue;
      }

      const eventType = (typeof parsed?.type === "string" ? parsed.type : currentEvent) || "";

      if ((eventType === "token" || eventType === "message") && typeof parsed?.content === "string") {
        content += parsed.content;
      }

      if (eventType === "done") {
        const urls = extractAudioUrls(parsed);
        if (urls.length) audioUrls = urls;
      }

      if (eventType === "error") {
        return {
          content: "",
          audioUrls: [],
          error: parsed?.error || parsed?.message || "Agent error",
        };
      }

      // Reset after consuming a data line (SSE event applies to the subsequent data payload)
      currentEvent = null;
    }
  }

  return { content, audioUrls };
}

// ── task: generate_track — delegates to Sound Agent ─────────────────────
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

  // Build the agent message — instruct it to generate, save, and return
  const agentMessage = `Generate a track and save it to the library. Here are the details:

Prompt: ${enrichedPrompt}
Duration: ${duration || 60} seconds

Important: Generate the track, save it to the library, and report the audio URL and metadata. Do not ask for confirmation — just execute.`;

  console.log(`[a2a] Delegating to Sound Agent — prompt: "${enrichedPrompt.slice(0, 80)}..."`);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

  // Create a unique conversation ID to prevent cached responses
  const sb = createClient(supabaseUrl, serviceKey);
  const conversationId = crypto.randomUUID();

  // Call Sound Agent edge function (streaming SSE)
  const agentResponse = await fetch(`${supabaseUrl}/functions/v1/sound-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId, // Force new conversation to prevent caching
      messages: [{ role: "user", content: agentMessage }],
      settings: {}, // Agent reads its own settings from site_settings
    }),
  });

  if (!agentResponse.ok || !agentResponse.body) {
    const errText = await agentResponse.text();
    console.error(`[a2a] Sound Agent failed: ${agentResponse.status}`, errText.slice(0, 300));
    return new Response(
      JSON.stringify({ status: "error", error: `Sound Agent failed: ${agentResponse.status}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Consume the agent's SSE stream
  const agentResult = await consumeAgentStream(agentResponse);

  if (agentResult.error) {
    console.error(`[a2a] Agent error: ${agentResult.error}`);
    return new Response(
      JSON.stringify({ status: "error", error: agentResult.error }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!agentResult.audioUrls.length) {
    console.warn("[a2a] Agent completed but no audio URLs returned");
    return new Response(
      JSON.stringify({
        status: "completed",
        result: {
          message: agentResult.content.slice(0, 500),
          audio_url: null,
          note: "Agent completed but no audio was generated. Check agent logs.",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = {
    status: "completed",
    result: {
      audio_url: agentResult.audioUrls[0],
      audio_urls: agentResult.audioUrls,
      title: prompt.slice(0, 60),
      duration: duration || 60,
      agent_response: agentResult.content.slice(0, 1000),
    },
  };

  console.log(`[a2a] Task completed via Sound Agent — ${agentResult.audioUrls.length} audio(s)`);

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
