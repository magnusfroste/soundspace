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
async function validateToken(authHeader: string | null, supabaseUrl: string): Promise<boolean> {
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
    description: "Generate custom AI music tracks via SoundAgent",
  },
  upload_song: {
    name: "Upload Song",
    description: "Upload a finished song (audio URL + metadata) directly to the SoundSpace library",
  },
  list_playlists: {
    name: "List Playlists",
    description: "List all available playlists in SoundSpace",
  },
  add_to_playlist: {
    name: "Add to Playlist",
    description: "Add an existing song to a playlist by song ID and playlist ID",
  },
  list_songs: {
    name: "List Songs",
    description: "List songs in the library, optionally filtered by genre, mood, or artist",
  },
};

// ── GET handler: return agent card ─────────────────────────────────────
async function handleGet(supabaseUrl: string): Promise<Response> {
  const res = await fetch(`${supabaseUrl}/functions/v1/agent-card`);
  const card = await res.json();
  return new Response(JSON.stringify(card, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── POST handler: dispatch by message type ─────────────────────────────
async function handlePost(req: Request, supabaseUrl: string): Promise<Response> {
  const isValid = await validateToken(req.headers.get("Authorization"), supabaseUrl);
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", hint: "Provide a valid Bearer token" }),
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
        JSON.stringify({ error: `Unknown message type: "${type}"`, accepted: ["ping", "query", "task"] }),
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

  return new Response(
    JSON.stringify({ type: "query_result", skills: Object.entries(SKILLS).map(([id, s]) => ({ id, ...s })) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Consume SSE stream from Sound Agent ────────────────────────────────
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
    const direct = payload?.audio_urls ?? payload?.audioUrls ?? payload?.result?.audio_urls ?? payload?.result?.audioUrls;
    if (Array.isArray(direct)) return direct.filter((u: any) => typeof u === "string");
    const single = payload?.audio_url ?? payload?.audioUrl ?? payload?.result?.audio_url ?? payload?.result?.audioUrl;
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
      if (!jsonStr || jsonStr === "[DONE]") { currentEvent = null; continue; }

      let parsed: any;
      try { parsed = JSON.parse(jsonStr); } catch { continue; }

      const eventType = (typeof parsed?.type === "string" ? parsed.type : currentEvent) || "";

      if ((eventType === "token" || eventType === "message") && typeof parsed?.content === "string") {
        content += parsed.content;
      }
      if (eventType === "done") {
        const urls = extractAudioUrls(parsed);
        if (urls.length) audioUrls = urls;
      }
      if (eventType === "error") {
        return { content: "", audioUrls: [], error: parsed?.error || parsed?.message || "Agent error" };
      }
      currentEvent = null;
    }
  }

  return { content, audioUrls };
}

// ── task dispatcher ────────────────────────────────────────────────────
async function handleTask(body: Record<string, unknown>, supabaseUrl: string): Promise<Response> {
  const skillId = body.skill_id as string;
  const input = (body.input || {}) as Record<string, unknown>;

  switch (skillId) {
    case "generate_track":
      return await handleGenerateTrack(input, supabaseUrl);
    case "upload_song":
      return await handleUploadSong(input, supabaseUrl);
    case "list_playlists":
      return await handleListPlaylists(supabaseUrl);
    case "add_to_playlist":
      return await handleAddToPlaylist(input, supabaseUrl);
    case "list_songs":
      return await handleListSongs(input, supabaseUrl);
    default:
      return new Response(
        JSON.stringify({ status: "error", error: `Unknown skill: "${skillId}"`, available_skills: Object.keys(SKILLS) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}

// ── skill: generate_track (delegates to SoundAgent) ────────────────────
async function handleGenerateTrack(input: Record<string, unknown>, supabaseUrl: string): Promise<Response> {
  const prompt = input.prompt as string;
  const duration = input.duration as number | undefined;
  const context = input.context as Record<string, unknown> | undefined;

  if (!prompt) {
    return new Response(
      JSON.stringify({ status: "error", error: "input.prompt is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let enrichedPrompt = prompt;
  if (context) {
    const parts: string[] = [];
    if (context.venue) parts.push(`Venue: ${context.venue}`);
    if (context.time_of_day) parts.push(`Time of day: ${context.time_of_day}`);
    if (context.energy) parts.push(`Energy level: ${context.energy}`);
    if (parts.length) enrichedPrompt = `${prompt}\n\nContext: ${parts.join(", ")}`;
  }

  const agentMessage = `Generate a track and save it to the library. Here are the details:\n\nPrompt: ${enrichedPrompt}\nDuration: ${duration || 60} seconds\n\nImportant: Generate the track, save it to the library, and report the audio URL and metadata. Do not ask for confirmation — just execute.`;

  console.log(`[a2a] Delegating to Sound Agent — prompt: "${enrichedPrompt.slice(0, 80)}..."`);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const agentResponse = await fetch(`${supabaseUrl}/functions/v1/sound-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      conversation_id: crypto.randomUUID(),
      messages: [{ role: "user", content: agentMessage }],
      settings: {},
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

  const agentResult = await consumeAgentStream(agentResponse);

  if (agentResult.error) {
    return new Response(
      JSON.stringify({ status: "error", error: agentResult.error }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let audioUrls = agentResult.audioUrls;
  if (!audioUrls.length && agentResult.content) {
    const matches = agentResult.content.match(/https?:\/\/[^\s"'()]+?\.(?:mp3|wav|m4a|ogg)(?:\?[^\s"'()]*)?/gi);
    if (matches?.length) audioUrls = Array.from(new Set(matches));
  }

  if (!audioUrls.length) {
    return new Response(
      JSON.stringify({ status: "completed", result: { message: agentResult.content.slice(0, 500), audio_url: null, note: "Agent completed but no audio was generated." } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ status: "completed", result: { audio_url: audioUrls[0], audio_urls: audioUrls, title: prompt.slice(0, 60), duration: duration || 60, agent_response: agentResult.content.slice(0, 1000) } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── skill: upload_song — direct insert to library ──────────────────────
async function handleUploadSong(input: Record<string, unknown>, supabaseUrl: string): Promise<Response> {
  const audioUrl = input.audio_url as string;
  const title = input.title as string;

  if (!audioUrl || !title) {
    return new Response(
      JSON.stringify({ status: "error", error: "input.audio_url and input.title are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // Download audio and upload to storage
  let fileUrl = audioUrl;
  try {
    console.log(`[a2a:upload_song] Downloading audio from: ${audioUrl.slice(0, 100)}`);
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Download failed: ${audioRes.status}`);

    const audioBytes = new Uint8Array(await audioRes.arrayBuffer());
    const ext = audioUrl.match(/\.(mp3|wav|flac|m4a|ogg)/i)?.[1]?.toLowerCase() || "mp3";
    const filename = `a2a/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await sb.storage.from("songs").upload(filename, audioBytes, {
      contentType: ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : ext === "flac" ? "audio/flac" : "audio/mpeg",
      upsert: false,
    });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = sb.storage.from("songs").getPublicUrl(filename);
    fileUrl = urlData.publicUrl;
    console.log(`[a2a:upload_song] Uploaded to storage: ${fileUrl}`);
  } catch (e) {
    console.warn(`[a2a:upload_song] Storage upload failed, using original URL:`, e);
    // Fall back to the original URL
  }

  // Insert song record
  const songData = {
    title,
    artist: (input.artist as string) || "OpenClaw",
    genre: (input.genre as string) || null,
    mood: (input.mood as string) || null,
    bpm: (input.bpm as number) || null,
    key_scale: (input.key_scale as string) || null,
    time_signature: (input.time_signature as string) || null,
    duration: (input.duration as number) || 0,
    file_url: fileUrl,
    cover_url: (input.cover_url as string) || null,
    lyrics: (input.lyrics as string) || null,
    origin_source: (input.origin_source as string) || "a2a_upload",
    prompt: (input.prompt as string) || null,
  };

  const { data: song, error: insertErr } = await sb
    .from("songs")
    .insert(songData)
    .select("id, title, artist, genre, file_url")
    .single();

  if (insertErr) {
    console.error(`[a2a:upload_song] Insert failed:`, insertErr);
    return new Response(
      JSON.stringify({ status: "error", error: `Database insert failed: ${insertErr.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[a2a:upload_song] Song created: ${song.id} — "${song.title}"`);

  return new Response(
    JSON.stringify({ status: "completed", result: { song_id: song.id, title: song.title, artist: song.artist, genre: song.genre, file_url: song.file_url } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── skill: list_playlists ──────────────────────────────────────────────
async function handleListPlaylists(supabaseUrl: string): Promise<Response> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data, error } = await sb
    .from("playlists")
    .select("id, title, description, cover_image_url")
    .order("title");

  if (error) {
    return new Response(
      JSON.stringify({ status: "error", error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ status: "completed", result: { playlists: data, count: data.length } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── skill: add_to_playlist ─────────────────────────────────────────────
async function handleAddToPlaylist(input: Record<string, unknown>, supabaseUrl: string): Promise<Response> {
  const songId = input.song_id as string;
  const playlistId = input.playlist_id as string;

  if (!songId || !playlistId) {
    return new Response(
      JSON.stringify({ status: "error", error: "input.song_id and input.playlist_id are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // Get next position
  const { data: existing } = await sb
    .from("playlist_songs")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await sb
    .from("playlist_songs")
    .insert({ playlist_id: playlistId, song_id: songId, position: nextPosition });

  if (error) {
    return new Response(
      JSON.stringify({ status: "error", error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[a2a:add_to_playlist] Added song ${songId} to playlist ${playlistId} at position ${nextPosition}`);

  return new Response(
    JSON.stringify({ status: "completed", result: { song_id: songId, playlist_id: playlistId, position: nextPosition } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── skill: list_songs ──────────────────────────────────────────────────
async function handleListSongs(input: Record<string, unknown>, supabaseUrl: string): Promise<Response> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  let query = sb
    .from("songs")
    .select("id, title, artist, genre, mood, bpm, duration, file_url, cover_url, origin_source")
    .order("created_at", { ascending: false })
    .limit((input.limit as number) || 50);

  if (input.genre) query = query.ilike("genre", `%${input.genre}%`);
  if (input.mood) query = query.ilike("mood", `%${input.mood}%`);
  if (input.artist) query = query.ilike("artist", `%${input.artist}%`);

  const { data, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ status: "error", error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ status: "completed", result: { songs: data, count: data.length } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Request logging ─────────────────────────────────────────────────────
async function logRequest(
  supabaseUrl: string, type: string, skillId: string | null,
  ip: string, status: string, error?: string, resultSummary?: Record<string, unknown>
) {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    await sb.from("a2a_request_logs").insert({
      type, skill_id: skillId, ip_address: ip, status,
      error: error || null, result_summary: resultSummary || {},
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

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!checkRateLimit(clientIp)) {
    await logRequest(supabaseUrl, "rate_limited", null, clientIp, "rejected", "Rate limit exceeded");
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded (30 req/min)" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  if (req.method === "GET") {
    await logRequest(supabaseUrl, "discovery", null, clientIp, "completed");
    return handleGet(supabaseUrl);
  }

  if (req.method === "POST") {
    const response = await handlePost(req, supabaseUrl);
    try {
      const cloned = response.clone();
      const respBody = await cloned.json();
      const type = respBody.type || "task";
      const status = response.status >= 400 ? "error" : "completed";
      await logRequest(supabaseUrl, type, respBody.skill_id || respBody.result?.title || null, clientIp, status, respBody.error, respBody.result ? { title: respBody.result.title } : undefined);
    } catch { /* ignore */ }
    return response;
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
