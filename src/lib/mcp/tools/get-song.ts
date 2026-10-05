import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "get_song",
  title: "Get song",
  description: "Get full details for one song, including prompt, lyrics and quality metadata.",
  inputSchema: { id: z.string().uuid().describe("Song ID.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    await requireAuth(ctx);
    const { data, error } = await supabaseAdmin().from("songs").select("*").eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Song not found" }], isError: true };
    const s = data;
    const song = { id: s.id, title: s.title, artist: s.artist, genre: s.genre, mood: s.mood, duration: s.duration, file_url: s.file_url, cover_url: s.cover_url, bpm: s.bpm, key_scale: s.key_scale, time_signature: s.time_signature, quality_score: s.quality_score, prompt: s.prompt, lyrics: s.lyrics, origin_source: s.origin_source, created_at: s.created_at, deleted_at: s.deleted_at };
    return { content: [{ type: "text", text: JSON.stringify(song) }], structuredContent: { song } };
  },
});
