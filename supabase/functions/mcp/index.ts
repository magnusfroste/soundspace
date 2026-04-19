// MCP Server — exposes the platform as Model Context Protocol tools
// Streamable HTTP transport via mcp-lite + Hono
// Authenticates via Bearer token stored in site_settings.mcp_api_token

import { Hono } from "npm:hono@^4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client for full admin access (only used after token auth)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ---------- Auth helper ---------- */
async function validateToken(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return false;
  const { data, error } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "mcp_api_token")
    .maybeSingle();
  if (error || !data) return false;
  const stored = (data.value as { token?: string | null })?.token;
  return !!stored && stored === token;
}

/* ---------- Logging ---------- */
async function logRequest(
  toolName: string,
  status: "completed" | "failed",
  ip: string | null,
  error?: string,
  summary?: Record<string, unknown>,
) {
  try {
    await admin.from("a2a_request_logs").insert({
      type: "mcp",
      skill_id: toolName,
      status,
      ip_address: ip,
      error: error ?? null,
      result_summary: (summary ?? {}) as never,
    });
  } catch (_) {
    // best-effort
  }
}

/* ---------- MCP Server ---------- */
const mcp = new McpServer({
  name: "soundspace-mcp",
  version: "1.0.0",
});

/* ===== SONGS ===== */
mcp.tool({
  name: "list_songs",
  description:
    "List songs in the library. Supports search by title/artist, filter by genre/mood, pagination.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string" },
      genre: { type: "string" },
      mood: { type: "string" },
      has_lyrics: { type: "boolean" },
      has_prompt: { type: "boolean" },
      limit: { type: "number", default: 50 },
      offset: { type: "number", default: 0 },
    },
  },
  handler: async (args: any) => {
    let q = admin.from("songs").select("*").is("deleted_at", null);
    if (args.search) q = q.or(`title.ilike.%${args.search}%,artist.ilike.%${args.search}%`);
    if (args.genre) q = q.eq("genre", args.genre);
    if (args.mood) q = q.eq("mood", args.mood);
    if (args.has_lyrics === true) q = q.not("lyrics", "is", null);
    if (args.has_lyrics === false) q = q.is("lyrics", null);
    if (args.has_prompt === true) q = q.not("prompt", "is", null);
    const limit = Math.min(args.limit ?? 50, 200);
    const offset = args.offset ?? 0;
    q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, songs: data }) }] };
  },
});

mcp.tool({
  name: "get_song",
  description: "Get full metadata for a single song including a fresh signed file URL (1h).",
  inputSchema: {
    type: "object",
    properties: { song_id: { type: "string" } },
    required: ["song_id"],
  },
  handler: async ({ song_id }: any) => {
    const { data: song, error } = await admin.from("songs").select("*").eq("id", song_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!song) throw new Error("Song not found");
    let signed: string | null = null;
    if (song.file_url) {
      const path = song.file_url.split("/songs/").pop();
      if (path) {
        const { data: s } = await admin.storage.from("songs").createSignedUrl(path, 3600);
        signed = s?.signedUrl ?? song.file_url;
      }
    }
    return { content: [{ type: "text", text: JSON.stringify({ ...song, signed_url: signed }) }] };
  },
});

mcp.tool({
  name: "update_song",
  description: "Update song metadata (title, artist, genre, mood, prompt, lyrics, bpm, key_scale, time_signature).",
  inputSchema: {
    type: "object",
    properties: {
      song_id: { type: "string" },
      title: { type: "string" }, artist: { type: "string" },
      genre: { type: "string" }, mood: { type: "string" },
      prompt: { type: "string" }, lyrics: { type: "string" },
      bpm: { type: "number" }, key_scale: { type: "string" }, time_signature: { type: "string" },
      cover_url: { type: "string" },
    },
    required: ["song_id"],
  },
  handler: async ({ song_id, ...updates }: any) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined && v !== null) clean[k] = v;
    const { data, error } = await admin.from("songs").update(clean).eq("id", song_id).select().single();
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool({
  name: "delete_song",
  description: "Soft-delete a song (move to trash). Restorable for 30 days.",
  inputSchema: { type: "object", properties: { song_id: { type: "string" } }, required: ["song_id"] },
  handler: async ({ song_id }: any) => {
    const { error } = await admin.from("songs").update({ deleted_at: new Date().toISOString() }).eq("id", song_id);
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, song_id }) }] };
  },
});

mcp.tool({
  name: "restore_song",
  description: "Restore a song from trash.",
  inputSchema: { type: "object", properties: { song_id: { type: "string" } }, required: ["song_id"] },
  handler: async ({ song_id }: any) => {
    const { error } = await admin.from("songs").update({ deleted_at: null }).eq("id", song_id);
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, song_id }) }] };
  },
});

mcp.tool({
  name: "permanently_delete_song",
  description: "Permanently delete a song. Requires confirm:true. Removes playlist memberships first.",
  inputSchema: {
    type: "object",
    properties: { song_id: { type: "string" }, confirm: { type: "boolean" } },
    required: ["song_id", "confirm"],
  },
  handler: async ({ song_id, confirm }: any) => {
    if (!confirm) throw new Error("confirm:true is required");
    await admin.from("playlist_songs").delete().eq("song_id", song_id);
    const { error } = await admin.from("songs").delete().eq("id", song_id);
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, song_id }) }] };
  },
});

mcp.tool({
  name: "upload_song",
  description:
    "Upload a song to the library. Provide either a public source_url to fetch, or base64 audio_data. Returns the new song record.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" }, artist: { type: "string" },
      source_url: { type: "string" }, audio_data: { type: "string" },
      content_type: { type: "string", default: "audio/mpeg" },
      genre: { type: "string" }, mood: { type: "string" },
      prompt: { type: "string" }, lyrics: { type: "string" },
      bpm: { type: "number" }, duration: { type: "number" },
      origin_source: { type: "string", default: "mcp_upload" },
    },
    required: ["title", "artist"],
  },
  handler: async (args: any) => {
    let bytes: Uint8Array;
    if (args.source_url) {
      const r = await fetch(args.source_url);
      if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
      bytes = new Uint8Array(await r.arrayBuffer());
    } else if (args.audio_data) {
      const bin = atob(args.audio_data);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else throw new Error("Provide source_url or audio_data");

    const ct = args.content_type || "audio/mpeg";
    const ext = ct.includes("wav") ? "wav" : ct.includes("flac") ? "flac" : "mp3";
    const fileName = `mcp-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from("songs").upload(fileName, bytes, { contentType: ct, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = admin.storage.from("songs").getPublicUrl(fileName);

    const { data: song, error } = await admin.from("songs").insert({
      title: args.title, artist: args.artist,
      file_url: pub.publicUrl,
      duration: args.duration ?? 0,
      genre: args.genre ?? null, mood: args.mood ?? null,
      prompt: args.prompt ?? null, lyrics: args.lyrics ?? null,
      bpm: args.bpm ?? null,
      origin_source: args.origin_source ?? "mcp_upload",
    }).select().single();
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(song) }] };
  },
});

mcp.tool({
  name: "download_song",
  description: "Get a signed download URL for a song (valid 1 hour).",
  inputSchema: {
    type: "object",
    properties: { song_id: { type: "string" }, expires_in: { type: "number", default: 3600 } },
    required: ["song_id"],
  },
  handler: async ({ song_id, expires_in }: any) => {
    const { data: song, error } = await admin.from("songs").select("file_url, title, artist").eq("id", song_id).maybeSingle();
    if (error || !song) throw new Error("Song not found");
    const path = song.file_url.split("/songs/").pop();
    if (!path) throw new Error("Invalid file path");
    const { data, error: sErr } = await admin.storage.from("songs").createSignedUrl(path, expires_in ?? 3600);
    if (sErr) throw new Error(sErr.message);
    return { content: [{ type: "text", text: JSON.stringify({ url: data.signedUrl, title: song.title, artist: song.artist }) }] };
  },
});

mcp.tool({
  name: "extract_lyrics",
  description: "Run speech-to-text on a song to extract lyrics.",
  inputSchema: {
    type: "object",
    properties: { song_id: { type: "string" }, provider: { type: "string", default: "elevenlabs" } },
    required: ["song_id"],
  },
  handler: async ({ song_id, provider }: any) => {
    const { data: song } = await admin.from("songs").select("file_url").eq("id", song_id).maybeSingle();
    if (!song) throw new Error("Song not found");
    const r = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-lyrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({ song_id, audio_url: song.file_url, provider: provider ?? "elevenlabs" }),
    });
    const json = await r.json();
    return { content: [{ type: "text", text: JSON.stringify(json) }] };
  },
});

mcp.tool({
  name: "generate_cover",
  description: "Generate AI cover art for a song.",
  inputSchema: { type: "object", properties: { song_id: { type: "string" }, prompt: { type: "string" } }, required: ["song_id"] },
  handler: async ({ song_id, prompt }: any) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({ song_id, prompt }),
    });
    const json = await r.json();
    return { content: [{ type: "text", text: JSON.stringify(json) }] };
  },
});

/* ===== PLAYLISTS ===== */
mcp.tool({
  name: "list_playlists",
  description: "List all admin playlists with song counts.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const { data: pls, error } = await admin.from("playlists").select("*").order("title");
    if (error) throw new Error(error.message);
    const { data: ps } = await admin.from("playlist_songs").select("playlist_id");
    const counts: Record<string, number> = {};
    ps?.forEach((r: any) => { counts[r.playlist_id] = (counts[r.playlist_id] || 0) + 1; });
    const enriched = (pls || []).map((p: any) => ({ ...p, song_count: counts[p.id] || 0 }));
    return { content: [{ type: "text", text: JSON.stringify(enriched) }] };
  },
});

mcp.tool({
  name: "get_playlist",
  description: "Get a playlist with its songs in order.",
  inputSchema: { type: "object", properties: { playlist_id: { type: "string" } }, required: ["playlist_id"] },
  handler: async ({ playlist_id }: any) => {
    const { data: pl, error } = await admin.from("playlists").select("*").eq("id", playlist_id).maybeSingle();
    if (error || !pl) throw new Error("Playlist not found");
    const { data: ps } = await admin
      .from("playlist_songs")
      .select("position, song_id, songs(*)")
      .eq("playlist_id", playlist_id)
      .order("position");
    return { content: [{ type: "text", text: JSON.stringify({ ...pl, songs: ps }) }] };
  },
});

mcp.tool({
  name: "create_playlist",
  description: "Create a new admin playlist.",
  inputSchema: {
    type: "object",
    properties: { title: { type: "string" }, description: { type: "string" }, cover_image_url: { type: "string" } },
    required: ["title"],
  },
  handler: async (args: any) => {
    const { data, error } = await admin.from("playlists").insert({
      title: args.title, description: args.description ?? null, cover_image_url: args.cover_image_url ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool({
  name: "update_playlist",
  description: "Update playlist metadata.",
  inputSchema: {
    type: "object",
    properties: {
      playlist_id: { type: "string" },
      title: { type: "string" }, description: { type: "string" }, cover_image_url: { type: "string" },
    },
    required: ["playlist_id"],
  },
  handler: async ({ playlist_id, ...updates }: any) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined) clean[k] = v;
    const { data, error } = await admin.from("playlists").update(clean).eq("id", playlist_id).select().single();
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool({
  name: "delete_playlist",
  description: "Delete a playlist (songs are kept in the library).",
  inputSchema: { type: "object", properties: { playlist_id: { type: "string" } }, required: ["playlist_id"] },
  handler: async ({ playlist_id }: any) => {
    await admin.from("playlist_songs").delete().eq("playlist_id", playlist_id);
    const { error } = await admin.from("playlists").delete().eq("id", playlist_id);
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, playlist_id }) }] };
  },
});

mcp.tool({
  name: "add_song_to_playlist",
  description: "Add a song to a playlist (appended at end).",
  inputSchema: {
    type: "object",
    properties: { song_id: { type: "string" }, playlist_id: { type: "string" } },
    required: ["song_id", "playlist_id"],
  },
  handler: async ({ song_id, playlist_id }: any) => {
    const { data: existing } = await admin.from("playlist_songs")
      .select("id").eq("song_id", song_id).eq("playlist_id", playlist_id).maybeSingle();
    if (existing) return { content: [{ type: "text", text: JSON.stringify({ ok: true, already: true }) }] };
    const { data: max } = await admin.from("playlist_songs")
      .select("position").eq("playlist_id", playlist_id).order("position", { ascending: false }).limit(1).maybeSingle();
    const next = ((max?.position ?? -1) as number) + 1;
    const { error } = await admin.from("playlist_songs").insert({ song_id, playlist_id, position: next });
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, position: next }) }] };
  },
});

mcp.tool({
  name: "remove_song_from_playlist",
  description: "Remove a song from a playlist.",
  inputSchema: {
    type: "object",
    properties: { song_id: { type: "string" }, playlist_id: { type: "string" } },
    required: ["song_id", "playlist_id"],
  },
  handler: async ({ song_id, playlist_id }: any) => {
    const { error } = await admin.from("playlist_songs").delete()
      .eq("song_id", song_id).eq("playlist_id", playlist_id);
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
  },
});

mcp.tool({
  name: "reorder_playlist_songs",
  description: "Reorder songs in a playlist by providing the full ordered array of song IDs.",
  inputSchema: {
    type: "object",
    properties: {
      playlist_id: { type: "string" },
      song_ids: { type: "array", items: { type: "string" } },
    },
    required: ["playlist_id", "song_ids"],
  },
  handler: async ({ playlist_id, song_ids }: any) => {
    for (let i = 0; i < song_ids.length; i++) {
      await admin.from("playlist_songs").update({ position: i })
        .eq("playlist_id", playlist_id).eq("song_id", song_ids[i]);
    }
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, count: song_ids.length }) }] };
  },
});

/* ===== AI GENERATION ===== */
mcp.tool({
  name: "generate_music",
  description: "Generate a new AI track. Returns the generation result (audio URL, etc).",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string" },
      provider: { type: "string", default: "acestep" },
      duration: { type: "number", default: 30 },
      lyrics: { type: "string" },
      genre: { type: "string" }, mood: { type: "string" },
    },
    required: ["prompt"],
  },
  handler: async (args: any) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-music`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify(args),
    });
    const json = await r.json();
    return { content: [{ type: "text", text: JSON.stringify(json) }] };
  },
});

mcp.tool({
  name: "list_ai_generations",
  description: "List recent AI generations (history).",
  inputSchema: {
    type: "object",
    properties: { limit: { type: "number", default: 50 }, provider: { type: "string" } },
  },
  handler: async ({ limit, provider }: any) => {
    let q = admin.from("ai_generations").select("*").order("created_at", { ascending: false }).limit(limit ?? 50);
    if (provider) q = q.eq("provider", provider);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool({
  name: "save_generation_to_library",
  description: "Mark an AI generation as saved (creates a song from it).",
  inputSchema: { type: "object", properties: { generation_id: { type: "string" } }, required: ["generation_id"] },
  handler: async ({ generation_id }: any) => {
    const { data: gen, error } = await admin.from("ai_generations").select("*").eq("id", generation_id).maybeSingle();
    if (error || !gen) throw new Error("Generation not found");
    if (!gen.audio_url) throw new Error("Generation has no audio");
    const { data: song, error: sErr } = await admin.from("songs").insert({
      title: gen.prompt.slice(0, 60), artist: "SoundSpace AI",
      file_url: gen.audio_url, duration: gen.duration, prompt: gen.prompt,
      genre: gen.genre, mood: gen.mood, lyrics: gen.lyrics, origin_source: "ai_generated",
    }).select().single();
    if (sErr) throw new Error(sErr.message);
    await admin.from("ai_generations").update({ saved_to_library: true, song_id: song.id }).eq("id", generation_id);
    return { content: [{ type: "text", text: JSON.stringify(song) }] };
  },
});

/* ===== TRASH ===== */
mcp.tool({
  name: "list_trash",
  description: "List soft-deleted songs.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const { data, error } = await admin.from("songs").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool({
  name: "empty_trash",
  description: "Permanently delete all songs in trash. Requires confirm:true.",
  inputSchema: { type: "object", properties: { confirm: { type: "boolean" } }, required: ["confirm"] },
  handler: async ({ confirm }: any) => {
    if (!confirm) throw new Error("confirm:true is required");
    const { data: trashed } = await admin.from("songs").select("id").not("deleted_at", "is", null);
    const ids = (trashed || []).map((s: any) => s.id);
    if (ids.length === 0) return { content: [{ type: "text", text: JSON.stringify({ ok: true, deleted: 0 }) }] };
    await admin.from("playlist_songs").delete().in("song_id", ids);
    const { error } = await admin.from("songs").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, deleted: ids.length }) }] };
  },
});

/* ===== META ===== */
mcp.tool({
  name: "get_stats",
  description: "Get library counts (songs, playlists, trash, generations).",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const [s, p, t, g] = await Promise.all([
      admin.from("songs").select("id", { count: "exact", head: true }).is("deleted_at", null),
      admin.from("playlists").select("id", { count: "exact", head: true }),
      admin.from("songs").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
      admin.from("ai_generations").select("id", { count: "exact", head: true }),
    ]);
    return { content: [{ type: "text", text: JSON.stringify({
      songs: s.count, playlists: p.count, trash: t.count, ai_generations: g.count,
    }) }] };
  },
});

mcp.tool({
  name: "list_genres",
  description: "List unique genres used in the library.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const { data } = await admin.from("songs").select("genre").is("deleted_at", null).not("genre", "is", null);
    const set = new Set<string>();
    data?.forEach((r: any) => r.genre && set.add(r.genre));
    return { content: [{ type: "text", text: JSON.stringify([...set].sort()) }] };
  },
});

mcp.tool({
  name: "list_moods",
  description: "List unique moods used in the library.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const { data } = await admin.from("songs").select("mood").is("deleted_at", null).not("mood", "is", null);
    const set = new Set<string>();
    data?.forEach((r: any) => r.mood && set.add(r.mood));
    return { content: [{ type: "text", text: JSON.stringify([...set].sort()) }] };
  },
});

/* ---------- HTTP transport ---------- */
const transport = new StreamableHttpTransport();
const app = new Hono();

// CORS preflight
app.options("/*", (c) => new Response("ok", { headers: corsHeaders }));

// Health check (no auth) — useful for clients to verify endpoint
app.get("/", (c) => c.json({ name: "soundspace-mcp", version: "1.0.0", transport: "streamable-http" }, 200, corsHeaders));

// Protected MCP transport route
app.all("/*", async (c) => {
  const authHeader = c.req.header("authorization") || c.req.header("Authorization") || null;
  const ip = c.req.header("x-forwarded-for") || null;

  const ok = await validateToken(authHeader);
  if (!ok) {
    await logRequest("auth", "failed", ip, "Invalid or missing token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await transport.handleRequest(c.req.raw, mcp);
    // Best-effort log (peek at body type for tool name)
    try {
      const cloned = c.req.raw.clone();
      const body = await cloned.json().catch(() => null);
      const toolName = body?.params?.name || body?.method || "unknown";
      await logRequest(toolName, res.ok ? "completed" : "failed", ip);
    } catch (_) { /* ignore */ }

    // Add CORS headers to response
    const headers = new Headers(res.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
    return new Response(res.body, { status: res.status, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logRequest("transport", "failed", ip, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

Deno.serve(app.fetch);
