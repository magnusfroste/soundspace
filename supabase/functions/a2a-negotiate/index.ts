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

// ── Resolve active generation provider from site_settings ──────────────
async function getActiveProvider(supabaseUrl: string): Promise<"acestep" | "elevenlabs"> {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Check module:sound-agent settings for generationProvider
    const { data: agentSettings } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "module:sound-agent")
      .maybeSingle();

    if (agentSettings?.value) {
      const val = agentSettings.value as Record<string, unknown>;
      const provider = val.generationProvider as string | undefined;
      if (provider === "elevenlabs") return "elevenlabs";
      if (provider === "acestep") return "acestep";
    }

    // Check integrations_enabled to see what's active
    const { data: intSettings } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "integrations_enabled")
      .maybeSingle();

    if (intSettings?.value) {
      const state = intSettings.value as Record<string, boolean>;
      if (state.acestep !== false) return "acestep";
      if (state.elevenlabs !== false) return "elevenlabs";
    }

    return "acestep"; // default
  } catch {
    return "acestep";
  }
}

// ── Generate via AceStep ───────────────────────────────────────────────
async function generateViaAceStep(
  supabaseUrl: string,
  prompt: string,
  duration: number
): Promise<{ audioBytes: Uint8Array; qualityScore: number; metadata: Record<string, unknown> } | { error: string; status: number }> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const acestepProxy = `${supabaseUrl}/functions/v1/acestep-proxy`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${anonKey}`,
  };

  // Submit generation task
  const releaseRes = await fetch(acestepProxy, {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: "/release_task",
      method: "POST",
      body: {
        task_type: "text2music",
        caption: prompt,
        lyrics: "[Instrumental]",
        audio_duration: Math.min(Math.max(duration, 30), 180),
        bpm: 100,
        keyscale: "C major",
        timesignature: "4/4",
        batch_size: 1,
        inference_steps: 100,
        thinking: true,
      },
    }),
  });

  if (!releaseRes.ok) {
    const err = await releaseRes.text();
    return { error: `AceStep submission failed: ${err}`, status: 502 };
  }

  const releaseData = await releaseRes.json();
  const unwrapped = (releaseData && typeof releaseData === "object" && "code" in releaseData && "data" in releaseData) ? releaseData.data : releaseData;
  const taskId = unwrapped?.task_id || unwrapped?.taskId || unwrapped?.id;
  if (!taskId) return { error: `No task_id from AceStep: ${JSON.stringify(releaseData).slice(0, 200)}`, status: 502 };

  // Poll for results (up to 6 minutes)
  let resultData: any = null;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(acestepProxy, {
      method: "POST",
      headers,
      body: JSON.stringify({ endpoint: "/query_result", method: "POST", body: { task_id_list: [taskId] } }),
    });
    if (!pollRes.ok) continue;
    let pollData = await pollRes.json();
    if (pollData && typeof pollData === "object" && "code" in pollData && "data" in pollData) pollData = pollData.data;
    const tasks = Array.isArray(pollData) ? pollData : pollData?.data || [pollData];
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    if (!task) continue;
    if (task.status === 1) {
      resultData = typeof task.result === "string" ? JSON.parse(task.result) : task.result;
      break;
    }
    if (task.status === 2) return { error: "AceStep generation failed", status: 502 };
  }

  if (!resultData) return { error: "AceStep generation timed out", status: 504 };

  // Pick best variation
  const resultItems = Array.isArray(resultData) ? resultData : [resultData];
  resultItems.sort((a: any, b: any) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
  const best = resultItems[0];
  const audioPath = best?.url || best?.file;
  if (!audioPath) return { error: "No audio path in AceStep result", status: 502 };

  // Download audio
  const audioRes = await fetch(acestepProxy, {
    method: "POST",
    headers,
    body: JSON.stringify({ endpoint: audioPath, method: "GET" }),
  });
  if (!audioRes.ok) return { error: `Failed to download AceStep audio (${audioRes.status})`, status: 502 };

  const audioBlob = await audioRes.arrayBuffer();
  if (audioBlob.byteLength < 1000) return { error: `Audio too small (${audioBlob.byteLength} bytes)`, status: 502 };

  return {
    audioBytes: new Uint8Array(audioBlob),
    qualityScore: best.quality_score ?? 0,
    metadata: {
      bpm: best.bpm ?? 100,
      key_scale: best.keyscale ?? "C major",
      time_signature: best.timesignature ?? "4/4",
    },
  };
}

// ── Generate via ElevenLabs ────────────────────────────────────────────
async function generateViaElevenLabs(
  supabaseUrl: string,
  prompt: string,
  duration: number
): Promise<{ audioBytes: Uint8Array; qualityScore: number; metadata: Record<string, unknown> } | { error: string; status: number }> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const genResponse = await fetch(`${supabaseUrl}/functions/v1/generate-music`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ prompt, duration }),
  });

  if (!genResponse.ok) {
    const errText = await genResponse.text();
    return { error: `ElevenLabs generation failed: ${genResponse.status}`, status: 502 };
  }

  const genData = await genResponse.json();
  const audioBase64 = genData.audio as string;
  if (!audioBase64) return { error: "No audio from ElevenLabs", status: 502 };

  const binaryStr = atob(audioBase64);
  const audioBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    audioBytes[i] = binaryStr.charCodeAt(i);
  }

  return {
    audioBytes,
    qualityScore: 80,
    metadata: {
      genre: (genData.compositionPlan as any)?.genre || null,
      title: (genData.compositionPlan as any)?.title || null,
      lyrics: genData.lyrics || null,
    },
  };
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

  // Resolve active provider
  const provider = await getActiveProvider(supabaseUrl);
  console.log(`[a2a] Task: generate_track — provider: ${provider}, prompt: "${enrichedPrompt.slice(0, 80)}...", duration: ${duration || 180}s`);

  // Generate via active provider
  const genResult = provider === "acestep"
    ? await generateViaAceStep(supabaseUrl, enrichedPrompt, duration || 60)
    : await generateViaElevenLabs(supabaseUrl, enrichedPrompt, duration || 180);

  if ("error" in genResult) {
    console.error(`[a2a] ${provider} failed:`, genResult.error);
    return new Response(
      JSON.stringify({ status: "error", error: genResult.error }),
      { status: genResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Upload to storage
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ext = provider === "acestep" ? "wav" : "mp3";
  const contentType = provider === "acestep" ? "audio/wav" : "audio/mpeg";
  const fileName = `a2a/a2a-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("songs")
    .upload(fileName, genResult.audioBytes, { contentType, upsert: false });

  if (uploadError) {
    console.error("[a2a] Storage upload failed:", uploadError.message);
    return new Response(
      JSON.stringify({ status: "error", error: "Failed to store audio: " + uploadError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: publicUrl } = sb.storage.from("songs").getPublicUrl(fileName);

  const result = {
    status: "completed",
    result: {
      audio_url: publicUrl.publicUrl,
      title: (genResult.metadata.title as string) || prompt.slice(0, 60),
      genre: (genResult.metadata.genre as string) || null,
      duration: duration || (provider === "acestep" ? 60 : 180),
      quality_score: genResult.qualityScore,
      provider,
      storage_path: fileName,
      ...genResult.metadata,
    },
  };

  console.log(`[a2a] Task completed — provider: ${provider}, audio: ${publicUrl.publicUrl}`);

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
