import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "get_playlist_songs",
  title: "Get playlist songs",
  description: "List the songs in a playlist, in order.",
  inputSchema: { playlist_id: z.string().uuid() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ playlist_id }, ctx) => {
    await requireAuth(ctx);
    const db = supabaseAdmin();
    const { data: links, error } = await db.from("playlist_songs").select("song_id, position").eq("playlist_id", playlist_id).order("position");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const ids = (links ?? []).map((l) => l.song_id);
    if (ids.length === 0) return { content: [{ type: "text", text: "[]" }], structuredContent: { songs: [] } };
    const { data: songs, error: sErr } = await db.from("songs").select("*").in("id", ids);
    if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
    const byId = new Map((songs ?? []).map((s) => [s.id, s]));
    const ordered = (links ?? []).flatMap((l) => {
      const s = byId.get(l.song_id);
      return s ? [{ position: l.position, id: s.id, title: s.title, artist: s.artist, genre: s.genre, mood: s.mood, duration: s.duration }] : [];
    });
    return { content: [{ type: "text", text: JSON.stringify(ordered) }], structuredContent: { songs: ordered } };
  },
});
