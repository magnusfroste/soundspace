import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "update_song",
  title: "Update song metadata",
  description: "Edit a song's title, artist, genre, mood, prompt, lyrics, BPM, key, time signature or cover URL.",
  inputSchema: {
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    artist: z.string().min(1).optional(),
    genre: z.string().nullable().optional(),
    mood: z.string().nullable().optional(),
    prompt: z.string().nullable().optional(),
    lyrics: z.string().nullable().optional(),
    bpm: z.number().int().nullable().optional(),
    key_scale: z.string().nullable().optional(),
    time_signature: z.string().nullable().optional(),
    cover_url: z.string().url().nullable().optional(),
    quality_score: z.number().min(0).max(100).nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...updates }, ctx) => {
    await requireAuth(ctx);
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) {
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    }
    const { data, error } = await supabaseAdmin().from("songs").update(clean).eq("id", id).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Song not found" }], isError: true };
    const s = data;
    const song = { id: s.id, title: s.title, artist: s.artist, genre: s.genre, mood: s.mood, prompt: s.prompt, lyrics: s.lyrics, bpm: s.bpm, key_scale: s.key_scale, time_signature: s.time_signature, cover_url: s.cover_url, quality_score: s.quality_score };
    return { content: [{ type: "text", text: `Updated song ${id}` }], structuredContent: { song } };
  },
});
