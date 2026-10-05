import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

interface SongRow {
  id: string; title: string; artist: string; genre: string | null; mood: string | null;
  duration: number; file_url: string; cover_url: string | null; bpm: number | null;
  key_scale: string | null; time_signature: string | null; quality_score: number | null;
  prompt: string | null; lyrics: string | null; origin_source: string | null;
  created_at: string; deleted_at: string | null;
}

const toSongJson = (s: SongRow) => ({
  id: s.id, title: s.title, artist: s.artist, genre: s.genre, mood: s.mood,
  duration: s.duration, file_url: s.file_url, cover_url: s.cover_url,
  bpm: s.bpm, key_scale: s.key_scale, time_signature: s.time_signature,
  quality_score: s.quality_score, prompt: s.prompt, lyrics: s.lyrics,
  origin_source: s.origin_source, created_at: s.created_at, deleted_at: s.deleted_at,
});

export default defineTool({
  name: "list_songs",
  title: "List songs",
  description: "List songs in the library with optional search and filters.",
  inputSchema: {
    search: z.string().optional().describe("Match title or artist (case-insensitive)."),
    genre: z.string().optional(),
    mood: z.string().optional(),
    include_trash: z.boolean().optional().describe("Include soft-deleted songs."),
    limit: z.number().int().min(1).max(500).optional(),
    offset: z.number().int().min(0).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ search, genre, mood, include_trash, limit = 100, offset = 0 }, ctx) => {
    await requireAuth(ctx);
    let q = supabaseAdmin().from("songs").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (!include_trash) q = q.is("deleted_at", null);
    if (search) q = q.or(`title.ilike.%${search}%,artist.ilike.%${search}%`);
    if (genre) q = q.eq("genre", genre);
    if (mood) q = q.eq("mood", mood);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const songs = (data ?? []).map((s) => toSongJson(s as SongRow));
    return { content: [{ type: "text", text: JSON.stringify(songs) }], structuredContent: { songs } };
  },
});
